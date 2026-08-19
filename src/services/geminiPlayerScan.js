// Cliente del escaneo de tarjetas por IA: la llamada real a Gemini vive exclusivamente en
// api/scan-player.js (función Serverless de Vercel) — este módulo NUNCA ve la API key ni
// importa el SDK de Google, solo envía la foto en base64 a ese endpoint propio y traduce la
// respuesta. Antes esta llamada se hacía directo desde el navegador con la clave incrustada
// en el bundle público; se movió al backend porque además de exponer la clave, algunos
// navegadores/redes móviles bloqueaban la petición saliente directa a la API de Google.

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
// extraído (mismas claves que describe ese endpoint). Lanza un Error con mensaje legible en
// español si algo falla (sin conexión, servidor sin clave configurada, respuesta inválida...),
// para que la UI que llama a esta función pueda mostrarlo directamente al usuario.
export async function scanPlayerCard(file) {
  if (!file) throw new Error('No se ha seleccionado ninguna imagen.');
  const imageBase64 = await fileToBase64(file);

  let response;
  try {
    response = await fetch('/api/scan-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/jpeg' }),
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
