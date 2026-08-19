import { useRef, useState } from 'react';
import { X, ChevronLeft, Video, ShieldAlert } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { extractFramesFromVideo, VideoScanCancelledError } from '../../utils/videoFrames';

// Paso "Escanear con Vídeo": el usuario graba o sube un vídeo corto pasando el joystick por
// toda la plantilla/Academia (unos 20-30 segundos bastan para 20-30 jugadores), y se extraen
// fotogramas EN LOCAL (ver extractFramesFromVideo — Canvas, máx 1080px, 1 fotograma cada 1.5s,
// JPEG 0.75; el vídeo en sí nunca se sube a ningún sitio). Los fotogramas resultantes se
// entregan tal cual a "onFramesExtracted", que el llamador pasa como initialFiles a
// ScanPlayerCardModal — reutilizando ahí el mismo pipeline de escaneo/compresión/reintentos/
// tabla de revisión que una carga de fotos normal, sin duplicar nada de esa lógica aquí.
export default function VideoScanModal({ onClose, onBack, onFramesExtracted, scanNoun = 'jugador' }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const [status, setStatus] = useState('idle'); // 'idle' | 'extracting' | 'error'
  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [error, setError] = useState('');
  const videoInputRef = useRef(null);
  // Botón "Cancelar Escaneo": extractFramesFromVideo comprueba este flag entre cada paso (antes
  // de cada fotograma, tras cada seek) y aborta con VideoScanCancelledError en el siguiente
  // punto de control — así el usuario nunca queda atrapado en "Procesando vídeo..." si un
  // archivo va lento o Safari se atasca, sin tener que recargar toda la web.
  const cancelledRef = useRef(false);

  const handleVideoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    cancelledRef.current = false;
    setStatus('extracting');
    setProgress({ index: 0, total: 0 });
    try {
      const frames = await extractFramesFromVideo(file, {
        onProgress: (info) => setProgress(info),
        isCancelled: () => cancelledRef.current,
      });
      if (frames.length === 0) throw new Error('No se pudo extraer ningún fotograma de ese vídeo.');
      onFramesExtracted(frames);
    } catch (err) {
      if (err instanceof VideoScanCancelledError) {
        // Cancelado a propósito por el usuario: vuelve a la pantalla de selección sin mostrar
        // ningún aviso de error, no es un fallo real.
        setStatus('idle');
        return;
      }
      console.error('Error extrayendo fotogramas del vídeo:', err);
      setError(err.message || 'No se pudo procesar el vídeo. Prueba con otro archivo.');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
  };

  const isBusy = status === 'extracting';
  const percent = progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0;
  const groupLabel = scanNoun === 'canterano' ? 'tu Academia' : 'tu plantilla';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={isBusy ? undefined : onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && !isBusy && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><Video size={16} /> Escanear con Vídeo</h3>
          </div>
          {!isBusy && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        {isBusy ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Video size={28} className="text-blue-400 animate-pulse" />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted">
                  {progress.total > 0 ? `Extrayendo fotograma ${progress.index + 1} de ${progress.total}...` : 'Preparando vídeo...'}
                </p>
                <span className="text-xs font-black text-blue-400 tabular-nums shrink-0">{percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-well-strong overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
              </div>
            </div>
            <button type="button" onClick={handleCancel} className="w-full py-3 rounded-xl bg-well-strong text-fg-muted hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest touch-manipulation">
              <X size={14} /> Cancelar Escaneo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-well border border-border-subtle">
              <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
                Graba o sube un vídeo corto pasando el joystick por {groupLabel} (20-30 segundos suelen bastar). Extraemos los fotogramas en tu propio dispositivo y escaneamos cada {scanNoun} automáticamente — el vídeo nunca se sube a ningún sitio.
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
                <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
              </div>
            )}

            <button type="button" onClick={() => videoInputRef.current?.click()} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Video size={22} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-black uppercase italic text-sm text-fg">Grabar / Subir Vídeo</div>
                <div className="text-[10px] font-bold text-fg-muted mt-0.5">Admite .mp4 y .mov (iPhone 4K/HDR incluido).</div>
              </div>
            </button>

            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="hidden" onChange={handleVideoChange} />
          </div>
        )}
      </div>
    </div>
  );
}
