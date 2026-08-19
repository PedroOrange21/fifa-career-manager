import { X, ChevronLeft, PenLine, ScanLine, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Selector de Método de alta, reutilizado en tres sitios: Paso de Método de "Fichar Jugador"
// en PlayerList (tras Tipo de Operación en Primer Equipo, o directo tras elegir Academia en el
// Paso 1); botón "Fichar Canterano" de AcademyTab (sin pasos previos, ya en la Academia); y
// dentro de esos mismos flujos. Elegir entre rellenar el asistente a mano o escanear la
// tarjeta del jugador con IA (Gemini Vision, una sola foto — la vía rápida y ágil durante la
// temporada) para prerrellenarlo automáticamente. onBack, si se pasa, vuelve al paso anterior
// sin cerrar del todo el flujo. onBulk (opcional) añade un enlace sutil al pie para el caso
// ocasional de dar de alta VARIOS jugadores a la vez (reestructuración grande a mitad de
// temporada) sin invadir el protagonismo de la vía individual — ver BulkScanEntryModal.
export default function AddPlayerChoiceModal({ onManual, onScan, onBulk, onClose, onBack, scanNoun = 'jugador' }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const title = scanNoun === 'canterano' ? 'Fichar Canterano' : 'Fichar Jugador';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-green-500 text-sm uppercase">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-2.5">
          <button type="button" onClick={onScan} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><ScanLine size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Escanear Foto de {scanNoun === 'canterano' ? 'Canterano' : 'Jugador'}</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Haz una foto a la tarjeta y rellenamos el formulario solos.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={onManual} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-green-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0"><PenLine size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Añadir de Forma Manual</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Rellena la ficha tú mismo, paso a paso.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
        {onBulk && (
          <button type="button" onClick={onBulk} className="w-full text-center mt-4 text-[10px] font-bold text-fg-faint hover:text-blue-400 transition-colors touch-manipulation underline decoration-dotted underline-offset-4">
            ¿Quieres añadir varios a la vez? Subir lote o vídeo
          </button>
        )}
      </div>
    </div>
  );
}
