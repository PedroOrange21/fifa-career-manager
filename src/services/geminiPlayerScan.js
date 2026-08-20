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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mensajes legibles para cada código de "error" que puede devolver api/scan-player.js (ver
// contrato uniforme { success: true, data } / { success: false, error, details?, rateLimited? }
// ahí mismo) — "rateLimited: true" se comprueba aparte (ver scanPlayerCardOnce), nunca por el
// texto exacto de "error", que en ese caso viaja en inglés tal cual lo pide la cuota de Gemini.
const FRIENDLY_ERROR_MESSAGES = {
  unreadable: 'No se pudo leer ningún dato en esta foto. Prueba con una imagen más nítida y bien encuadrada.',
  service_error: 'No se pudo analizar la imagen. Inténtalo de nuevo.',
  missing_image: 'No se ha seleccionado ninguna imagen.',
  missing_api_key: 'El servidor no tiene configurada la clave de Gemini. Contacta con el administrador.',
  method_not_allowed: 'Petición no válida.',
};

// Llamada única (sin reintentos) a api/scan-player.js — usada solo internamente por
// scanPlayerCard, que es quien añade la resiliencia frente a límites de cuota (ver más abajo).
async function scanPlayerCardOnce(file, mode) {
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

  // Contrato uniforme del endpoint: { success: true, data } o { success: false, error,
  // details?, rateLimited? } — "status" y "rateLimited" quedan colgados del Error para que
  // scanPlayerCard sepa si merece la pena reintentar la MISMA foto (cuota de Gemini
  // temporalmente excedida) o si es un fallo definitivo (imagen ilegible, configuración del
  // servidor...). "rateLimited" es una señal explícita en el propio cuerpo, independiente del
  // código HTTP (que también se propaga como 429/503 reales) — doble comprobación por si algún
  // proxy intermedio reescribiera el status. Antes de este contrato, un 429 real de Gemini se
  // aplanaba siempre a un 502 genérico y el reintento nunca llegaba a dispararse — con lotes
  // cerca de las 15 RPM de esta clave, eso hacía que TODO el lote acabara marcado "No leída".
  if (!response.ok || !payload?.success) {
    console.error('Error de /api/scan-player:', payload?.error, payload?.details);
    const rateLimited = payload?.rateLimited === true;
    const err = new Error(rateLimited ? 'Límite de peticiones de Gemini alcanzado.' : (FRIENDLY_ERROR_MESSAGES[payload?.error] || payload?.details || 'No se pudo analizar la imagen. Inténtalo de nuevo.'));
    err.status = response.status;
    err.rateLimited = rateLimited;
    throw err;
  }
  if (!payload.data) {
    throw new Error('El servidor no devolvió ningún dato de la imagen.');
  }
  return payload.data;
}

// Códigos que indican un límite de cuota TEMPORAL de Gemini (demasiadas peticiones por minuto —
// esta clave tiene un límite de 15 RPM — o el modelo saturado un instante) — merece la pena
// reintentar tras una espera. Cualquier otro error (imagen ilegible, red caída, 4xx de
// validación...) es definitivo y no se reintenta.
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_SCAN_RETRIES = 3;
// Espera fija (no exponencial) entre reintentos: con 15 RPM de cuota, 6 segundos ya deja pasar
// margen de sobra dentro de la misma ventana de un minuto sin necesidad de esperas crecientes.
const RETRY_DELAY_MS = 6000;

// Analiza la foto de una tarjeta de jugador vía api/scan-player.js y devuelve el JSON
// extraído (mismas claves que describe ese endpoint). "mode" ('primerEquipo' por defecto o
// 'academia') decide qué esquema/prompt usa el servidor (ver api/scan-player.js) — un
// canterano de la Academia nunca trae términos económicos de primer equipo, así que su
// extracción es deliberadamente más reducida. Lanza un Error con mensaje legible en español si
// algo falla (sin conexión, servidor sin clave configurada, respuesta inválida...), para que la
// UI que llama a esta función pueda mostrarlo directamente al usuario.
// Reintento automático ante un 429/503 (límite de peticiones por minuto de Gemini, muy real en
// lotes grandes): NUNCA se marca la foto como "no leída" a la primera — se reintenta hasta
// MAX_SCAN_RETRIES veces con una espera fija de RETRY_DELAY_MS antes de darla por fallida de
// verdad. "onRetry(attempt, delayMs)" es opcional, para que la UI pueda avisar ("⏳ Esperando
// turno de IA...") en vez de quedarse muda mientras se reintenta la MISMA foto.
export async function scanPlayerCard(file, mode = 'primerEquipo', onRetry) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen.');
  let lastErr;
  for (let attempt = 0; attempt <= MAX_SCAN_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await scanPlayerCardOnce(file, mode);
    } catch (err) {
      lastErr = err;
      if (attempt >= MAX_SCAN_RETRIES || !(err.rateLimited || RETRYABLE_STATUSES.has(err.status))) throw err;
      onRetry?.(attempt + 1, RETRY_DELAY_MS);
      // eslint-disable-next-line no-await-in-loop
      await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

// Diccionario de códigos de 3-4 letras -> nombre completo del club, para resolver el "Club de
// Origen" de una cesión cuando la tarjeta solo muestra la abreviatura (p. ej. "VAL" en vez de
// "Valencia CF"). El prompt de Gemini (ver api/scan-player.js) ya intenta resolverlo por
// contexto o escudo, pero esto normaliza el resultado con independencia de lo que devuelva
// literalmente — si Gemini ya entregó un nombre completo que no coincide con ninguna clave de
// aquí, se deja tal cual (fallback a `value` en resolveClubName).
const CLUB_ABBREVIATIONS = {
  VAL: 'Valencia CF', RMA: 'Real Madrid', ATM: 'Atlético de Madrid', BAR: 'FC Barcelona', FCB: 'FC Barcelona',
  SEV: 'Sevilla FC', BET: 'Real Betis', RSO: 'Real Sociedad', VIL: 'Villarreal CF', ATH: 'Athletic Club',
  CEL: 'RC Celta', ESP: 'RCD Espanyol', GET: 'Getafe CF', GIR: 'Girona FC', OSA: 'CA Osasuna',
  RAY: 'Rayo Vallecano', ALA: 'Deportivo Alavés', MLL: 'RCD Mallorca', LEG: 'CD Leganés', VLD: 'Real Valladolid',
};
const resolveClubName = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  return CLUB_ABBREVIATIONS[value.toUpperCase()] || value;
};

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
    const clubName = resolveClubName(extracted.clubCesion);
    return {
      ...common,
      type: 'Cedido',
      sourceClub: clubName,
      originClub: clubName,
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

// Escanea varias fotos EN SECUENCIA (nunca en paralelo, concurrency = 1: Gemini aplica límites
// de peticiones por minuto, y una cola secuencial da además un progreso real y predecible) —
// usado tanto por la carga masiva con IA de PlayerList/AcademyTab como por los dos bloques de
// OnboardingWizard. Cada foto pasa por el mismo pipeline que un escaneo individual
// (prepareImageForScan para HEIC/compresión, scanPlayerCard con sus reintentos automáticos
// ante 429/503, y el mapeo correspondiente al modo), con una espera de seguridad de 4,5
// segundos entre la finalización de un jugador y la llamada del siguiente — con la cuota de 15
// peticiones por minuto (RPM) del plan gratuito de Gemini (4 segundos exactos de margen teórico
// entre llamadas), ir más rápido dispara 429 en cuanto el lote pasa de unas pocas fotos.
// onProgress(info) se invoca en cada cambio de fase de la foto en curso — { index (0-based),
// total, fileName, phase, attempt?, delayMs?, name?, position?, rating?, error? } — phase es
// 'preparing' (comprimiendo), 'scanning' (llamando a Gemini), 'retrying' (esperando tras un
// 429/503 antes de reintentar, con attempt/delayMs del intento en curso), 'done' (terminó con
// éxito, "name"/"position"/"rating" del jugador detectado — pueden venir vacíos en una lectura
// parcial) o 'failed' (terminó sin aprovechar nada, "error" trae el motivo) — para que la UI
// pueda mostrar un texto y un porcentaje específicos de cada sub-fase, y una lista en directo
// tipo "✅ Fulano · DC · 84" que se añade al final conforme cada foto termina, en vez de un
// "procesando..." genérico.
// Tolerancia a fallos por imagen (cola con try/catch, nunca Promise.all: una imagen que
// truena no debe tirar abajo el resto del lote): cada resultado logrado, incluso si viene
// incompleto (p. ej. sin nombre legible), se añade a "succeeded" con su fileName — es la propia
// UI de revisión (BulkScanReviewModal) la que decide si mostrarlo como "lectura parcial" y
// dejar que el usuario lo complete a mano o lo descarte, en vez de perderlo aquí en silencio.
// Solo una excepción real ya sin reintentos posibles (red caída, respuesta inválida, o un
// 429/503 persistente tras MAX_SCAN_RETRIES) va a "failed": { fileName, error, file } — "file"
// es el File original (nunca el comprimido, por si prepareImageForScan fue justo lo que falló),
// conservado para que la revisión pueda mostrar la miniatura de la foto que no se pudo leer.
const DELAY_BETWEEN_CALLS_MS = 4500;
export async function scanPlayerCardsQueue(files, mode, onProgress) {
  const mapper = mode === 'academia' ? mapAcademyScanResultToPrefill : mapScanResultToPrefill;
  const succeeded = [];
  const failed = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const report = (phase, extra) => onProgress?.({ index: i, total: files.length, fileName: file.name, phase, ...extra });

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
      const extracted = await scanPlayerCard(preparedFile, mode, (attempt, delayMs) => report('retrying', { attempt, delayMs }));
      const mapped = { ...mapper(extracted), fileName: file.name };
      succeeded.push(mapped);
      report('done', { name: mapped.name || '', position: mapped.positions?.[0] || '', rating: mapped.rating || '' });
    } catch (err) {
      console.error('Error escaneando la imagen:', file.name, err);
      failed.push({ fileName: file.name, error: err.message || 'No se pudo analizar la imagen.', file });
      report('failed', { error: err.message || 'No se pudo analizar la imagen.' });
    }

    // No hace falta esperar tras la última: solo se frena entre llamadas consecutivas de verdad.
    if (i < files.length - 1) await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  return { succeeded, failed };
}
