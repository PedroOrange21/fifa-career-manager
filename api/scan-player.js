import { GoogleGenAI, Type } from '@google/genai';

// Función Serverless de Vercel (Node.js runtime, ver package.json "type": "module"): la única
// pieza de la app que conoce la clave de Gemini. El frontend nunca ve GEMINI_API_KEY/
// VITE_GEMINI_API_KEY — solo llama a este endpoint con la imagen ya en base64 (ver
// src/services/geminiPlayerScan.js). "VITE_GEMINI_API_KEY" se acepta como alias porque el
// proyecto ya tenía esa variable configurada en Vercel desde la integración anterior
// (client-side); las funciones Serverless leen cualquier variable del proyecto vía
// process.env sin importar el prefijo "VITE_", que solo afecta al bundle del navegador.
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// gemini-2.5-flash es el modelo objetivo; si la cuenta/región no tiene acceso a él o Google lo
// retira temporalmente, se reintenta una vez con gemini-1.5-flash antes de rendirse — así un
// problema puntual del modelo no tumba el escaneo por completo.
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

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
    posicionPrincipal: { type: Type.STRING, nullable: true, description: 'Abreviatura de la posición principal (ej. DC, MC, LD, POR).' },
    posicionesSecundarias: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: 'Abreviaturas de posiciones secundarias, si las muestra la tarjeta.' },
    nacionalidad: { type: Type.STRING, nullable: true },
    edad: { type: Type.INTEGER, nullable: true },
    altura: { type: Type.INTEGER, nullable: true, description: 'Altura en centímetros (convierte desde pies/pulgadas si hace falta).' },
    peso: { type: Type.INTEGER, nullable: true, description: 'Peso en kilogramos (convierte desde libras si hace falta).' },
    piernaBuena: { type: Type.STRING, enum: ['Diestro', 'Zurdo'], nullable: true },
    estado: { type: Type.STRING, nullable: true, description: 'Etiqueta de estado/humor del jugador si aparece (ej. Feliz, Descontento, Quiere salir).' },
    relevancia: { type: Type.STRING, enum: ['Clave', 'Importante', 'Rotación', 'Esporádico', 'Promesa'], nullable: true, description: 'Rol/relevancia en la plantilla si la tarjeta lo indica.' },
    sueldoSemanal: { type: Type.INTEGER, nullable: true, description: 'Sueldo SEMANAL en euros, solo el número (sin puntos, comas ni símbolo de moneda).' },
    valorMercado: { type: Type.INTEGER, nullable: true, description: 'Valor de mercado en euros, solo el número.' },
    duracionContrato: { type: Type.STRING, nullable: true, description: 'Duración de contrato tal como aparece (años restantes o fecha de finalización).' },
    clausulaRescision: { type: Type.INTEGER, nullable: true, description: 'Cláusula de rescisión en euros, solo el número.' },
    clausulaReventa: { type: Type.INTEGER, nullable: true, description: 'Porcentaje de cláusula de reventa, solo el número (ej. 20 para 20%).' },
    primasExtra: { type: Type.INTEGER, nullable: true, description: 'Primas extra/objetivos en euros, solo el número.' },
    primaFichaje: { type: Type.INTEGER, nullable: true, description: 'Prima de fichaje en euros, solo el número.' },
  },
};

const PROMPT = `Eres un asistente experto en leer tarjetas de jugador del videojuego EA Sports FC (Modo Carrera), tal como se muestran en las pantallas de Plantilla o en el detalle económico de Finanzas/Oficina.

Analiza la imagen adjunta y extrae ÚNICAMENTE los datos que aparezcan visibles en la tarjeta, con la máxima precisión posible:
- nombre completo del jugador
- media/valoración general (OVR)
- posición principal (abreviatura, ej. DC, MC, LD, POR)
- posiciones secundarias (si las hay)
- nacionalidad
- edad
- altura (en centímetros)
- peso (en kilogramos)
- pierna buena (Diestro o Zurdo)
- estado o etiqueta de humor/satisfacción del jugador, si aparece
- relevancia o rol en la plantilla (Clave, Importante, Rotación, Esporádico o Promesa), si aparece
- sueldo SEMANAL en euros (el que EA Sports FC llama "Sueldo sem." — si solo ves un sueldo mensual o anual, conviértelo tú mismo a semanal antes de responder)
- valor de mercado en euros
- duración de contrato (años restantes o fecha)
- cláusula de rescisión en euros
- cláusula de reventa en porcentaje
- primas extra/objetivos en euros
- prima de fichaje en euros

Reglas importantes:
- Todos los importes en euros deben ir como número entero puro, SIN puntos de miles, SIN comas, SIN el símbolo "€" y sin abreviar (ej. escribe 45000000, nunca "45M" ni "45.000.000 €").
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
