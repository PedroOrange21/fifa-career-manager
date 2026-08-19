// Extrae fotogramas de un vídeo corto (grabado o subido, .mp4/.mov) EN LOCAL, para poder pasar
// cada fotograma por el mismo pipeline de escaneo que una foto normal — usado por el modo
// "Escanear con Vídeo" del Onboarding y de la carga masiva en Plantilla/Academia (ver
// VideoScanModal.jsx). El vídeo en sí nunca se sube a ningún sitio: todo el trabajo (decodificar,
// buscar por tiempo, pintar en <canvas>, exportar JPEG) ocurre en el propio dispositivo del
// usuario, exactamente igual que el redimensionado de fotos normales en imagePrep.js.

const MAX_DIMENSION = 1080;
const INTERVAL_SECONDS = 1.5;
const JPEG_QUALITY = 0.75;
// Tope de fotogramas por vídeo: un vídeo anormalmente largo (varios minutos) se muestrea de
// forma uniforme en toda su duración en vez de generar cientos de llamadas a Gemini — así se
// sigue cubriendo el vídeo entero, solo que con menos densidad de fotogramas.
const MAX_FRAMES = 80;

const loadVideoElement = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.onloadedmetadata = () => resolve({ video, url });
  video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer el vídeo. Prueba con otro archivo (.mp4 o .mov).')); };
  video.src = url;
});

const seekTo = (video, time) => new Promise((resolve) => {
  const handleSeeked = () => { video.removeEventListener('seeked', handleSeeked); resolve(); };
  video.addEventListener('seeked', handleSeeked);
  video.currentTime = time;
});

// onProgress({ index, total }) se invoca antes de procesar cada fotograma. Devuelve un array de
// File JPEG (uno por fotograma), listos para entrar directamente en scanPlayerCardsQueue igual
// que si vinieran de la galería.
export async function extractFramesFromVideo(file, { onProgress } = {}) {
  const { video, url } = await loadVideoElement(file);
  try {
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error('No se pudo determinar la duración del vídeo.');
    }

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    let timestamps = [];
    for (let t = 0; t < duration; t += INTERVAL_SECONDS) timestamps.push(t);
    if (timestamps.length === 0) timestamps = [0];
    if (timestamps.length > MAX_FRAMES) {
      timestamps = Array.from({ length: MAX_FRAMES }, (_, i) => (duration * i) / MAX_FRAMES);
    }

    const frames = [];
    for (let i = 0; i < timestamps.length; i++) {
      onProgress?.({ index: i, total: timestamps.length });
      // eslint-disable-next-line no-await-in-loop
      await seekTo(video, timestamps[i]);
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      // eslint-disable-next-line no-await-in-loop
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo exportar un fotograma.'))), 'image/jpeg', JPEG_QUALITY);
      });
      frames.push(new File([blob], `fotograma-${String(i + 1).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
