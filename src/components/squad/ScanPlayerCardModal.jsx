import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, ShieldAlert, ScanLine, CopyX } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { useClubData } from '../../context/ClubDataContext';
import { scanPlayerCard, mapScanResultToPrefill, mapAcademyScanResultToPrefill, scanPlayerCardsQueue } from '../../services/geminiPlayerScan';
import { prepareImageForScan } from '../../utils/imagePrep';
import { findDuplicatePlayer } from '../../utils/duplicatePlayer';

const mapByMode = (extracted, mode) => (mode === 'academia' ? mapAcademyScanResultToPrefill(extracted) : mapScanResultToPrefill(extracted));

// Fases visibles del escaneo INDIVIDUAL, mapeadas a los dos pasos asíncronos reales del
// proceso (prepareImageForScan y scanPlayerCard): como ninguno de los dos reporta progreso
// real, cada fase "repta" hacia su techo sin llegar a tocarlo mientras se espera de verdad, y
// salta al techo exacto en cuanto el paso correspondiente termina — así la barra siempre
// refleja trabajo en curso, nunca se queda parada ni se adelanta a lo que realmente ha
// terminado. Solo se usa cuando se escanea UNA foto; con varias, ver "batch" más abajo.
const PHASES = [
  { ceiling: 25, label: 'Preparando y optimizando imagen...' },
  { ceiling: 50, label: 'Procesando compatibilidad (HEIC/JPEG)...' },
  { ceiling: 85, label: 'Analizando datos con Gemini IA...' },
  { ceiling: 100, label: 'Extrayendo estadísticas y rellenando formulario...' },
];
const getPhaseLabel = (progress) => (PHASES.find((p) => progress < p.ceiling) || PHASES[PHASES.length - 1]).label;

