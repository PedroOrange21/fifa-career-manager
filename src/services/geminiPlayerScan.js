import { GoogleGenAI, Type } from '@google/genai';

// Clave leída de .env.local (VITE_GEMINI_API_KEY, ver README) — nunca se sube a GitHub, ya
// cubierta por la regla "*.local" de .gitignore. El cliente se crea de forma perezosa (no en
// el import) para que la app pueda arrancar igualmente aunque la clave no esté configurada
// todavía; el error real solo aparece si el usuario intenta escanear una tarjeta.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
let client = null;
const getClient = () => {
  if (!apiKey) throw new Error('Falta configurar VITE_GEMINI_API_KEY en .env.local para poder escanear tarjetas con IA.');
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
};

const MODEL = 'gemini-2.5-flash';

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

// Convierte un File/Blob (foto de cámara o galería) a base64 puro, sin el prefijo
// "data:image/...;base64," que añade FileReader — Gemini espera el base64 a secas en
// inlineData.data.
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    const commaIdx = result.indexOf(',');
    resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
  };
  reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
  reader.readAsDataURL(file);
});

// Analiza la foto de una tarjeta de jugador y devuelve el JSON extraído (con las claves
// exactas del esquema de arriba). Lanza un Error con mensaje legible en español si algo falla
// (sin API key configurada, respuesta vacía, JSON inválido, error de red...), para que la UI
// que llama a esta función pueda mostrarlo directamente al usuario.
export async function scanPlayerCard(file) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen.');
  const ai = getClient();
  const base64Data = await fileToBase64(file);

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType: file.type || 'image/jpeg', data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });
  } catch (err) {
    console.error('Error llamando a Gemini:', err);
    throw new Error('No se pudo contactar con Gemini. Comprueba tu conexión y la clave de API.');
  }

  const text = response?.text;
  if (!text) throw new Error('Gemini no devolvió ningún dato legible de la imagen. Prueba con una foto más nítida y bien encuadrada.');

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Respuesta de Gemini no es JSON válido:', text, err);
    throw new Error('La respuesta de Gemini no tuvo el formato esperado. Inténtalo de nuevo.');
  }
}

// Traduce el JSON en español devuelto por Gemini al objeto "prefill" que espera PlayerForm.
// Importante: PlayerForm (toFormState) deriva primaryPosition/secondaryPositions únicamente a
// partir de un array "positions" (principal primero) — pasarlas como claves sueltas no tendría
// ningún efecto. "value" (Precio de Compra, lo que el club paga por el traspaso) se deja vacío
// a propósito: no es un dato de la propia tarjeta del jugador, sino la cifra que el usuario
// negocia al ficharlo, igual que ya hace "Fichar desde Objetivos" en MarketTab.jsx.
export function mapScanResultToPrefill(extracted) {
  const positions = [extracted.posicionPrincipal, ...(extracted.posicionesSecundarias || [])].filter(Boolean);
  // "duracionContrato" puede venir como "3 años", "3", o una fecha — solo nos interesa un
  // número de años entre 1 y 5 (el rango que admite el desplegable de Años de Contrato).
  const contractYearsMatch = String(extracted.duracionContrato || '').match(/\d+/);
  const contractYears = contractYearsMatch ? Math.min(5, Math.max(1, parseInt(contractYearsMatch[0], 10))) : '';

  return {
    type: 'Comprado',
    name: extracted.nombre || '',
    rating: extracted.media || '',
    positions,
    nationality: extracted.nacionalidad || '',
    age: extracted.edad || '',
    height: extracted.altura || '',
    weight: extracted.peso || '',
    preferredFoot: extracted.piernaBuena === 'Zurdo' ? 'Zurdo' : 'Diestro',
    statusNote: extracted.estado || '',
    agreedRole: extracted.relevancia || '',
    wage: extracted.sueldoSemanal || '',
    marketValue: extracted.valorMercado || '',
    value: '',
    contractYears,
    releaseClause: extracted.clausulaRescision || '',
    resaleClausePercent: extracted.clausulaReventa || '',
    extraBonuses: extracted.primasExtra || '',
    signingBonus: extracted.primaFichaje || '',
  };
}
