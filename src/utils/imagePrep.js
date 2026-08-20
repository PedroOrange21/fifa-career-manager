// Prepara cualquier foto (incluidas las HEIC/HEIF que produce un iPhone por defecto) para el
// escaneo con IA: la redimensiona/comprime a un <canvas> ANTES de que geminiPlayerScan.js la
// pase a base64, tanto para evitar el 502 de Gemini con formatos que no entiende como para no
// superar el límite de payload (~4.5 MB) de las funciones Serverless de Vercel con las fotos de
// 12-48 MP que hacen los iPhone recientes.
//
// Decodificación vía FileReader().readAsDataURL() + <img>.onload, NUNCA createImageBitmap: se
// detectó que en iOS Safari createImageBitmap puede "resolver" con éxito sobre según qué foto de
// la galería sin haber terminado de decodificar el contenido real, produciendo un canvas en
// blanco que luego Gemini reporta como imagen ilegible — un fallo silencioso, sin ninguna
// excepción que capturar, que en un lote entero se veía como TODAS las fotos marcadas "No
// leída" de golpe. FileReader().onload seguido de <img>.onload es la secuencia que garantiza
// que el navegador ya decodificó los píxeles reales antes de pintar nada en el canvas; se
// valida además que naturalWidth/naturalHeight sean mayores que 0 antes de continuar, como red
// de seguridad adicional.
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

// iOS a veces no rellena file.type para HEIC (bug conocido de Safari/WebKit en algunas
// versiones), así que la extensión del nombre de archivo es la comprobación de respaldo.
const isHeic = (file) => {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return HEIC_MIME_TYPES.includes(type) || name.endsWith('.heic') || name.endsWith('.heif');
};

// Redimensionado estricto antes de enviar a la API: ancho/alto máximo 1200px (conservando la
// relación de aspecto) y JPEG a calidad 0.75 — cada foto enviada queda muy por debajo del
// límite de payload, imprescindible para lotes de 20-30 fotos en modo ráfaga sobre una conexión
// móvil.
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.75;

// Lee el archivo como Data URL — FileReader es la vía más compatible en iOS Safari para
// garantizar que el contenido real del archivo (no solo su cabecera) está disponible antes de
// intentar decodificarlo como imagen.
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (readerEvent) => resolve(readerEvent.target.result);
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(file);
});

// Decodifica un Data URL como <img>, validando explícitamente que las dimensiones sean válidas
// antes de darla por buena — si Safari devuelve un onload "exitoso" pero con 0x0, aquí se
// atrapa como el error que realmente es, en vez de dejar pasar un canvas en blanco.
const loadImage = (dataUrl) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    if (!img.naturalWidth || !img.naturalHeight) {
      reject(new Error('Dimensiones de imagen inválidas.'));
      return;
    }
    resolve(img);
  };
  img.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
  img.src = dataUrl;
});

// Decodifica "file" (FileReader + <img>), lo pinta redimensionado en un <canvas> y exporta el
// resultado como Blob JPEG.
async function resizeToCanvasBlob(file) {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const targetWidth = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen.'))), 'image/jpeg', JPEG_QUALITY);
  });
}

export async function prepareImageForScan(file) {
  try {
    const blob = await resizeToCanvasBlob(file);
    return new File([blob], (file.name || 'foto').replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch (err) {
    if (!isHeic(file)) throw err; // No es HEIC: el fallo es otro, no hay nada más que probar.
    console.warn('Decodificación nativa de HEIC no disponible, usando heic2any como respaldo:', err);
  }

  // Respaldo final solo para HEIC en navegadores sin soporte nativo (Chrome/Firefox, que no
  // decodifican HEIC ni siquiera vía <img>): decodifica con el conversor WASM y vuelve a pasar
  // por el mismo redimensionado/compresión de arriba.
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  const convertedFile = new File([convertedBlob], (file.name || 'foto').replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  const blob = await resizeToCanvasBlob(convertedFile);
  return new File([blob], convertedFile.name, { type: 'image/jpeg' });
}