// Último paso de "Fichar Jugador" (o del botón "Fichar Canterano" de AcademyTab, o de la carga
// masiva de OnboardingWizard) tras elegir Escanear con IA: instrucciones + dos formas de
// aportar la imagen (cámara del móvil, una foto, o galería, una o varias), barra de progreso
// mientras se procesa/analiza y manejo de errores con reintento — sin salir nunca de este
// mismo modal hasta tener un resultado o cancelar.
// mode ('primerEquipo' por defecto o 'academia') decide qué esquema de Gemini y qué mapper usar
// (ver geminiPlayerScan.js) — un canterano nunca trae términos económicos de primer equipo.
// Con UNA sola foto (y forceBatch=false): onExtracted recibe el "prefill" ya traducido, igual
// que siempre — el llamador suele abrir PlayerForm directamente en la Revisión Final. Con
// varias fotos (o forceBatch=true, usado por la carga masiva de OnboardingWizard incluso con
// una sola foto): se procesan en cola, con una espera de seguridad entre llamadas a la API
// (ver scanPlayerCardsQueue), y el resultado { succeeded, failed } se entrega a onBatchExtracted
// para que el llamador muestre una tabla de revisión y guarde en lote (ver BulkScanReviewModal).
// onBack (oculto durante el escaneo, igual que el cierre) vuelve al paso anterior sin perder el
// flujo de alta.
export default function ScanPlayerCardModal({ onClose, onExtracted, onBatchExtracted, onBack, mode = 'primerEquipo', forceBatch = false }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { players } = useClubData();

  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'batchScanning' | 'duplicate' | 'error'
  const [progress, setProgress] = useState(0);
  const [batchInfo, setBatchInfo] = useState(null); // { index, total, fileName }
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  // Escaneo individual que resultó ser un posible duplicado de un jugador ya registrado (ver
  // findDuplicatePlayer): se retiene aquí en vez de llamar a onExtracted de inmediato, para
  // poder mostrar el aviso y dejar que el usuario decida si de verdad quiere continuar.
  const [pendingDuplicate, setPendingDuplicate] = useState(null); // { mapped, existing } | null
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

  const processSingleFile = async (file) => {
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
      const extracted = await scanPlayerCard(preparedFile, mode);
      stopProgressTimer();
      setProgress(85);
      await animateToComplete(); // Fase 4: extrayendo estadísticas.
      const mapped = mapByMode(extracted, mode);
      // Sistema global anti-duplicados (ver utils/duplicatePlayer.js): antes de precargar el
      // formulario, se compara contra la plantilla ya guardada. Si coincide, se retiene el
      // resultado y se avisa en vez de abrir la Revisión Final directamente — el usuario decide
      // si de verdad quiere continuar (p. ej. dos jugadores homónimos legítimos).
      const existingMatch = findDuplicatePlayer(mapped, players);
      if (existingMatch) {
        setStatus('duplicate');
        setPendingDuplicate({ mapped, existing: existingMatch });
        return;
      }
      onExtracted(mapped);
    } catch (err) {
      stopProgressTimer();
      console.error('Error de /api/scan-player:', err);
      setError(err.message || 'No se pudo analizar la imagen. Inténtalo de nuevo.');
      setStatus('error');
    }
  };

  const confirmDuplicateAnyway = () => {
    if (!pendingDuplicate) return;
    const { mapped } = pendingDuplicate;
    setPendingDuplicate(null);
    setStatus('idle');
    onExtracted(mapped);
  };
  const cancelDuplicate = () => {
    setPendingDuplicate(null);
    setStatus('idle');
    setPreview('');
  };

  const processBatch = async (files) => {
    setStatus('batchScanning');
    setBatchInfo({ index: 0, total: files.length, fileName: files[0]?.name || '' });
    const results = await scanPlayerCardsQueue(files, mode, ({ index, total, fileName }) => {
      setBatchInfo({ index, total, fileName });
    });
    if (results.succeeded.length === 0) {
      setError('No se pudo extraer ningún dato de las fotos seleccionadas. Inténtalo de nuevo con fotos más nítidas.');
      setStatus('error');
      return;
    }
    onBatchExtracted(results);
  };

  const processFiles = (files) => {
    if (!files.length) return;
    setError('');
    if (files.length === 1 && !forceBatch) processSingleFile(files[0]);
    else processBatch(files);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    processFiles(files);
  };

  const isBusy = status === 'scanning' || status === 'batchScanning';
  const batchPercent = batchInfo ? Math.round(((batchInfo.index + 0.5) / batchInfo.total) * 100) : 0;
  const scanNoun = mode === 'academia' ? 'canterano' : 'jugador';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={isBusy ? undefined : onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && !isBusy && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><ScanLine size={16} /> Escanear con IA</h3>
          </div>
          {!isBusy && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        {status === 'scanning' && (
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
        )}

        {status === 'batchScanning' && batchInfo && (
          <div className="flex flex-col items-center gap-4 py-8">
            <ScanLine size={28} className="text-blue-400 animate-pulse" />
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted truncate">
                  Procesando {scanNoun} {batchInfo.index + 1} de {batchInfo.total}...
                </p>
                <span className="text-xs font-black text-blue-400 tabular-nums shrink-0">{batchPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-well-strong overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${batchPercent}%` }} />
              </div>
              <p className="text-[9px] font-bold text-fg-faint text-center truncate">{batchInfo.fileName}</p>
            </div>
          </div>
        )}

        {status === 'duplicate' && pendingDuplicate && (
          <div className="flex flex-col items-center gap-4 py-4">
            {preview && <img src={preview} alt="Tarjeta escaneada" className="w-24 h-24 rounded-2xl object-cover border border-border-subtle" />}
            <div className="w-full bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex gap-2 text-yellow-500">
              <CopyX size={16} className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide">Jugador ya registrado / omitido por duplicado</p>
                <p className="text-[9px] font-bold text-yellow-500/80 mt-1">{pendingDuplicate.mapped.name} coincide con «{pendingDuplicate.existing.name}», ya en tu plantilla ({pendingDuplicate.existing.positions?.[0] || '—'}{pendingDuplicate.existing.age ? `, ${pendingDuplicate.existing.age} años` : ''}).</p>
              </div>
            </div>
            <div className="w-full flex gap-2">
              <button type="button" onClick={cancelDuplicate} className="flex-1 py-3 rounded-xl bg-well-strong text-fg font-black uppercase text-[10px] hover:brightness-125 transition-all touch-manipulation">Cancelar</button>
              <button type="button" onClick={confirmDuplicateAnyway} className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-black uppercase text-[10px] hover:bg-yellow-400 transition-all touch-manipulation">Continuar de Todas Formas</button>
            </div>
          </div>
        )}

        {!isBusy && status !== 'duplicate' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-well border border-border-subtle">
              <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
                {mode === 'academia'
                  ? <>Enfoca bien la tarjeta del canterano en la sección <span className="text-fg font-black">Academia</span> de tu Modo Carrera (media, potencial, posición...) y haz la foto con buena luz. Puedes subir varias fotos a la vez desde la galería para dar de alta a toda la remesa.</>
                  : <>Enfoca bien la tarjeta del jugador en la sección <span className="text-fg font-black">Plantilla</span> o <span className="text-fg font-black">Finanzas</span> de tu Modo Carrera (media, posición, sueldo, valor de mercado...) y haz la foto con buena luz, sin recortar los datos. Puedes subir varias fotos a la vez desde la galería.</>}
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
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Una foto, o varias a la vez para cargar en lote.</div>
                </div>
              </button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleFileChange} />
          </div>
        )}
      </div>
    </div>
  );
}
