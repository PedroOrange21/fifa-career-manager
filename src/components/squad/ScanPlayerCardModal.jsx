import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, ShieldAlert, ScanLine } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { scanPlayerCard, mapScanResultToPrefill } from '../../services/geminiPlayerScan';
import { prepareImageForScan } from '../../utils/imagePrep';

// Fases visibles del escaneo, mapeadas a los dos pasos asíncronos reales del proceso
// (prepareImageForScan y scanPlayerCard): como ninguno de los dos reporta progreso real,
// cada fase "repta" hacia su techo sin llegar a tocarlo mientras se espera de verdad, y salta
// al techo exacto en cuanto el paso correspondiente termina — así la barra siempre refleja
// trabajo en curso, nunca se queda parada ni se adelanta a lo que realmente ha terminado.
const PHASES = [
  { ceiling: 25, label: 'Preparando y optimizando imagen...' },
  { ceiling: 50, label: 'Procesando compatibilidad (HEIC/JPEG)...' },
  { ceiling: 85, label: 'Analizando datos con Gemini IA...' },
  { ceiling: 100, label: 'Extrayendo estadísticas y rellenando formulario...' },
];
const getPhaseLabel = (progress) => (PHASES.find((p) => progress < p.ceiling) || PHASES[PHASES.length - 1]).label;

// Cuarto paso de "Fichar Jugador" (tras elegir Escanear con IA en AddPlayerChoiceModal, que a
// su vez llega después de fijar Comprado/Cedido en AddPlayerOperationTypeModal):
// instrucciones + dos formas de aportar la imagen (cámara del móvil o galería), barra de
// progreso mientras se procesa/analiza la foto, y manejo de errores con reintento — sin salir
// nunca de este mismo modal hasta tener un resultado o cancelar. operationType se traslada tal
// cual a mapScanResultToPrefill (la tarjeta nunca indica si el fichaje es en propiedad o
// cedido, eso ya lo decidió el usuario en el paso anterior). onExtracted recibe el objeto
// "prefill" ya traducido a los campos de PlayerForm. onBack (oculto durante el escaneo, igual
// que el cierre) vuelve al paso de Método sin perder el flujo de alta.
export default function ScanPlayerCardModal({ onClose, onExtracted, onBack, operationType }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'error'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stopProgressTimer = () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };
  useEffect(() => stopProgressTimer, []);

  // Sube el progreso acercándose cada vez más despacio a "ceiling" sin llegar nunca a tocarlo,
  // dando sensación de trabajo real en curso mientras dura una promesa de duración desconocida.
  const creepProgressTo = (ceiling) => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => (p >= ceiling - 0.5 ? p : Math.min(ceiling - 0.5, p + Math.max(0.4, (ceiling - p) * 0.08))));
    }, 150);
  };

  // Última fase ("Extrayendo estadísticas..."): a diferencia de las anteriores no espera a
  // ninguna promesa externa, así que se anima con un tramo corto y fijo en vez de "reptar"
  // indefinidamente, para que el 100% sea visible un instante antes de abrir el formulario.
  const animateToComplete = () => new Promise((resolve) => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + 4;
        if (next >= 100) { stopProgressTimer(); setTimeout(resolve, 200); return 100; }
        return next;
      });
    }, 40);
  });

  const processFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus('scanning');
    setProgress(0);

    creepProgressTo(50); // Fases 1-2: preparar/optimizar y compatibilidad HEIC/JPEG.
    let preparedFile;
    try {
      preparedFile = await prepareImageForScan(file);
    } catch (err) {
      // Fallo típico: HEIC corrupto o navegador sin soporte para el decodificador WASM de
      // heic2any. Se sigue intentando con el archivo original en vez de bloquear al usuario —
      // el backend igualmente rechaza tipos MIME desconocidos con un mensaje claro.
      console.error('Error preparando la imagen (conversión/compresión):', err);
      preparedFile = file;
    }
    stopProgressTimer();
    setProgress(50);
    setPreview(URL.createObjectURL(preparedFile));

    creepProgressTo(85); // Fase 3: análisis con Gemini.
    try {
      const extracted = await scanPlayerCard(preparedFile);
      stopProgressTimer();
      setProgress(85);
      await animateToComplete(); // Fase 4: extrayendo estadísticas.
      onExtracted(mapScanResultToPrefill(extracted, operationType));
    } catch (err) {
      stopProgressTimer();
      console.error('Error de /api/scan-player:', err);
      setError(err.message || 'No se pudo analizar la imagen. Inténtalo de nuevo.');
      setStatus('error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={status === 'scanning' ? undefined : onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && status !== 'scanning' && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><ScanLine size={16} /> Escanear con IA</h3>
          </div>
          {status !== 'scanning' && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        {status === 'scanning' ? (
          <div className="flex flex-col items-center gap-4 py-8">
            {preview && <img src={preview} alt="Tarjeta escaneada" className="w-32 h-32 rounded-2xl object-cover border border-border-subtle opacity-60" />}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted">{getPhaseLabel(progress)}</p>
                <span className="text-xs font-black text-blue-400 tabular-nums shrink-0">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-well-strong overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-well border border-border-subtle">
              <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
                Enfoca bien la tarjeta del jugador en la sección <span className="text-fg font-black">Plantilla</span> o <span className="text-fg font-black">Finanzas</span> de tu Modo Carrera (media, posición, sueldo, valor de mercado...) y haz la foto con buena luz, sin recortar los datos.
              </p>
            </div>

            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
                <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Camera size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm text-fg">Tomar Foto</div>
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Usa la cámara de tu móvil ahora mismo.</div>
                </div>
              </button>
              <button type="button" onClick={() => galleryInputRef.current?.click()} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><ImageIcon size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm text-fg">Subir desde Galería</div>
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Elige una captura de pantalla o foto ya guardada.</div>
                </div>
              </button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFileChange} />
          </div>
        )}
      </div>
    </div>
  );
}
