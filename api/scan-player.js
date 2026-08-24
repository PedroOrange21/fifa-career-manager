import { GoogleGenAI, Type } from '@google/genai';

// Función Serverless de Vercel (Node.js runtime, ver package.json "type": "module"): la única
// pieza de la app que conoce la clave de Gemini. El frontend nunca la ve — solo llama a este
// endpoint con la imagen ya en base64 (ver src/services/geminiPlayerScan.js).
//
// Autenticación por API Key de la Gemini Developer API (AI Studio), ya validada de forma
// independiente contra generativelanguage.googleapis.com antes de desplegar este cambio — sin
// necesidad de facturación de Google Cloud (a diferencia de Vertex AI, que sí la exige).
// GEMINI_API_KEY/VITE_GEMINI_API_KEY: cualquiera de los dos nombres sirve, por si el proyecto
// tiene configurado uno u otro en Vercel. Soporte multiclave: cualquiera de las dos variables
// puede contener VARIAS claves separadas por comas (ej. "clave1,clave2,clave3") — se prueban en
// orden y, si una se queda sin cuota diaria/RPM (RESOURCE_EXHAUSTED, 429/503) o resulta
// inválida (API_KEY_INVALID, PERMISSION_DENIED, UNAUTHENTICATED), se rota automáticamente a la
// siguiente sin fallar la petición hacia el frontend — ver el bucle de claves más abajo. El
// propio valor en Vercel ya se guarda deduplicado (ver el script de fusión usado al añadir
// claves nuevas), pero el Set() de aquí es una red de seguridad adicional por si algún día se
// añade una clave repetida a mano.
const geminiKeys = [...new Set(
  (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
)];

// gemini-3.6-flash es el modelo objetivo vigente para esta clave (gemini-2.5-flash y
// gemini-1.5-flash ya no están disponibles para claves nuevas — Google los retiró); si algún
// día deja de estar disponible o hay un problema puntual, se reintenta con gemini-3.7-flash
// antes de rendirse. Ambos verificados con una llamada real justo antes de este despliegue.
const PRIMARY_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.7-flash';

// Respaldo de segundo nivel (ver handler más abajo): si TODAS las claves/modelos de Gemini
// fallan o devuelven algo inaprovechable para esta foto, se prueba con Groq Vision antes de
// rendirse del todo — mismo patrón de pool multiclave separado por comas que Gemini.
const groqKeys = [...new Set(
  (process.env.GROQ_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
)];
const GROQ_MODELS = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];

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

// Códigos de estado que la propia API de Google usa en sus errores (formato gRPC/REST estándar
// de Google Cloud) — se buscan tal cual dentro del mensaje si no vienen ya en una propiedad
// anidada, para poder devolver el código EXACTO al frontend en vez de enmascararlo detrás de un
// "no leída" genérico que no dice nada de qué ha fallado realmente.
const GOOGLE_STATUS_CODES = [
  'API_KEY_INVALID', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'RESOURCE_EXHAUSTED',
  'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'INTERNAL',
  'NOT_FOUND', 'ABORTED',
];
const extractTechnicalCode = (err) => {
  // Códigos sintéticos propios de este endpoint (EMPTY_RESPONSE_SAFETY, INVALID_JSON_RESPONSE,
  // GROQ_QUOTA_EXCEEDED...): si el mensaje YA es un token en mayúsculas/guion bajo, se devuelve
  // tal cual — es más específico que cualquier búsqueda de patrón.
  const rawMessage = String(err?.message || err || '');
  if (/^[A-Z][A-Z0-9_]*$/.test(rawMessage)) return rawMessage;
  const nestedStatus = err?.error?.status || err?.response?.data?.error?.status || err?.cause?.status;
  if (nestedStatus) return String(nestedStatus).toUpperCase();
  const matchedCode = GOOGLE_STATUS_CODES.find((code) => rawMessage.toUpperCase().includes(code));
  if (matchedCode) return matchedCode;
  const httpCode = err?.status ?? err?.statusCode ?? err?.response?.status;
  if (httpCode) return `HTTP_${httpCode}`;
  return 'UNKNOWN_ERROR';
};

// Llamada a Groq Cloud Vision (API compatible con OpenAI chat completions) como respaldo de
// segundo nivel cuando Gemini falla del todo. Reutiliza literalmente el mismo "promptText" que
// ya usa Gemini (PROMPT/ACADEMY_PROMPT, ver más abajo) — así el JSON que devuelve Groq tiene
// EXACTAMENTE los mismos nombres de campo (nombre, media, posicionPrincipal...) que espera
// mapScanResultToPrefill/mapAcademyScanResultToPrefill en el cliente, sin que ese código tenga
// que saber si el dato vino de Gemini o de Groq. Groq no admite un responseSchema estricto como
// Gemini (solo response_format: json_object, que fuerza JSON válido pero no una forma
// concreta), así que se refuerza con una frase final explícita pidiendo el JSON en crudo.
const callGroqVision = async (groqKey, model, promptText, mimeType, imageBase64) => {
  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${promptText}\n\nResponde ÚNICAMENTE con el objeto JSON en crudo, sin vallas de código Markdown ni texto adicional.` },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });
  } catch (err) {
    const networkErr = new Error('GROQ_FETCH_FAILED');
    networkErr.cause = err;
    throw networkErr;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code || payload?.error?.type;
    const err = new Error(code ? String(code).toUpperCase() : `GROQ_HTTP_${response.status}`);
    err.status = response.status;
    err.details = payload?.error?.message || '';
    throw err;
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (!text) {
    const err = new Error('GROQ_EMPTY_RESPONSE');
    throw err;
  }
  return parseGeminiJson(text);
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
    relevancia: { type: Type.STRING, enum: ['Crucial', 'Importante', 'Rotación', 'Esporádico', 'Promesa'], nullable: true, description: 'Rol/relevancia en la plantilla (busca una etiqueta o icono tipo "Crucial", "Importante", "Rotación", "Esporádico" o "Promesa" junto al nombre o la posición del jugador; casi siempre está presente en la tarjeta de Finanzas, no la dejes en null salvo que de verdad no aparezca ningún indicio).' },
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
    // Detección de cesión SALIENTE (dirección opuesta a esCesion): un jugador que SIGUE siendo
    // propiedad de nuestro club pero que el propio juego marca como cedido A otro equipo —
    // normalmente un texto tipo "En cesión al [Club]" o "Cedido al [Club]" junto al escudo del
    // club de destino, en vez de "del"/"por" (que es la cesión entrante de arriba).
    esCesionSaliente: { type: Type.BOOLEAN, nullable: true, description: 'true si la tarjeta indica que este jugador, propiedad de nuestro club, está cedido A otro equipo (texto tipo "En cesión al...", "Cedido al...", o un escudo de club de destino distinto del propio), false o null si no hay ningún indicio. Nunca puede ser true a la vez que esCesion (son direcciones opuestas).' },
    clubCesionSaliente: { type: Type.STRING, nullable: true, description: 'Solo si esCesionSaliente es true: nombre del club que RECIBE al jugador cedido (el destino), identificado por el texto o el escudo junto a él.' },
    duracionCesionSaliente: { type: Type.STRING, nullable: true, description: 'Solo si esCesionSaliente es true y la tarjeta indica una duración/tiempo restante de cesión: transcribe el texto EXACTO tal como aparece (ej. "11 Meses", "1 Año"), sin redondear.' },
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
- relevancia o rol en la plantilla: busca con atención una etiqueta o icono junto al nombre o la
  posición del jugador con uno de estos textos EXACTOS — "Crucial", "Importante", "Rotación",
  "Esporádico" o "Promesa". Esta etiqueta casi siempre está presente en la tarjeta de Finanzas de
  EA Sports FC (columna de rol junto a la posición): trátala como un dato tan importante como la
  media o la posición, no la dejes en null por defecto — solo devuelve null si de verdad no hay
  ningún texto ni icono de rol visible en la imagen.
- sueldo SEMANAL en euros (el que EA Sports FC llama "Sueldo sem." — si solo ves un sueldo mensual o anual, conviértelo tú mismo a semanal antes de responder)
- valor de mercado en euros

Detección de cesión — DIRECCIÓN (muy importante, revísalo con cuidado antes de rellenar
duración/cláusula; presta atención a la preposición exacta, "del"/"por" es una dirección y
"al" es la contraria):
- CESIÓN ENTRANTE (el jugador viene de fuera, cedido A nuestro club): busca texto como "En
  cesión del [Club]", "Cedido por [Club]", "Cesión de [Club]" — el club mencionado es quien lo
  cede (el dueño real). Si lo encuentras: esCesion = true, clubCesion = ese club de origen, y
  duracionCesion = el texto EXACTO de la duración o tiempo restante que muestre la tarjeta, sin
  normalizar ni redondear a una categoría (ej. si pone "11 Meses" devuelve "11 Meses", no "1
  Temporada"; si pone "5 Meses" devuelve "5 Meses", no "6 Meses") — en una carrera ya avanzada
  ese tiempo restante exacto es el dato real que importa. En este caso NO rellenes
  duracionContrato ni clausulaRescision (van a null): un jugador cedido no tiene esos datos como
  propietario, son del club de origen. esCesionSaliente debe ir a false/null en este caso.
- CESIÓN SALIENTE (el jugador es nuestro pero está cedido FUERA, a otro club): busca texto como
  "En cesión al [Club]", "Cedido al [Club]" — el club mencionado es quien lo RECIBE (el
  destino), no el dueño. Si lo encuentras: esCesionSaliente = true, clubCesionSaliente = ese
  club de destino, y duracionCesionSaliente = el texto EXACTO de la duración/tiempo restante,
  igual de literal que en la cesión entrante. Como el jugador SIGUE siendo nuestro, sí puedes
  rellenar duracionContrato y clausulaRescision si la tarjeta las muestra (siguen siendo datos
  de nuestro contrato con él). esCesion debe ir a false/null en este caso — nunca marques ambas
  direcciones a la vez, son mutuamente excluyentes.
  En cualquiera de las dos direcciones, si el club aparece solo como una abreviatura de 3-4
  letras junto al escudo (p. ej. "VAL", "RMA", "ATM", "BAR"/"FCB", "SEV", "BET", "RSO", "VIL",
  "ATH"), intenta devolver el nombre completo del club en vez de la abreviatura (ej. "Valencia
  CF" en vez de "VAL") si lo reconoces con confianza; si no lo reconoces, devuelve la
  abreviatura tal cual la ves.
- Si NO encuentras ningún indicio de cesión en ninguna dirección: esCesion = false (o null),
  esCesionSaliente = false (o null), clubCesion/duracionCesion/clubCesionSaliente/
  duracionCesionSaliente = null, y en su lugar sí rellena duración de contrato (años restantes
  o fecha de finalización) y cláusula de rescisión en euros si la tarjeta las muestra — es un
  jugador en propiedad (traspaso) sin ninguna cesión activa.

Detección de tarjeta de Academia colada por error (revísalo antes de nada, es prioritario
sobre el resto de reglas): si la imagen en realidad muestra un RANGO de potencial (ej.
"75-94", dos números separados por un guion) en vez de una única media, o es visiblemente la
pantalla de Academia/Jóvenes Promesas del juego, esto NO es una tarjeta de primer equipo: pon
esCanterano = true, potencialCantera = ese rango tal cual (o el número único si no es un
rango), y rellena el resto de campos deportivos que sí veas (nombre, media, posición,
nacionalidad, edad, pierna) con normalidad — pero deja sueldoSemanal, valorMercado,
duracionContrato, clausulaRescision, relevancia, esCesion, clubCesion, duracionCesion,
esCesionSaliente, clubCesionSaliente y duracionCesionSaliente todos a null, un canterano no
tiene esos datos. Si es una tarjeta de primer equipo normal, esCanterano
= false (o null) y potencialCantera = null.

Reglas importantes:
- Todos los importes en euros deben ir como número entero puro, SIN puntos de miles, SIN comas, SIN el símbolo "€" y sin abreviar (ej. escribe 45000000, nunca "45M" ni "45.000.000 €").
- Si un dato no aparece visible en la imagen o no puedes leerlo con confianza, devuelve null en ese campo — no inventes ni adivines valores.
- Prioridad de la extracción: nombre, media y posición principal son los datos que de verdad
  importan. Si están visibles, responde SIEMPRE con el JSON completo aunque falten datos
  secundarios (cláusula, prima, nacionalidad, pierna buena...) — pon esos campos a null en vez
  de fallar la extracción entera por un dato menor que no se ve bien en la foto.
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
    res.status(405).json({ success: false, error: 'method_not_allowed', details: 'Método no permitido.' });
    return;
  }
  if (geminiKeys.length === 0 && groqKeys.length === 0) {
    console.error('Faltan GEMINI_API_KEY/VITE_GEMINI_API_KEY y GROQ_API_KEY en las variables de entorno del proyecto.');
    res.status(500).json({ success: false, error: 'missing_api_key', details: 'El servidor no tiene configurada ninguna clave de IA. Contacta con el administrador.' });
    return;
  }

  const { imageBase64: rawImageBase64, mimeType: rawMimeType, mode: rawMode } = req.body || {};
  if (!rawImageBase64) {
    res.status(400).json({ success: false, error: 'missing_image', details: 'No se recibió ninguna imagen.' });
    return;
  }
  const imageBase64 = sanitizeBase64(rawImageBase64);
  const mimeType = sanitizeMimeType(rawMimeType);
  // "academia" activa el esquema/prompt de canteranos (ver ACADEMY_RESPONSE_SCHEMA/PROMPT);
  // cualquier otro valor (incluido ausente) usa el de primer equipo, el comportamiento previo.
  const isAcademy = rawMode === 'academia';
  const promptText = isAcademy ? ACADEMY_PROMPT : PROMPT;
  const schema = isAcademy ? ACADEMY_RESPONSE_SCHEMA : RESPONSE_SCHEMA;

  const callModel = (ai, model) => ai.models.generateContent({
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
      // Temperatura baja a propósito: queremos una transcripción fiel y determinista de los
      // datos EXACTOS que muestra la tarjeta (nombre, cifras, textos), no una respuesta creativa
      // — reduce además la probabilidad de que el modelo "rellene" un campo con una suposición
      // en vez de devolver null cuando el dato no es legible.
      temperature: 0.1,
    },
  });

  // Motivos por los que merece la pena rotar a la SIGUIENTE clave en vez de rendirse: cuota
  // (diaria o por minuto) agotada en la clave actual, o la propia clave inválida/sin permiso —
  // en ambos casos la imagen en sí no tiene ningún problema, así que reintentarla con otra clave
  // es exactamente lo que hace falta. Cualquier otro fallo (INVALID_ARGUMENT, imagen
  // corrupta...) no se soluciona cambiando de clave, así que ahí se para sin rotar más.
  const KEY_ROTATION_CODES = new Set(['RESOURCE_EXHAUSTED', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'API_KEY_INVALID', 'UNAVAILABLE']);
  const shouldRotateKey = (err) => {
    const code = extractTechnicalCode(err);
    if (KEY_ROTATION_CODES.has(code)) return true;
    return /429|503|quota|resource_exhausted|rate limit|too many requests|api key|invalid/i.test(String(err?.message || ''));
  };

  // --- Nivel 1: Gemini multiclave ---
  let response;
  let lastError;
  if (geminiKeys.length > 0) {
    keyLoop:
    for (let keyIndex = 0; keyIndex < geminiKeys.length; keyIndex++) {
      const ai = new GoogleGenAI({ apiKey: geminiKeys[keyIndex] });
      for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
        try {
          // eslint-disable-next-line no-await-in-loop
          response = await callModel(ai, model);
          lastError = null;
          break keyLoop; // Éxito: no hace falta probar más modelos ni más claves.
        } catch (err) {
          lastError = err;
          // Solo se identifica la clave por su posición en la lista (nunca el valor real) en
          // los logs, para no dejar ninguna clave completa expuesta en la consola de Vercel.
          logGeminiError(`Error llamando a Gemini (clave #${keyIndex + 1} de ${geminiKeys.length}, modelo ${model}):`, err);
        }
      }
      // Ambos modelos fallaron con ESTA clave: si el motivo es de cuota/autenticación, se rota
      // a la siguiente automáticamente; si no, no tiene sentido seguir probando claves
      // distintas para el mismo fallo (p. ej. una imagen que Gemini rechaza por su contenido).
      if (!shouldRotateKey(lastError) || keyIndex === geminiKeys.length - 1) break;
      console.warn(`Clave #${keyIndex + 1} agotada o inválida, rotando a la clave #${keyIndex + 2} de ${geminiKeys.length}...`);
    }
  } else {
    lastError = new Error('MISSING_GEMINI_KEYS');
  }

  // Traduce lo que haya devuelto Gemini (si algo) a "data" ya parseado, o deja "lastError"
  // puesto para que el Nivel 2 (Groq) se active exactamente igual que ante una excepción — un
  // "sin texto legible" o un JSON roto merecen el mismo respaldo que un 429, porque el objetivo
  // final es el mismo: sacar algo aprovechable de esta foto antes de rendirse del todo.
  let data = null;
  if (!lastError) {
    const text = response?.text;
    if (text) {
      try {
        data = parseGeminiJson(text);
      } catch (err) {
        console.error('Respuesta de Gemini no es JSON válido:', text.slice(0, 2000), err);
        lastError = new Error('INVALID_JSON_RESPONSE');
      }
    } else {
      // "finishReason" (SAFETY, MAX_TOKENS, RECITATION...), si Gemini lo trae, es el motivo
      // técnico exacto de por qué no hay texto.
      const finishReason = response?.candidates?.[0]?.finishReason;
      console.error('Gemini respondió sin texto utilizable. finishReason:', finishReason, 'Respuesta completa:', JSON.stringify(response)?.slice(0, 2000));
      lastError = new Error(finishReason ? `EMPTY_RESPONSE_${finishReason}` : 'EMPTY_RESPONSE');
    }
  }

  // --- Nivel 2: Groq Vision multiclave (solo si Gemini no dejó nada aprovechable) ---
  if (!data && groqKeys.length > 0) {
    console.warn(`Gemini no pudo procesar la imagen (${lastError?.message || 'motivo desconocido'}), activando respaldo Groq Vision (${groqKeys.length} clave${groqKeys.length === 1 ? '' : 's'})...`);
    groqLoop:
    for (let groqIndex = 0; groqIndex < groqKeys.length; groqIndex++) {
      for (const groqModel of GROQ_MODELS) {
        try {
          // eslint-disable-next-line no-await-in-loop
          data = await callGroqVision(groqKeys[groqIndex], groqModel, promptText, mimeType, imageBase64);
          lastError = null;
          break groqLoop; // Éxito: no hace falta probar más modelos ni más claves de Groq.
        } catch (err) {
          lastError = err;
          console.error(`Error llamando a Groq (clave #${groqIndex + 1} de ${groqKeys.length}, modelo ${groqModel}):`, err.message);
        }
      }
    }
  }

  if (data) {
    res.status(200).json({ success: true, data });
    return;
  }

  // Ni Gemini ni Groq (si estaba disponible) pudieron sacar nada de esta foto. Diagnóstico
  // transparente: se propaga el código técnico EXACTO del último intento (de cualquiera de los
  // dos proveedores) en vez de enmascararlo detrás de un "service_error" genérico — así el
  // frontend puede mostrar el motivo real bajo cada foto fallida. "rateLimited: true" sigue
  // siendo la señal explícita que usa scanPlayerCard para decidir si reintentar la MISMA foto
  // (cuota excedida o servicio saturado); "EMPTY_RESPONSE*"/"INVALID_JSON_RESPONSE" (imagen de
  // verdad ilegible, no un problema de cuota) se quedan en HTTP 200 y nunca disparan reintento.
  const technicalCode = extractTechnicalCode(lastError);
  const upstreamStatus = lastError?.status ?? lastError?.statusCode ?? lastError?.response?.status;
  const isUnreadable = technicalCode.startsWith('EMPTY_RESPONSE') || technicalCode === 'INVALID_JSON_RESPONSE' || technicalCode === 'GROQ_EMPTY_RESPONSE';
  const isRateLimited = !isUnreadable && (
    technicalCode === 'RESOURCE_EXHAUSTED' || technicalCode === 'UNAVAILABLE'
    || upstreamStatus === 429 || upstreamStatus === 503
    || /429|503|quota|resource_exhausted|rate limit|too many requests/i.test(String(lastError?.message || ''))
  );
  const httpStatus = isUnreadable ? 200 : (isRateLimited ? (upstreamStatus === 503 || technicalCode === 'UNAVAILABLE' ? 503 : 429) : 502);
  res.status(httpStatus).json({
    success: false,
    rateLimited: isRateLimited,
    error: technicalCode,
    details: `${groqKeys.length > 0 ? 'Gemini y Groq' : 'Gemini'} no pudieron procesar esta imagen.`,
  });
}
