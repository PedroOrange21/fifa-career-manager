import { useState } from 'react';
import { ScanLine, Sparkles, PenLine, Clock3 } from 'lucide-react';
import UploadDropzone from './UploadDropzone';
import { useOcrExtraction } from '../../hooks/useOcrExtraction';

export default function ScanTab({ onCreatePlayer }) {
  const [image, setImage] = useState(null);
  const { status, run, reset } = useOcrExtraction();

  const handleImageChange = (next) => { setImage(next); reset(); };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl text-center">
        <ScanLine className="mx-auto mb-2 text-green-500" size={28} />
        <h2 className="text-lg font-black uppercase italic tracking-tighter text-fg">Escaneo por Foto</h2>
        <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">Sube una captura de la tarjeta del jugador</p>
      </div>

      <UploadDropzone image={image} onImageChange={handleImageChange} />

      {image && (
        <div className="space-y-3">
          <button onClick={run} disabled={status === 'processing'} className="w-full bg-well-strong text-fg p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-125 disabled:opacity-50">
            <Sparkles size={16} /> {status === 'processing' ? 'Analizando...' : 'Extraer Datos Automáticamente'}
          </button>

          {status === 'unavailable' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex gap-3 text-yellow-500 text-xs font-bold items-start">
              <Clock3 className="flex-shrink-0" size={18} />
              <span>El reconocimiento automático (OCR/IA) todavía no está conectado en esta versión. De momento, usa el botón de abajo para rellenar la ficha del jugador a mano a partir de la captura.</span>
            </div>
          )}

          <button onClick={onCreatePlayer} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
            <PenLine size={16} /> Rellenar Ficha Manualmente
          </button>
        </div>
      )}
    </div>
  );
}
