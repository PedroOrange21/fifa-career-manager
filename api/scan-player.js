import { GoogleGenAI, Type } from '@google/genai';

// Función Serverless de Vercel (Node.js runtime, ver package.json "type": "module"): la única
// pieza de la app que conoce la clave de Gemini. El frontend nunca la ve — solo llama a este
// endpoint con la imagen ya en base64 (ver src/services/geminiPlayerScan.js).
//
// Autenticación por API Key de la Gemini Developer API (AI Studio), ya validada de forma
// independiente contra generativelanguage.googleapis.com antes de desplegar este cambio — sin
// necesidad de facturación de Google Cloud (a diferencia de Vertex AI, que sí la exige).
// GEMINI_API_KEY/VITE_GEMINI_API_KEY: cualquiera de los dos nombres sirve, por si el proyecto
// tiene configurado uno u otro en Vercel.
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// gemini-3.6-flash es el modelo objetivo vigente para esta clave (gemini-2.5-flash y
// gemini-1.5-flash ya no están disponibles para claves nuevas — Google los retiró); si algún
// día deja de estar disponible o hay un problema puntual, se reintenta con gemini-3.7-flash
// antes de rendirse. Ambos verificados con una llamada real justo antes de este despliegue.
const PRIMARY_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.7-flash';

// Tipos MIME que Gemini acepta para imágenes; cualquier otro valor (o ausente) cae a JPEG, que
// es lo que produce cualquier cámara de móvil.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const sanitizeMimeType = (mime) => (ALLOWED_MIME_TYPES.includes(mime) ? mime : 'image/jpeg');

// Por si el frontend llegara a enviar la data URL completa ("data:image/jpeg;base64,...") en
// vez del base64 puro — defensa adicional, aunque el cliente actual (geminiPlayerScan.js) ya
// lo recorta antes de enviarlo.
const sanitizeBase64 = (raw) => {
  const value = String(raw || '');
  const commaIdx = value.indexOf(',');
  return value.startsWith('data:') && commaIdx >= 0 ? value.slice(commaIdx + 1) : value;
};

// Gemini debería devolver JSON puro gracias a responseSchema/responseMimeType, pero como
// respaldo se admite también que venga envuelto en una valla de código Markdown
// (```json ... ``` o ``` ... ```), por si el modelo decide "explicar" la respuesta.
const parseGeminiJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
      try { return JSON.parse(fenced[1]); } catch (err2) { /* sigue al throw de abajo */ }
    }
    throw err;
  }
};

// Vuelca el máximo detalle posible de un error del SDK de Gemini (código HTTP, mensaje,
// causa) en los logs de la función — la API de Google suele meter el motivo real dentro del
// mensaje o en err.status/err.cause, que console.error(err) por sí solo no siempre expande.
const logGeminiError = (label, err) => {
  console.error(label, {
    message: err?.message,
    status: err?.status ?? err?.statusCode ?? err?.response?.status,
    name: err?.name,
    cause: err?.cause,
  });
};

