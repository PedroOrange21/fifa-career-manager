// Extrae fotogramas de un vídeo corto (grabado o subido, .mp4/.mov) EN LOCAL, para poder pasar
// cada fotograma por el mismo pipeline de escaneo que una foto normal — usado por el modo
// "Escanear con Vídeo" del Onboarding y de la carga masiva en Plantilla/Academia (ver
// VideoScanModal.jsx). El vídeo en sí nunca se sube a ningún sitio: todo el trabajo (decodificar,
// buscar por tiempo, pintar en <canvas>, exportar JPEG) ocurre en el propio dispositivo del
// usuario, exactamente igual que el redimensionado de fotos normales en imagePrep.js.
//
// Notas de compatibilidad con iOS Safari (motivo de la mayoría de las protecciones de este
// archivo): Safari puede tardar mucho en decodificar metadata de vídeos HEVC/4K/HDR, o no
// disparar nunca el evento "seeked" tras mover currentTime en según qué versión — sin los
// timeouts de seguridad de abajo, cualquiera de los dos casos deja el bucle esperando para
// siempre y la pantalla de "Procesando vídeo..." nunca avanza. También hay versiones de Safari
// que no decodifican de forma fiable un <video> que nunca se adjuntó al DOM, así que aquí se
// mantiene oculto pero dentro del documento mientras dura la extracción.

const MAX_DIMENSION = 1080;
const INTERVAL_SECONDS = 1.5;
const JPEG_QUALITY = 0.75;
// Tope de fotogramas por vídeo: un vídeo anormalmente largo (varios minutos) se muestrea de
// forma uniforme en toda su duración en vez de generar cientos de llamadas a Gemini — así se
// sigue cubriendo el vídeo entero, solo que con menos densidad de fotogramas.
const MAX_FRAMES = 80;
// Si "loadedmetadata" no llega en este plazo (vídeo corrupto, formato no soportado, o Safari
// atascado decodificando), se rinde con un mensaje claro en vez de colgar la pantalla para
// siempre.
const METADATA_TIMEOUT_MS = 15000;
// Red de seguridad por fotograma: si "seeked" no llega a tiempo (visto en algunas versiones de
// iOS Safari), se sigue adelante igualmente con el frame que haya en pantalla en ese instante
// en vez de bloquear el resto del vídeo por un solo fotograma problemático.
const SEEK_TIMEOUT_MS = 2500;

// Marca especial (no un fallo real) para que el llamador distinga "el usuario canceló" de un
// error genuino y no le muestre un aviso rojo de "no se pudo procesar el vídeo".
export class VideoScanCancelledError extends Error {
  constructor() {
    super('Escaneo de vídeo cancelado.');
    this.name = 'VideoScanCancelledError';
  }
}

const loadVideoElement = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = false;
  video.preload = 'auto';
  // Atributos HTML explícitos, no solo propiedades JS: algunas versiones de iOS Safari solo
  // respetan playsinline/webkit-playsinline/muted como atributos del propio elemento.
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  // Oculto pero dentro del documento (ver nota de compatibilidad arriba); se retira del DOM en
  // el finally de extractFramesFromVideo o en el propio error de esta función.
  video.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);

  let settled = false;
  const finish = (fn) => {
    if (settled) return;
    settled = true;
    video.removeEventListener('loadedmetadata', handleLoaded);
    video.removeEventListener('error', handleError);
    clearTimeout(timer);
    fn();
  };
  const handleLoaded = () => finish(() => resolve({ video, url }));
  const handleError = () => finish(() => {
    video.remove();
    URL.revokeObjectURL(url);
    reject(new Error('No se pudo leer el vídeo. Prueba con otro archivo (.mp4 o .mov).'));
  });
  const timer = setTimeout(() => finish(() => {
    video.remove();
    URL.revokeObjectURL(url);
    reject(new Error('El vídeo tardó demasiado en cargar. Prueba con un archivo más corto o en otro formato.'));
  }), METADATA_TIMEOUT_MS);

  video.addEventListener('loadedmetadata', handleLoaded);
  video.addEventListener('error', handleError);
  video.src = url;
  video.load();
});

// Resuelve en cuanto llega "seeked" tras mover currentTime, o tras SEEK_TIMEOUT_MS como red de
// seguridad — nunca rechaza, para que un solo fotograma problemático no tire abajo el resto del
// vídeo (se sigue adelante con el frame que haya en pantalla en ese instante).
const seekTo = (video, time) => new Promise((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    video.removeEventListener('seeked', handleSeeked);
    clearTimeout(timer);
    resolve();
  };
  const handleSeeked = () => finish();
  video.addEventListener('seeked', handleSeeked);
  const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
  try {
    video.currentTime = time;
  } catch (err) {
    finish();
  }
});

// onProgress({ index, total }) se invoca antes de procesar cada fotograma. "isCancelled" es una
// función opcional que, si devuelve true, aborta la extracción en el siguiente punto de control
// (lanzando VideoScanCancelledError) — usada por el botón "Cancelar Escaneo" del modal. Devuelve
// un array de File JPEG (uno por fotograma), listos para entrar directamente en
// scanPlayerCardsQueue igual que si vinieran de la galería.
export async function extractFramesFromVideo(file, { onProgress, isCancelled } = {}) {
  const { video, url } = await loadVideoElement(file);
  try {
    if (isCancelled?.()) throw new VideoScanCancelledError();

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error('No se pudo determinar la duración del vídeo. Prueba con otro archivo.');
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
      if (isCancelled?.()) throw new VideoScanCancelledError();
      onProgress?.({ index: i, total: timestamps.length });
      // eslint-disable-next-line no-await-in-loop
      await seekTo(video, timestamps[i]);
      if (isCancelled?.()) throw new VideoScanCancelledError();
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
    video.remove();
  }
}
