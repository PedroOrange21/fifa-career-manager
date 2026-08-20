// Prepara cualquier foto (incluidas las HEIC/HEIF que produce un iPhone por defecto) para el
// escaneo con IA: la redimensiona/comprime a un <canvas> ANTES de que geminiPlayerScan.js la
// pase a base64, tanto para evitar el 502 de Gemini con formatos que no entiende como para no
// superar el límite de payload (~4.5 MB) de las funciones Serverless de Vercel con las fotos de
// 12-48 MP que hacen los iPhone recientes — y, crítico en iOS Safari, para no saturar la
// memoria del WebView decodificando esas fotos a resolución completa antes de reducirlas.
//
// Estrategia de decodificación (por qué createImageBitmap/<img> primero, heic2any como
// respaldo): HEIC es el formato nativo de Apple, así que Safari (iOS y macOS) lo decodifica de
// forma nativa vía createImageBitmap/<img> sin pasar por ningún decodificador en JS — mucho más
// ligero en memoria que heic2any, que carga un decodificador HEIF completo en WASM y mantiene
// el bitmap sin comprimir en memoria de JS mientras dura la conversión (con una foto de 48 MP,
// eso son varios cientos de MB solo para esa imagen, un problema real en el WebView de iOS).
// Chrome/Firefox no decodifican HEIC de forma nativa, así que ahí el intento nativo falla y se
// cae a heic2any como respaldo — igual que antes, solo que ya no se usa en Safari, donde no
// hace falta.
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

// iOS a veces no rellena file.type para HEIC (bug conocido de Safari/WebKit en algunas
// versiones), así que la extensión del nombre de archivo es la comprobación de respaldo.
const isHeic = (file) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return HEIC_MIME_TYPES.includes(type) || name.endsWith('.heic') || name.endsWith('.heif');
};

// Redimensionado estricto antes de enviar a la API: ancho/alto máximo 1000px (conservando la
// relación de aspecto) y JPEG a calidad 0.70 — cada foto enviada queda por debajo de los
// ~150 KB objetivo, imprescindible para lotes de 20-30 fotos en modo ráfaga sobre una conexión
// móvil sin bloquear el payload de las funciones Serverless de Vercel.
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.70;

// Carga el archivo como elemento <img> (respaldo cuando no hay createImageBitmap, o cuando
// createImageBitmap del propio archivo falla — p. ej. Chrome/Firefox con un HEIC). El Object
// URL se revoca en cuanto el navegador ya decodificó la imagen (onload/onerror), nunca se deja
// colgado en memoria.
const loadViaImageElement = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo decodificar la imagen.')); };
  img.src = url;
});

const dimensionsOf = (source) => ({
  width: source.naturalWidth || source.width,
  height: source.naturalHeight || source.height,
});

// Decodifica "file" (con createImageBitmap si el navegador lo soporta, o si no con <img>),
// lo pinta redimensionado en un <canvas> y exporta el resultado como Blob JPEG. Libera el
// bitmap nativo (bitmap.close()) en cuanto termina de pintarlo en el canvas, para no retener el
// decodificado a resolución completa más tiempo del imprescindible.
async function resizeToCanvasBlob(file) {
  const canDecodeNatively = typeof createImageBitmap === 'function';
  let source;
  try {
    source = canDecodeNatively ? await createImageBitmap(file) : await loadViaImageElement(file);
  } catch (err) {
    // createImageBitmap puede fallar en un archivo HEIC en navegadores sin soporte nativo del
    // formato (Chrome/Firefox) — se intenta una vez más con <img>, que en algún caso límite
    // logra decodificar donde createImageBitmap no pudo, antes de rendirse del todo.
    source = await loadViaImageElement(file);
  }

  try {
    const { width, height } = dimensionsOf(source);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen.'))), 'image/jpeg', JPEG_QUALITY);
    });
    return blob;
  } finally {
    if (typeof source.close === 'function') source.close();
  }
}

export async function prepareImageForScan(file) {
  try {
    const blob = await resizeToCanvasBlob(file);
    return new File([blob], (file.name || 'foto').replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch (err) {
    if (!isHeic(file)) throw err; // No es HEIC: el fallo es otro, no hay nada más que probar.
    console.warn('Decodificación nativa de HEIC no disponible, usando heic2any como respaldo:', err);
  }

  // Respaldo final solo para HEIC en navegadores sin soporte nativo (Chrome/Firefox): decodifica
  // con el conversor WASM y vuelve a pasar por el mismo redimensionado/compresión de arriba.
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  const convertedFile = new File([convertedBlob], (file.name || 'foto').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  const blob = await resizeToCanvasBlob(convertedFile);
  return new File([blob], convertedFile.name, { type: 'image/jpeg' });
}
