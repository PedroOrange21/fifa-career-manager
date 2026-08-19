import { X, Shirt, GraduationCap, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Primer paso de "Fichar Jugador": ¿a qué plantilla se incorpora? Determina el resto del
// flujo — Primer Equipo continúa a AddPlayerOperationTypeModal (Comprado/Cedido) y de ahí a
// AddPlayerChoiceModal (Manual/Escanear con IA); Academia va directa al asistente manual con
// el tipo ya fijado a 'Cantera' (mismo criterio que el propio botón "Fichar Jugador" de
// AcademyTab, que tampoco ofrece escaneo por IA ni distingue Comprado/Cedido).
export default function AddPlayerDestinationModal({ onClose, onSelectFirstTeam, onSelectAcademy }) {
  useBodyScrollLock();
  useAutoHideChrome();

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black italic text-green-500 text-sm uppercase">Fichar Jugador</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted text-center mb-3">¿A qué plantilla se incorpora?</p>
        <div className="space-y-2.5">
          <button type="button" onClick={onSelectFirstTeam} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Shirt size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Primer Equipo</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Plantilla principal · Comprado o Cedido</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={onSelectAcademy} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-emerald-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><GraduationCap size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Academia / Cantera</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Jugador en desarrollo, sin términos económicos</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
