// Cliente del escaneo de tarjetas por IA: la llamada real a Gemini vive exclusivamente en
// api/scan-player.js (función Serverless de Vercel) — este módulo NUNCA ve la API key ni
// importa el SDK de Google, solo envía la foto en base64 a ese endpoint propio y traduce la
// respuesta. Antes esta llamada se hacía directo desde el navegador con la clave incrustada
// en el bundle público; se movió al backend porque además de exponer la clave, algunos
// navegadores/redes móviles bloqueaban la petición saliente directa a la API de Google.
import { prepareImageForScan } from '../utils/imagePrep';

// Convierte un File/Blob (foto de cámara o galería) a base64 puro, sin el prefijo
// "data:image/...;base64," que añade FileReader — el endpoint espera el base64 a secas.
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

// Analiza la foto de una tarjeta de jugador vía api/scan-player.js y devuelve el JSON
// extraído (mismas claves que describe ese endpoint). "mode" ('primerEquipo' por defecto o
// 'academia') decide qué esquema/prompt usa el servidor (ver api/scan-player.js) — un
// canterano de la Academia nunca trae términos económicos de primer equipo, así que su
// extracción es deliberadamente más reducida. Lanza un Error con mensaje legible en español si
// algo falla (sin conexión, servidor sin clave configurada, respuesta inválida...), para que la
// UI que llama a esta función pueda mostrarlo directamente al usuario.
export async function scanPlayerCard(file, mode = 'primerEquipo') {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen.');
  const imageBase64 = await fileToBase64(file);

  let response;
  try {
    response = await fetch('/api/scan-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/jpeg', mode }),
    });
  } catch (err) {
    console.error('Error de red llamando a /api/scan-player:', err);
    throw new Error('No se pudo contactar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (err) {
    console.error('Respuesta de /api/scan-player no es JSON válido:', err);
  }

  if (!response.ok) {
    // "details" (si el servidor lo envía, ver api/scan-player.js) recoge el motivo real
    // devuelto por Gemini o el error de parseo — se muestra junto al mensaje genérico para
    // que el usuario pueda copiarlo directamente en un reporte de fallo.
    console.error('Error de /api/scan-player:', payload?.error, payload?.details);
    const base = payload?.error || 'No se pudo analizar la imagen. Inténtalo de nuevo.';
    throw new Error(payload?.details ? `${base} (${payload.details})` : base);
  }
  if (!payload?.data) {
    throw new Error('El servidor no devolvió ningún dato de la imagen.');
  }
  return payload.data;
}

// Traduce el JSON en español devuelto por el endpoint al objeto "prefill" que espera
// PlayerForm. Importante: PlayerForm (toFormState) deriva primaryPosition/secondaryPositions
// únicamente a partir de un array "positions" (principal primero) — pasarlas como claves
// sueltas no tendría ningún efecto.
// El tipo (Comprado o Cedido) ya NO se decide antes de escanear: lo determina la propia IA a
// partir de "esCesion" (ver api/scan-player.js, que busca en la tarjeta un texto tipo "En
// cesión del..."/"Cedido por..." junto al escudo del club de origen). Si detecta cesión, usa
// "clubCesion" y "duracionCesion" para Club de Origen y Duración de Cesión — datos que un
// Comprado normal nunca trae en la tarjeta, así que ni se intentan extraer en ese caso. El
// usuario sigue pudiendo corregir el tipo a mano en la Revisión Final si la IA se equivoca (ver
// restrictTypes en PlayerList, que dependen de "Nuevo Fichaje" en vez de un tipo prefijado).
// "value" (Precio de Compra, lo que el club paga por el traspaso en Comprado) se deja vacío a
// propósito salvo que el usuario ya lo indicara en el paso previo al escaneo (ver
// pendingPreData en PlayerList): no es un dato de la propia tarjeta, sino la cifra que el
// usuario negocia al ficharlo, igual que ya hace "Fichar desde Objetivos" en MarketTab.jsx.
export function mapScanResultToPrefill(extracted) {
  const positions = [extracted.posicionPrincipal, ...(extracted.posicionesSecundarias || [])].filter(Boolean);

  // Autodetección de tarjeta de Academia colada en un lote de Primer Equipo (ver esCanterano
  // en api/scan-player.js): en vez de forzar los campos de primer equipo sobre una tarjeta que
  // en realidad es de un canterano, se reclasifica aquí mismo con el mapeo de Cantera —
  // "reclassified: true" es solo una marca para la UI (BulkScanReviewModal/ScanPlayerCardModal
  // muestran el aviso "Canterano detectado"), nunca se guarda: buildPlayerPayload no la lee.
  if (extracted.esCanterano) {
    return {
      type: 'Cantera',
      name: extracted.nombre || '',
      rating: extracted.media || '',
      potential: extracted.potencialCantera || '',
      positions,
      nationality: extracted.nacionalidad || '',
      age: extracted.edad || '',
      preferredFoot: extracted.piernaBuena === 'Zurdo' ? 'Zurdo' : 'Diestro',
      marketValue: '',
      reclassified: true,
    };
  }

  const common = {
    name: extracted.nombre || '',
    rating: extracted.media || '',
    potential: extracted.potencial || '',
    positions,
    nationality: extracted.nacionalidad || '',
    age: extracted.edad || '',
    preferredFoot: extracted.piernaBuena === 'Zurdo' ? 'Zurdo' : 'Diestro',
    agreedRole: extracted.relevancia || '',
    wage: extracted.sueldoSemanal || '',
    marketValue: extracted.valorMercado || '',
  };

  if (extracted.esCesion) {
    return {
      ...common,
      type: 'Cedido',
      sourceClub: extracted.clubCesion || '',
      originClub: extracted.clubCesion || '',
      loanDuration: extracted.duracionCesion || '1 Temporada',
    };
  }

  // "duracionContrato" puede venir como "3 años", "3", o una fecha — solo nos interesa un
  // número de años entre 1 y 5 (el rango que admite el desplegable de Años de Contrato).
  const contractYearsMatch = String(extracted.duracionContrato || '').match(/\d+/);
  const contractYears = contractYearsMatch ? Math.min(5, Math.max(1, parseInt(contractYearsMatch[0], 10))) : '';
  return {
    ...common,
    type: 'Comprado',
    value: '',
    contractYears,
    releaseClause: extracted.clausulaRescision || '',
  };
}