// Esquema de salida estructurada: obliga a Gemini a responder JSON con exactamente estos
// campos (o null si el dato no es visible en la imagen), sin texto extra alrededor que haya
// que parsear a mano.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nombre: { type: Type.STRING, nullable: true, description: 'Nombre completo del jugador tal como aparece en la tarjeta.' },
    media: { type: Type.INTEGER, nullable: true, description: 'Media/valoración general (OVR), número entre 1 y 99.' },
    potencial: { type: Type.INTEGER, nullable: true, description: 'Potencial (PLT/POT), número entre 1 y 99, si la tarjeta lo muestra.' },
    posicionPrincipal: { type: Type.STRING, nullable: true, description: 'Abreviatura de la posición principal (ej. DC, MC, LD, POR).' },
    posicionesSecundarias: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: 'Abreviaturas de posiciones secundarias, si las muestra la tarjeta.' },
    nacionalidad: { type: Type.STRING, nullable: true },
    edad: { type: Type.INTEGER, nullable: true },
    piernaBuena: { type: Type.STRING, enum: ['Diestro', 'Zurdo'], nullable: true },
    relevancia: { type: Type.STRING, enum: ['Clave', 'Importante', 'Rotación', 'Esporádico', 'Promesa'], nullable: true, description: 'Rol/relevancia en la plantilla si la tarjeta lo indica.' },
    sueldoSemanal: { type: Type.INTEGER, nullable: true, description: 'Sueldo SEMANAL en euros, solo el número (sin puntos, comas ni símbolo de moneda).' },
    valorMercado: { type: Type.INTEGER, nullable: true, description: 'Valor de mercado en euros, solo el número.' },
    duracionContrato: { type: Type.STRING, nullable: true, description: 'Duración de contrato tal como aparece (años restantes o fecha de finalización). Solo aplica si NO es una cesión.' },
    clausulaRescision: { type: Type.INTEGER, nullable: true, description: 'Cláusula de rescisión en euros, solo el número. Solo aplica si NO es una cesión.' },
    // Detección de cesión: EA Sports FC suele marcar a un jugador cedido con un texto tipo "En
    // cesión del [Club]" o "Cedido por [Club]" junto al escudo del club de origen, en vez de
    // los datos de contrato/cláusula habituales de un jugador en propiedad.
    esCesion: { type: Type.BOOLEAN, nullable: true, description: 'true si la tarjeta indica que el jugador está cedido de otro club (texto tipo "En cesión del...", "Cedido por...", o un escudo de club de origen distinto del propio), false o null si no hay ningún indicio de cesión.' },
    clubCesion: { type: Type.STRING, nullable: true, description: 'Solo si esCesion es true: nombre del club que cede al jugador (el dueño real), identificado por el texto o el escudo junto a él.' },
    duracionCesion: { type: Type.STRING, nullable: true, description: 'Solo si esCesion es true y la tarjeta indica una duración/tiempo restante de cesión: transcribe el texto EXACTO tal como aparece (ej. "11 Meses", "5 Meses", "1 Año"), sin redondear ni encajarlo en ninguna categoría fija — es el tiempo real restante de una cesión en curso.' },
    // Autodetección de tarjeta de Academia colada por error en un lote de Primer Equipo: si la
    // imagen en realidad muestra un RANGO de potencial (ej. "75-94") o viene de la pantalla de
    // Academia/Jóvenes Promesas, márcalo aquí en vez de forzar los datos de primer equipo.
    esCanterano: { type: Type.BOOLEAN, nullable: true, description: 'true si esta tarjeta en realidad es de un canterano de la Academia de Jóvenes Promesas (muestra un RANGO de potencial tipo "75-94", o es la pantalla de Academia/Jóvenes Promesas) en vez de un jugador de primer equipo — aunque se te haya pedido analizar una tarjeta de primer equipo, señala este caso si lo detectas. false o null en cualquier tarjeta normal de primer equipo.' },
    potencialCantera: { type: Type.STRING, nullable: true, description: 'Solo si esCanterano es true: el rango de potencial tal como aparece (ej. "75-94"), o un único número de potencial como texto si no se muestra como rango.' },
  },
};

