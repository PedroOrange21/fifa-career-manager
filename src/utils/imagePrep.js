// Prepara cualquier foto (incluidas las HEIC/HEIF que produce un iPhone por defecto) para el
// escaneo con IA: la convierte a JPEG si hace falta y la redimensiona/comprime ANTES de que
// geminiPlayerScan.js la pase a base64, tanto para evitar el 502 de Gemini con formatos que no
// entiende como para no superar el límite de payload (~4.5 MB) de las funciones Serverless de
// Vercel con las fotos de 48 MP que hacen los iPhone recientes.
//
// Ambas librerías se cargan con import() dinámico: son pesadas (heic2any incluye un decodificador
// HEIF en WASM) y la inmensa mayoría de subidas (Android, capturas de pantalla, cámara de
// escritorio) nunca las necesita, así que no deben formar parte del bundle inicial.

const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

// iOS a veces no rellena file.type para HEIC (bug conocido de Safari/WebKit en algunas
// versiones), así que la extensión del nombre de archivo es la comprobación de respaldo.
const isHeic = (file) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return HEIC_MIME_TYPES.includes(type) || name.endsWith('.heic') || name.endsWith('.heif');
};

// Redimensiona a un máximo de 1200px de lado y comprime a calidad ~0.8, igual que ya hacía
// handleClubLogoUpload para los logos — aquí se reutiliza el mismo umbral para las fotos de
// tarjetas de jugador, que no necesitan más resolución que esa para que Gemini lea el texto.
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1200,
  initialQuality: 0.8,
  maxSizeMB: 3,
  useWebWorker: true,
  fileType: 'image/jpeg',
};

export async function prepareImageForScan(file) {
  let workingFile = file;

  if (isHeic(workingFile)) {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({ blob: workingFile, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    workingFile = new File([blob], (file.name || 'foto').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  }

  const imageCompression = (await import('browser-image-compression')).default;
  return imageCompression(workingFile, COMPRESSION_OPTIONS);
}