// Traduce el JSON de una tarjeta de Academia (ver ACADEMY_RESPONSE_SCHEMA en
// api/scan-player.js) al mismo formato de "prefill" que espera PlayerForm, pero solo con los
// campos que existen de verdad en un canterano (type "Cantera"): nunca sueldo, cláusula,
// precio de traspaso, club de procedencia ni relevancia — esos ni siquiera están en el esquema
// de extracción de este modo, así que no hay nada que dejar vacío a propósito aquí.
export function mapAcademyScanResultToPrefill(extracted) {
  const positions = [extracted.posicionPrincipal, ...(extracted.posicionesSecundarias || [])].filter(Boolean);
  return {
    type: 'Cantera',
    name: extracted.nombre || '',
    rating: extracted.media || '',
    potential: extracted.potencial || '',
    positions,
    nationality: extracted.nacionalidad || '',
    age: extracted.edad || '',
    preferredFoot: extracted.piernaBuena === 'Zurdo' ? 'Zurdo' : 'Diestro',
    marketValue: extracted.valorMercado || '',
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Escanea varias fotos EN SECUENCIA (nunca en paralelo: Gemini aplica límites de peticiones
// por segundo, y una cola secuencial da además un progreso real y predecible) — usado tanto por
// la carga masiva con IA de PlayerList/AcademyTab como por los dos bloques de OnboardingWizard.
// Cada foto pasa por el mismo pipeline que un escaneo individual (prepareImageForScan para
// HEIC/compresión, scanPlayerCard, y el mapeo correspondiente al modo), con una pequeña espera
// de seguridad entre llamadas sucesivas a la API (DELAY_BETWEEN_CALLS_MS) para no encadenarlas
// pegadas y arriesgarnos a un 429 de la API de Gemini. onProgress(info) se invoca en cada
// cambio de fase de la foto en curso — { index (0-based), total, fileName, phase } — para que
// la UI pueda mostrar "Procesando jugador/canterano X de N..." con su propia sub-fase.
// Devuelve { succeeded: [prefill, ...], failed: [{ fileName, error }, ...] }: los fallos
// individuales (foto borrosa, respuesta inválida...) no interrumpen el resto de la cola.
const DELAY_BETWEEN_CALLS_MS = 700;
export async function scanPlayerCardsQueue(files, mode, onProgress) {
  const mapper = mode === 'academia' ? mapAcademyScanResultToPrefill : mapScanResultToPrefill;
  const succeeded = [];
  const failed = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const report = (phase) => onProgress?.({ index: i, total: files.length, fileName: file.name, phase });

    try {
      report('preparing');
      let preparedFile;
      try {
        preparedFile = await prepareImageForScan(file);
      } catch (err) {
        console.error('Error preparando la imagen (conversión/compresión):', file.name, err);
        preparedFile = file;
      }

      report('scanning');
      const extracted = await scanPlayerCard(preparedFile, mode);
      succeeded.push(mapper(extracted));
    } catch (err) {
      console.error('Error escaneando la imagen:', file.name, err);
      failed.push({ fileName: file.name, error: err.message || 'No se pudo analizar la imagen.' });
    }

    // No hace falta esperar tras la última: solo se frena entre llamadas consecutivas de verdad.
    if (i < files.length - 1) await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return { succeeded, failed };
}
