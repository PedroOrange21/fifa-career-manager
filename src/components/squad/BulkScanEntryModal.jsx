import { X, ChevronLeft, Video, Images, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Elección entre las dos formas de dar de alta VARIOS jugadores a la vez (vídeo o lote de
// fotos), enlazada desde el aviso sutil "¿Quieres añadir varios a la vez?" del paso de Método
// normal durante la temporada (ver AddPlayerChoiceModal) — la vía rápida de una sola tarjeta
// sigue siendo la principal en Plantilla/Academia; esta es la vía ocasional para una
// reestructuración grande a mitad de temporada. El Onboarding no pasa por aquí: ahí el vídeo y
// las fotos ya son botones directos y visibles en el propio paso del asistente.
export default function BulkScanEntryModal({ onVideo, onPhotos, onClose, onBack, scanNoun = 'jugador' }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const groupLabel = scanNoun === 'canterano' ? 'la Academia' : 'la plantilla';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase">Añadir Varios a la Vez</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-2.5">
          <button type="button" onClick={onVideo} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Video size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Escanear con Vídeo</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Pasa el joystick por {groupLabel} y extraemos cada {scanNoun} automáticamente.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={onPhotos} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-well-strong text-fg-muted flex items-center justify-center shrink-0"><Images size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Subir Lote de Fotos</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Elige varias fotos de golpe desde la galería.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
