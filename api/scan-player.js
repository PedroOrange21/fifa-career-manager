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
    duracionCesion: { type: Type.STRING, enum: ['6 Meses', '1 Temporada', '2 Temporadas'], nullable: true, description: 'Solo si esCesion es true y la tarjeta indica una duración de cesión: la opción de este enum más cercana a lo que muestra la tarjeta.' },
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
  dueño real, identificado por el texto o el escudo), y duracionCesion = la opción del enum
  (6 Meses / 1 Temporada / 2 Temporadas) más parecida a la duración de cesión que muestre la
  tarjeta si aparece. En este caso NO rellenes duracionContrato ni clausulaRescision (van a
  null): un jugador cedido no tiene esos datos como propietario, son del club de origen.
- Si NO encuentras ningún indicio de cesión: esCesion = false (o null), clubCesion = null,
  duracionCesion = null, y en su lugar sí rellena duración de contrato (años restantes o fecha
  de finalización) y cláusula de rescisión en euros si la tarjeta las muestra — es un jugador
  en propiedad (traspaso), no cedido.

Reglas importantes:
- Todos los importes en euros deben ir como número entero puro, SIN puntos de miles, SIN comas, SIN el símbolo "€" y sin abreviar (ej. escribe 45000000, nunca "45M" ni "45.000.000 €").
- Si un dato no aparece visible en la imagen o no puedes leerlo con confianza, devuelve null en ese campo — no inventes ni adivines valores.
- No incluyas en la respuesta ningún dato fuera del esquema indicado (nada de altura, peso, cláusula de reventa, primas extra o prima de fichaje): esos campos ya no existen en la ficha de la aplicación.
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

  const { imageBase64: rawImageBase64, mimeType: rawMimeType } = req.body || {};
  if (!rawImageBase64) {
    res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    return;
  }
  const imageBase64 = sanitizeBase64(rawImageBase64);
  const mimeType = sanitizeMimeType(rawMimeType);

  const ai = new GoogleGenAI({ apiKey });
  const callModel = (model) => ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
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
