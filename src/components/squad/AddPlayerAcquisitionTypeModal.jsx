import { X, ChevronLeft, ChevronRight, Wallet, ArrowRightLeft } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Segundo paso de "Fichar Jugador" (justo tras elegir Primer Equipo en
// AddPlayerDestinationModal, sin ningún paso intermedio de por medio): decide explícitamente si
// es un traspaso en propiedad o una cesión ANTES de llegar al formulario, en vez de dejar que lo
// decida solo la IA al escanear o el propio selector interno de PlayerForm — así el resto del
// asistente (Datos de Traspaso, y el formulario manual ya con el tipo bloqueado) muestra desde
// el principio únicamente los campos que corresponden a la elección. onSelect recibe 'Comprado'
// (Traspaso) o 'Cedido'.
export default function AddPlayerAcquisitionTypeModal({ onClose, onBack, onSelect }) {
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
        <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted text-center mb-3">¿Cómo se incorpora el jugador?</p>
        <div className="space-y-2.5">
          <button type="button" onClick={() => onSelect('Comprado')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Wallet size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Traspaso</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Pasa a ser propiedad del club, con precio de traspaso.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={() => onSelect('Cedido')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-yellow-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0"><ArrowRightLeft size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Cedido</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Cesión temporal: club de origen, duración y reparto de sueldo.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