const PROMPT = `Eres un asistente experto en leer tarjetas de jugador del videojuego EA Sports FC (Modo Carrera), tal como se muestran en las pantallas de Plantilla o en el detalle económico de Finanzas/Oficina.

Analiza la imagen adjunta y extrae ÚNICAMENTE los datos que aparezcan visibles en la tarjeta, con la máxima precisión posible:
- nombre completo del jugador
- media/valoración general (OVR)
- potencial (PLT/POT), si la tarjeta lo muestra
- posición principal (abreviatura, ej. DC, MC, LD, POR)
- posiciones secundarias (si las hay)
- nacionalidad
- edad
- pierna buena (Diestro o Zurdo)
- relevancia o rol en la plantilla (Clave, Importante, Rotación, Esporádico o Promesa), si aparece
- sueldo SEMANAL en euros (el que EA Sports FC llama "Sueldo sem." — si solo ves un sueldo mensual o anual, conviértelo tú mismo a semanal antes de responder)
- valor de mercado en euros

Detección de cesión (muy importante, revísalo con cuidado antes de rellenar duración/cláusula):
- Busca en la tarjeta cualquier indicio de que el jugador está CEDIDO de otro club: texto como
  "En cesión del [Club]", "Cedido por [Club]", "Cesión de [Club]", o un escudo de un club
  distinto del tuyo junto a esa mención.
- Si encuentras ese indicio: esCesion = true, clubCesion = el nombre del club que lo cede (el
  dueño real, identificado por el texto o el escudo), y duracionCesion = el texto EXACTO de la
  duración o tiempo restante de cesión que muestre la tarjeta, sin normalizar ni redondear a
  una categoría (ej. si pone "11 Meses" devuelve "11 Meses", no "1 Temporada"; si pone "5
  Meses" devuelve "5 Meses", no "6 Meses") — en una carrera ya avanzada ese tiempo restante
  exacto es el dato real que importa, no una duración inicial aproximada. En este caso NO
  rellenes duracionContrato ni clausulaRescision (van a null): un jugador cedido no tiene esos
  datos como propietario, son del club de origen.
  Si el club de origen aparece solo como una abreviatura de 3-4 letras junto al escudo (p. ej.
  "VAL", "RMA", "ATM", "BAR"/"FCB", "SEV", "BET", "RSO", "VIL", "ATH"), intenta devolver el
  nombre completo del club en vez de la abreviatura (ej. "Valencia CF" en vez de "VAL") si lo
  reconoces con confianza; si no lo reconoces, devuelve la abreviatura tal cual la ves.
- Si NO encuentras ningún indicio de cesión: esCesion = false (o null), clubCesion = null,
  duracionCesion = null, y en su lugar sí rellena duración de contrato (años restantes o fecha
  de finalización) y cláusula de rescisión en euros si la tarjeta las muestra — es un jugador
  en propiedad (traspaso), no cedido.

Detección de tarjeta de Academia colada por error (revísalo antes de nada, es prioritario
sobre el resto de reglas): si la imagen en realidad muestra un RANGO de potencial (ej.
"75-94", dos números separados por un guion) en vez de una única media, o es visiblemente la
pantalla de Academia/Jóvenes Promesas del juego, esto NO es una tarjeta de primer equipo: pon
esCanterano = true, potencialCantera = ese rango tal cual (o el número único si no es un
rango), y rellena el resto de campos deportivos que sí veas (nombre, media, posición,
nacionalidad, edad, pierna) con normalidad — pero deja sueldoSemanal, valorMercado,
duracionContrato, clausulaRescision, relevancia, esCesion, clubCesion y duracionCesion todos a
null, un canterano no tiene esos datos. Si es una tarjeta de primer equipo normal, esCanterano
= false (o null) y potencialCantera = null.

Reglas importantes:
- Todos los importes en euros deben ir como número entero puro, SIN puntos de miles, SIN comas, SIN el símbolo "€" y sin abreviar (ej. escribe 45000000, nunca "45M" ni "45.000.000 €").
- Si un dato no aparece visible en la imagen o no puedes leerlo con confianza, devuelve null en ese campo — no inventes ni adivines valores.
- No incluyas en la respuesta ningún dato fuera del esquema indicado (nada de altura, peso, cláusula de reventa, primas extra o prima de fichaje): esos campos ya no existen en la ficha de la aplicación.
- Responde exclusivamente con el JSON que cumpla el esquema indicado, sin texto adicional.`;

// Esquema y prompt específicos para tarjetas de la Academia de Jóvenes Promesas: un canterano
// en este modelo de datos (type "Cantera") NUNCA tiene términos económicos de primer equipo
// (sueldo, cláusula de rescisión, precio de traspaso, relevancia en la plantilla) — solo los
// campos deportivos/de identidad que sí existen en su ficha, más el rango de potencial que es
// lo que distingue a un canterano de un jugador ya formado.
const ACADEMY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nombre: { type: Type.STRING, nullable: true, description: 'Nombre completo del canterano tal como aparece en la tarjeta.' },
    media: { type: Type.INTEGER, nullable: true, description: 'Media/valoración actual (OVR), número entre 1 y 99.' },
    potencial: { type: Type.STRING, nullable: true, description: 'Rango de potencial tal como lo muestra la tarjeta (ej. "75-94"); si solo hay un único número de potencial, devuélvelo igualmente como texto (ej. "88").' },
    posicionPrincipal: { type: Type.STRING, nullable: true, description: 'Abreviatura de la posición principal (ej. DC, MC, LD, POR).' },
    posicionesSecundarias: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: 'Abreviaturas de posiciones secundarias, si las muestra la tarjeta.' },
    nacionalidad: { type: Type.STRING, nullable: true },
    edad: { type: Type.INTEGER, nullable: true },
    piernaBuena: { type: Type.STRING, enum: ['Diestro', 'Zurdo'], nullable: true },
    valorMercado: { type: Type.INTEGER, nullable: true, description: 'Valor de mercado en euros, solo el número.' },
  },
};

