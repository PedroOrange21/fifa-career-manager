import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, ShieldAlert, ScanLine, CopyX, Trash2, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { useClubData } from '../../context/ClubDataContext';
import { scanPlayerCard, mapScanResultToPrefill, mapAcademyScanResultToPrefill, scanPlayerCardsQueue } from '../../services/geminiPlayerScan';
import { prepareImageForScan } from '../../utils/imagePrep';
import { findDuplicatePlayer } from '../../utils/duplicatePlayer';
import AIGlowButton from '../common/AIGlowButton';

const mapByMode = (extracted, mode) => (mode === 'academia' ? mapAcademyScanResultToPrefill(extracted) : mapScanResultToPrefill(extracted));

let queuedPhotoIdCounter = 0;
const nextQueuedPhotoId = () => `cam-${Date.now()}-${queuedPhotoIdCounter++}`;

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

// Progreso del escaneo EN LOTE: a diferencia del individual, aquí sí hay una fase real y
// reportada por scanPlayerCardsQueue (ver onProgress ahí) — 'preparing' (comprimiendo la
// imagen), 'scanning' (llamando a Gemini) o 'retrying' (esperando tras un 429/503 antes de
// reintentar). BATCH_PHASE_FRACTION combina esa fase con el índice de la foto en curso para que
// el % global nunca se quede parado mientras se comprime/reintenta una imagen concreta.
const BATCH_PHASE_FRACTION = { preparing: 0.15, scanning: 0.55, retrying: 0.75 };
const batchPercentFor = (info) => (info ? Math.min(99, Math.round(((info.index + (BATCH_PHASE_FRACTION[info.phase] ?? 0.5)) / info.total) * 100)) : 0);
const batchLabelFor = (info, scanNoun) => {
  if (!info) return 'Preparando lote...';
  if (info.phase === 'preparing') return `Comprimiendo foto ${info.index + 1} de ${info.total}...`;
  if (info.phase === 'retrying') return `⏳ Esperando turno de la IA (reintentando en ${Math.round((info.delayMs || 0) / 1000)}s, intento ${info.attempt} de 3)...`;
  return `Escaneando ${scanNoun} ${info.index + 1} de ${info.total}...`;
};

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
// Modo captura continua de cámara: cada "Tomar Foto" solo dispara UN disparo del propio sistema
// operativo (input capture="environment"), así que en vez de escanear esa foto al momento se va
// acumulando en "cameraQueue" (con miniatura) — el usuario puede seguir pulsando "Hacer otra
// foto" para encadenar varias antes de lanzar el escaneo de todas juntas con "Escanear fotos".
// La galería no necesita esto: ya admite selección múltiple nativa en un solo picker.
// onBack (oculto durante el escaneo, igual que el cierre) vuelve al paso anterior sin perder el
// flujo de alta.
export default function ScanPlayerCardModal({ onClose, onExtracted, onBatchExtracted, onBack, mode = 'primerEquipo', forceBatch = false }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { players } = useClubData();

  const [status, setStatus] = useState('idle'); // 'idle' | 'capturing' | 'scanning' | 'batchScanning' | 'duplicate' | 'error'
  const [progress, setProgress] = useState(0);
  const [batchInfo, setBatchInfo] = useState(null); // { index, total, fileName, phase, attempt?, delayMs? }
  // Lista de detección en directo del escaneo en lote: SOLO se añade una fila cuando
  // scanPlayerCardsQueue reporta la fase 'done'/'failed' de una foto (nunca se pre-rellena con
  // "en cola" para las que faltan) — así crece hacia abajo en orden cronológico estricto
  // (1º, 2º, 3º...) sin reordenarse ni mostrar un muro de fotos pendientes que infle el
  // contenedor. La foto EN CURSO se muestra aparte, en una línea compacta de estado (ver
  // batchInfo más abajo), no como fila de esta lista.
  const [completedEntries, setCompletedEntries] = useState([]); // [{ index, fileName, status: 'done'|'failed', name?, position?, rating?, error? }]
  const scanListRef = useRef(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  // Escaneo individual que resultó ser un posible duplicado de un jugador ya registrado (ver
  // findDuplicatePlayer): se retiene aquí en vez de llamar a onExtracted de inmediato, para
  // poder mostrar el aviso y dejar que el usuario decida si de verdad quiere continuar.
  const [pendingDuplicate, setPendingDuplicate] = useState(null); // { mapped, existing } | null
  // Cola de captura continua de cámara (ver comentario del componente): [{ id, file,
  // previewUrl }]. Solo relevante mientras status === 'capturing'.
  const [cameraQueue, setCameraQueue] = useState([]);
  // Miniatura ampliada a pantalla completa (lightbox): el item de cameraQueue que se está
  // viendo en grande, o null si el visor está cerrado. Vive fuera de cameraQueue para no
  // complicar su forma; solo referencia el item, nunca lo duplica.
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const progressTimerRef = useRef(null);

  const stopProgressTimer = () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
  };
  useEffect(() => stopProgressTimer, []);
  // Las miniaturas de la cola de captura y del escaneo individual son Object URLs: se liberan
  // al desmontar el modal para no acumular memoria en una sesión con muchas fotos encadenadas.
  // Se leen desde un ref (no directamente del estado) porque el efecto solo se registra una vez
  // al montar: sin el ref, su cierre se quedaría con el valor vacío del primer render y nunca
  // liberaría las miniaturas añadidas después.
  const cameraQueueRef = useRef(cameraQueue);
  useEffect(() => { cameraQueueRef.current = cameraQueue; }, [cameraQueue]);
  const previewRef = useRef(preview);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => () => {
    cameraQueueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

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
    // Libera la miniatura de un intento anterior en este mismo modal (p. ej. tras un error y un
    // reintento) antes de crear la nueva, para no acumular Object URLs sin usar.
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(preparedFile); });

    creepProgressTo(85); // Fase 3: análisis con Gemini (incluye reintentos automáticos 429/503).
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
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ''; });
  };

  const processBatch = async (files) => {
    setStatus('batchScanning');
    setBatchInfo({ index: 0, total: files.length, fileName: files[0]?.name || '', phase: 'preparing' });
    setCompletedEntries([]);
    const results = await scanPlayerCardsQueue(files, mode, (info) => {
      setBatchInfo(info);
      if (info.phase === 'done' || info.phase === 'failed') {
        // Append-only: cada foto terminada se añade UNA vez, al final, en el mismo orden en que
        // la cola secuencial las procesa — nunca se reordena ni se reescribe una fila ya pintada.
        setCompletedEntries((prev) => [...prev, {
          index: info.index,
          fileName: info.fileName,
          status: info.phase,
          name: info.name || '',
          position: info.position || '',
          rating: info.rating || '',
          error: info.error,
        }]);
      }
    });
    if (results.succeeded.length === 0) {
      setError('No se pudo extraer ningún dato de las fotos seleccionadas. Inténtalo de nuevo con fotos más nítidas.');
      setStatus('error');
      return;
    }
    onBatchExtracted(results);
  };

  // Autoscroll SUAVE (behavior: 'smooth') del último jugador detectado, acotado al propio
  // contenedor de la lista (scanListRef, con su overflow-y-auto) — nunca scrollIntoView ni
  // window.scrollTo, que arrastrarían toda la ventana/página del móvil en vez de solo esta
  // lista interna.
  useEffect(() => {
    if (!scanListRef.current) return;
    scanListRef.current.scrollTo({ top: scanListRef.current.scrollHeight, behavior: 'smooth' });
  }, [completedEntries]);

  const processFiles = (files) => {
    if (!files.length) return;
    setError('');
    if (files.length === 1 && !forceBatch) processSingleFile(files[0]);
    else processBatch(files);
  };

  // Feedback inmediato al confirmar un lote (galería o "Escanear Fotos" tras modo ráfaga): se
  // pinta la pantalla de progreso YA, en el frame siguiente al toque, y solo entonces arranca
  // el trabajo pesado real (comprimir/leer la primera foto) con un pequeño respiro de 50ms —
  // en Safari, sobre todo con fotos de 12-48 MP, ese trabajo puede tardar lo bastante en
  // arrancar como para que el cambio de pantalla no llegue a pintarse antes, y la app parezca
  // congelada justo después de pulsar el tick.
  const beginProcessing = (files) => {
    if (!files.length) return;
    setError('');
    setStatus(files.length === 1 && !forceBatch ? 'scanning' : 'batchScanning');
    setTimeout(() => processFiles(files), 50);
  };

  // Selección desde galería: admite varias a la vez en un único picker nativo, así que se
  // procesan de inmediato tal cual las entrega el input — no pasa por la cola de captura.
  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    beginProcessing(files);
  };

  // Captura desde cámara: el input capture="environment" solo permite UN disparo por
  // invocación del sistema operativo, así que aquí NO se escanea de inmediato — se añade a
  // cameraQueue con su miniatura y se muestra la pantalla de "X fotos listas para escanear",
  // desde donde se puede seguir encadenando fotos con "Hacer otra foto".
  const handleCameraChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setCameraQueue((prev) => [...prev, { id: nextQueuedPhotoId(), file, previewUrl: URL.createObjectURL(file) }]);
    setStatus('capturing');
  };

  const removeQueuedPhoto = (id) => {
    setViewingPhoto((prev) => (prev?.id === id ? null : prev));
    setCameraQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) setStatus('idle');
      return next;
    });
  };

  const startScanningQueuedPhotos = () => {
    const files = cameraQueue.map((item) => item.file);
    setCameraQueue([]);
    beginProcessing(files);
  };

  const handleClose = () => {
    cameraQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    onClose();
  };

  const isBusy = status === 'scanning' || status === 'batchScanning';
  const batchPercent = batchPercentFor(batchInfo);
  const scanNoun = mode === 'academia' ? 'canterano' : 'jugador';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={isBusy ? undefined : handleClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && !isBusy && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><ScanLine size={16} /> Escanear con IA</h3>
          </div>
          {!isBusy && (
            <button type="button" onClick={handleClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
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

        {status === 'batchScanning' && (
          <div className="space-y-3 py-2">
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted truncate">
                  {scanNoun === 'canterano' ? 'Escaneando Academia' : 'Escaneando plantilla'}
                </p>
                <span className="text-xs font-black text-blue-400 tabular-nums shrink-0">{batchPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-well-strong overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${batchPercent}%` }} />
              </div>
            </div>

            {/* Detectados: crece hacia abajo en orden cronológico estricto (1º, 2º, 3º...),
                solo se añade una fila cuando esa foto YA terminó — nunca se pre-rellena con las
                pendientes, así el contenedor nunca se infla con un muro de "en cola". Altura
                acotada (max-h) + overflow-y-auto propio: el autoscroll de más abajo queda
                contenido aquí dentro, sin arrastrar la ventana/página del móvil. */}
            {completedEntries.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-fg-faint px-1">Detectados ({completedEntries.length})</p>
                <div ref={scanListRef} className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle max-h-48 overflow-y-auto scroll-smooth">
                  {completedEntries.map((entry) => (
                    <div key={entry.index} className="px-3 py-2 flex items-start gap-2">
                      {entry.status === 'done' ? <Check size={13} className="text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-yellow-500 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <span className={`text-[10px] font-bold truncate block ${entry.status === 'done' ? 'text-fg' : 'text-yellow-500'}`}>
                          {entry.status === 'done'
                            ? `${entry.name || 'Sin nombre legible'}${entry.position ? ` · ${entry.position}` : ''}${entry.rating ? ` · ${entry.rating}` : ''}`
                            : '⚠️ No leída'}
                        </span>
                        {/* Diagnóstico transparente: el motivo técnico exacto devuelto por el
                            servidor (ver api/scan-player.js), nunca un "no leída" sin más. */}
                        {entry.status === 'failed' && entry.error && (
                          <span className="text-[8px] font-bold text-fg-faint block truncate">{entry.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estado actual, compacto y fuera de la lista scrollable de arriba: nunca crece, no
                desplaza nada — solo cambia de texto conforme avanza la sub-fase de la foto en
                curso (comprimiendo, escaneando, reintentando...). */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Loader2 size={14} className="text-blue-400 shrink-0 animate-spin" />
              <span className="text-[10px] font-bold text-blue-400 truncate">⏳ {batchLabelFor(batchInfo, scanNoun)}</span>
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

        {status === 'capturing' && (
          <div className="flex flex-col max-h-[75dvh]">
            <p className="shrink-0 text-[10px] font-black uppercase tracking-widest text-fg-muted mb-3">{cameraQueue.length} foto{cameraQueue.length === 1 ? '' : 's'} lista{cameraQueue.length === 1 ? '' : 's'} para escanear</p>
            {/* Rejilla scrolleable con altura acotada: por muchas fotos que se acumulen en modo
                ráfaga, el scroll queda contenido aquí dentro y nunca empuja los botones de
                acción de más abajo fuera de la pantalla. */}
            <div className="grid grid-cols-4 gap-2 overflow-y-auto max-h-[45vh] content-start pr-0.5">
              {cameraQueue.map((item) => (
                <div key={item.id} role="button" tabIndex={0} onClick={() => setViewingPhoto(item)} onKeyDown={(e) => { if (e.key === 'Enter') setViewingPhoto(item); }} className="relative aspect-square rounded-xl overflow-hidden border border-border-subtle group touch-manipulation cursor-pointer">
                  <img src={item.previewUrl} alt="Foto capturada" className="w-full h-full object-cover" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeQueuedPhoto(item.id); }} title="Eliminar" className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity">
                    <Trash2 size={16} className="text-white" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeQueuedPhoto(item.id); }} title="Eliminar" className="absolute top-1 right-1 md:hidden bg-black/70 rounded-full p-1 text-white">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="shrink-0 space-y-2.5 pt-3">
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-dashed border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Camera size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm text-fg">📸 Hacer Otra Foto</div>
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Sigue fotografiando jugadores antes de escanear.</div>
                </div>
              </button>
              <AIGlowButton onClick={startScanningQueuedPhotos}>
                Escanear Fotos ({cameraQueue.length})
              </AIGlowButton>
            </div>
          </div>
        )}

        {!isBusy && status !== 'duplicate' && status !== 'capturing' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-well border border-border-subtle">
              <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
                {mode === 'academia'
                  ? <>Ve en tu juego a <span className="text-fg font-black">Academia &gt; Menú de plantilla &gt; Finanzas</span>, y haz una foto a la información que aparece a la derecha de la pantalla para cada canterano. Puedes disparar foto tras foto con la cámara (modo ráfaga) sin salir a la pantalla de carga entre medias, o subir varias a la vez desde la galería.</>
                  : <>Ve en tu juego a <span className="text-fg font-black">Plantilla &gt; Menú de plantilla &gt; Finanzas</span>, y haz una foto a la información que aparece a la derecha de la pantalla para cada jugador. Puedes disparar foto tras foto con la cámara (modo ráfaga) sin salir a la pantalla de carga entre medias, o subir varias a la vez desde la galería.</>}
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
          </div>
        )}

        {/* Únicos en todo el componente (nunca duplicados por rama de estado): "Hacer Otra
            Foto" durante 'capturing' reutiliza este mismo cameraInputRef con un simple
            .click(), así que basta con que el <input> exista siempre en el DOM. */}
        <input ref={cameraInputRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={handleCameraChange} />
        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryChange} />
      </div>

      {/* Visor de miniatura a pantalla completa: por encima del propio modal (z-160 > z-150),
          con opción de eliminar esa foto concreta antes de lanzar el escaneo. */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setViewingPhoto(null)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={viewingPhoto.previewUrl} alt="Foto ampliada" className="w-full max-h-[80dvh] object-contain rounded-2xl border border-border-subtle" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button type="button" onClick={() => removeQueuedPhoto(viewingPhoto.id)} title="Eliminar esta foto" className="p-2.5 rounded-full bg-red-500/90 text-white hover:bg-red-400 transition-colors touch-manipulation">
                <Trash2 size={18} />
              </button>
              <button type="button" onClick={() => setViewingPhoto(null)} title="Cerrar" className="p-2.5 rounded-full bg-well-strong/90 text-fg hover:bg-well transition-colors touch-manipulation">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
