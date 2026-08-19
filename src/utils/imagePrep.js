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

// Compresión obligatoria en cliente antes de subir cualquier foto a la API: redimensiona a un
// máximo de 1280px de lado y comprime a JPEG con calidad ~0.8, apuntando a un tamaño objetivo
// de 300 KB por foto (maxSizeMB, vía reducción iterativa de calidad de browser-image-
// compression — que ya trabaja internamente sobre un <canvas>, igual que cualquier compresión
// en el navegador). Esto evita los bloqueos de payload de las funciones Serverless de Vercel
// con las fotos de 12-48 MP que hacen los móviles actuales, y acelera mucho la subida en lotes
// grandes (24 fotos de 300 KB pesan una fracción de 24 fotos de varios MB cada una).
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1280,
  initialQuality: 0.8,
  maxSizeMB: 0.3,
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
