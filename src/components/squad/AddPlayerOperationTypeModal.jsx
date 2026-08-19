import { X, ChevronLeft, Handshake, Shirt, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Segundo paso de "Fichar Jugador" (tras elegir Primer Equipo en AddPlayerDestinationModal,
// antes de AddPlayerChoiceModal): solo dos vías. "Nuevo Fichaje" cubre tanto Comprado como
// Cedido sin que el usuario tenga que distinguirlos aquí — si escanea con IA, Gemini detecta
// por sí sola si la tarjeta indica una cesión (ver esCesion en api/scan-player.js); si rellena
// a mano, elige Comprado o Cedido dentro del propio asistente (Paso 3). "Ya en el Club" es la
// variante sin traspaso real (jugador ya presente en la plantilla desde el inicio, igual que ya
// hace OnboardingWizard para la partida "Empieza desde Cero"), que salta directa al Paso de
// Método sin pedir ningún dato de fichaje.
export default function AddPlayerOperationTypeModal({ onClose, onBack, onSelect }) {
  useBodyScrollLock();
  useAutoHideChrome();

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-green-500 text-sm uppercase">Fichar Jugador</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted text-center mb-3">¿Qué tipo de operación es?</p>
        <div className="space-y-2.5">
          <button type="button" onClick={() => onSelect('Nuevo')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Handshake size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Nuevo Fichaje</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Comprado o cedido — la IA o tú decidís los detalles.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={() => onSelect('Inicial')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-zinc-400 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-zinc-500/10 text-zinc-400 flex items-center justify-center shrink-0"><Shirt size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Ya en el Club</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Ya estaba en el equipo desde el inicio, sin club de procedencia ni precio.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
