import { useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, RefreshCcw, ShieldAlert, ScanLine } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { scanPlayerCard, mapScanResultToPrefill } from '../../services/geminiPlayerScan';
import { prepareImageForScan } from '../../utils/imagePrep';

// Tercer paso de "Fichar Jugador" (tras elegir Escanear con IA en AddPlayerChoiceModal):
// instrucciones + dos formas de aportar la imagen (cámara del móvil o galería), indicador de
// carga mientras se procesa/analiza la foto, y manejo de errores con reintento — sin salir
// nunca de este mismo modal hasta tener un resultado o cancelar. onExtracted recibe el objeto
// "prefill" ya traducido a los campos de PlayerForm. onBack (oculto durante el procesado/
// análisis, igual que el cierre) vuelve al paso de Método sin perder el flujo de alta.
export default function ScanPlayerCardModal({ onClose, onExtracted, onBack }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const [status, setStatus] = useState('idle'); // 'idle' | 'processing' | 'loading' | 'error'
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setError('');
    setStatus('processing');

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

    setPreview(URL.createObjectURL(preparedFile));
    setStatus('loading');
    try {
      const extracted = await scanPlayerCard(preparedFile);
      onExtracted(mapScanResultToPrefill(extracted));
    } catch (err) {
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
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={status === 'loading' || status === 'processing' ? undefined : onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && status !== 'loading' && status !== 'processing' && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><ScanLine size={16} /> Escanear con IA</h3>
          </div>
          {status !== 'loading' && status !== 'processing' && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        {status === 'processing' || status === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-8">
            {preview && <img src={preview} alt="Tarjeta escaneada" className="w-32 h-32 rounded-2xl object-cover border border-border-subtle opacity-60" />}
            <RefreshCcw size={28} className="text-blue-400 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted text-center">
              {status === 'processing' ? 'Procesando imagen...' : 'Analizando la tarjeta con IA...'}
            </p>
            <p className="text-[9px] font-bold text-fg-faint text-center">Puede tardar unos segundos.</p>
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