const ACADEMY_PROMPT = `Eres un asistente experto en leer tarjetas de jugador del videojuego EA Sports FC (Modo Carrera), específicamente de la sección Academia de Jóvenes Promesas (Academy/Youth Prospects), donde se muestran los canteranos del club.

Analiza la imagen adjunta y extrae ÚNICAMENTE los datos que aparezcan visibles en la tarjeta del canterano, con la máxima precisión posible:
- nombre completo
- media/valoración actual (OVR)
- rango de potencial (ej. "75-94") o un único número de potencial si no se muestra como rango
- posición principal (abreviatura, ej. DC, MC, LD, POR)
- posiciones secundarias (si las hay)
- nacionalidad
- edad
- pierna buena (Diestro o Zurdo)
- valor de mercado en euros

Reglas importantes:
- Un canterano de la Academia NUNCA tiene sueldo, cláusula de rescisión, precio de traspaso, club de procedencia ni relevancia en la plantilla — son datos de primer equipo que no existen en su ficha. Aunque la imagen mostrara algo parecido, ignóralo: no forma parte del esquema y no debes intentar rellenarlo.
- El importe de valor de mercado debe ir como número entero puro, SIN puntos de miles, SIN comas, SIN el símbolo "€" y sin abreviar (ej. escribe 4500000, nunca "4.5M").
- Si un dato no aparece visible en la imagen o no puedes leerlo con confianza, devuelve null en ese campo — no inventes ni adivines valores.
- Responde exclusivamente con el JSON que cumpla el esquema indicado, sin texto adicional.`;

// Nota: el límite de tamaño de petición de las funciones Serverless de Vercel (~4.5 MB por
// defecto) es un límite de plataforma, no configurable aquí — una foto de móvil ya comprimida
// en JPEG/base64 entra sobradamente dentro de ese margen.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  if (!apiKey) {
    console.error('Falta GEMINI_API_KEY/VITE_GEMINI_API_KEY en las variables de entorno del proyecto.');
    res.status(500).json({ error: 'El servidor no tiene configurada la clave de Gemini. Contacta con el administrador.' });
    return;
  }

  const { imageBase64: rawImageBase64, mimeType: rawMimeType, mode: rawMode } = req.body || {};
  if (!rawImageBase64) {
    res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    return;
  }
  const imageBase64 = sanitizeBase64(rawImageBase64);
  const mimeType = sanitizeMimeType(rawMimeType);
  // "academia" activa el esquema/prompt de canteranos (ver ACADEMY_RESPONSE_SCHEMA/PROMPT);
  // cualquier otro valor (incluido ausente) usa el de primer equipo, el comportamiento previo.
  const isAcademy = rawMode === 'academia';
  const promptText = isAcademy ? ACADEMY_PROMPT : PROMPT;
  const schema = isAcademy ? ACADEMY_RESPONSE_SCHEMA : RESPONSE_SCHEMA;

  const ai = new GoogleGenAI({ apiKey });
  const callModel = (model) => ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: promptText },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  let response;
  let lastError;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      response = await callModel(model);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      logGeminiError(`Error llamando a Gemini (modelo ${model}):`, err);
    }
  }

  if (lastError) {
    res.status(502).json({ error: 'No se pudo analizar la imagen. Inténtalo de nuevo.', details: lastError.message || String(lastError) });
    return;
  }

  const text = response?.text;
  if (!text) {
    console.error('Gemini respondió sin texto utilizable. Respuesta completa:', JSON.stringify(response)?.slice(0, 2000));
    res.status(502).json({ error: 'Gemini no devolvió ningún dato legible de la imagen. Prueba con una foto más nítida y bien encuadrada.' });
    return;
  }

  let data;
  try {
    data = parseGeminiJson(text);
  } catch (err) {
    console.error('Respuesta de Gemini no es JSON válido:', text.slice(0, 2000), err);
    res.status(502).json({ error: 'La respuesta de Gemini no tuvo el formato esperado. Inténtalo de nuevo.', details: err.message });
    return;
  }

  res.status(200).json({ data });
}
