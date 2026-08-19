import { X, ChevronLeft, DollarSign, Handshake, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Segundo paso de "Fichar Jugador" (tras elegir Primer Equipo en AddPlayerDestinationModal,
// antes de AddPlayerChoiceModal): ¿Comprado o Cedido? Se decide aquí, antes del método de
// alta, para que tanto el formulario manual como el resultado del escaneo con IA sepan de
// entrada qué campos económicos/contractuales pedir (precio de compra y cláusula de rescisión
// en Comprado; club de origen, duración de cesión y opción de compra en Cedido) — mismos
// colores que ya usa el resto de la app para distinguir un tipo del otro (azul Comprado,
// ámbar Cedido, ver PlayerForm y las insignias "Cedible"/"Ced." de PlayerList).
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
          <button type="button" onClick={() => onSelect('Comprado')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><DollarSign size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Comprado / Traspaso Definitivo</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Pasa a ser propiedad del club, con precio de compra y contrato.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
          <button type="button" onClick={() => onSelect('Cedido')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-yellow-500 hover:bg-well-strong transition-all text-left touch-manipulation">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0"><Handshake size={22} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm text-fg">Cedido</div>
              <div className="text-[10px] font-bold text-fg-muted mt-0.5">Llega prestado desde otro club, con duración y condiciones.</div>
            </div>
            <ChevronRight size={18} className="text-fg-faint shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
