import { useState } from 'react';
import { X, Tag } from 'lucide-react';
import { formatValueInput, parseValue, formatCurrency, formatMoneyLiveWithCursor } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Opciones rápidas de asignación al presupuesto de fichajes: el resto del traspaso queda
// "retenido por la directiva" (fondos del club que no se reinvierten de inmediato en el
// mercado), modelando de forma realista que no todo el dinero de una venta está disponible
// al instante para fichar.
const ALLOCATION_PRESETS = [70, 80, 85, 100];
const DEFAULT_ALLOCATION = 80;

export default function SellPlayerModal({ player, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { sellPlayer } = useClubData();
  const [price, setPrice] = useState(formatValueInput(String(player.marketValue || player.value || '')));
  const [allocationPercent, setAllocationPercent] = useState(DEFAULT_ALLOCATION);
  const [customMode, setCustomMode] = useState(false);
  const [customPercent, setCustomPercent] = useState(String(DEFAULT_ALLOCATION));

  const totalAmount = parseValue(price);
  const effectivePercent = customMode ? Math.min(100, Math.max(0, parseInt(customPercent, 10) || 0)) : allocationPercent;
  const budgetAmount = Math.round(totalAmount * (effectivePercent / 100));
  const retainedAmount = totalAmount - budgetAmount;

  const pickPreset = (pct) => { setCustomMode(false); setAllocationPercent(pct); };
  // Al entrar en "Otro" se parte del porcentaje que estuviera activo (preset o el propio
  // valor personalizado anterior) en vez de reiniciar siempre a un valor fijo — así el
  // desglose no pega un salto inesperado al pulsar el botón, antes de que el usuario haya
  // escrito nada.
  const enterCustomMode = () => { setCustomPercent(String(allocationPercent)); setCustomMode(true); };
  // Igual que los campos monetarios del resto de la app (formatValueInput): se limpia
  // cualquier carácter que no sea dígito (puntos de miles, comas, etc.) en cada tecleo, en
  // vez de confiar en el parseo nativo de <input type="number">, y se limita a 100 al vuelo
  // para que el desglose de abajo nunca muestre un porcentaje fuera de rango mientras se
  // escribe.
  const onCustomPercentChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setCustomPercent(digits === '' ? '' : String(Math.min(100, parseInt(digits, 10))));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalAmount <= 0) return;
    await sellPlayer(player, totalAmount, effectivePercent);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative max-h-[90dvh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-black italic text-red-500 text-sm uppercase flex items-center gap-2"><Tag size={16} /> Vender a {player.name}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>

        <div className="space-y-1 mb-5">
          <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Venta (€)</label>
          <input type="text" autoFocus required inputMode="numeric" placeholder="Ej: 60.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-red-500 text-center font-black text-lg text-fg placeholder:text-fg-faint" value={price} onChange={(e) => formatMoneyLiveWithCursor(e.target, setPrice)} />
        </div>

        <div className="space-y-2 mb-5">
          <label className="text-[9px] font-black text-fg-muted ml-1">% Asignado a Fichajes</label>
          <div className="grid grid-cols-5 gap-1.5">
            {ALLOCATION_PRESETS.map((pct) => (
              <button key={pct} type="button" onClick={() => pickPreset(pct)} className={`py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${!customMode && allocationPercent === pct ? 'bg-red-500 text-black' : 'bg-well text-fg-muted hover:bg-well-strong border border-border-subtle'}`}>
                {pct}%
              </button>
            ))}
            <button type="button" onClick={enterCustomMode} className={`py-2.5 rounded-xl text-[9px] font-black uppercase transition-all touch-manipulation ${customMode ? 'bg-red-500 text-black' : 'bg-well text-fg-muted hover:bg-well-strong border border-border-subtle'}`}>
              Otro
            </button>
          </div>
          {customMode && (
            <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 90" className="w-full bg-well p-3 rounded-xl outline-none border border-border-subtle focus:border-red-500 text-center font-black text-fg mt-1 placeholder:text-fg-faint" value={customPercent} onChange={onCustomPercentChange} />
          )}
        </div>

        {/* Desglose financiero en tiempo real: se recalcula en cada tecleo del precio o cambio
            de porcentaje, sin ningún paso intermedio de confirmación. */}
        <div className="p-4 bg-well rounded-2xl border border-border-subtle space-y-2.5 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-fg-muted">Total Traspaso</span>
            <span className="font-black text-fg">+{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-fg-muted">Añadido a Fichajes ({effectivePercent}%)</span>
            <span className="font-black text-green-500">+{formatCurrency(budgetAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-fg-muted">Retenido por la Directiva ({100 - effectivePercent}%)</span>
            <span className="font-black text-fg-faint">+{formatCurrency(retainedAmount)}</span>
          </div>
          <div className="h-px bg-border-subtle" />
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-fg-muted">Masa Salarial Liberada</span>
            <span className="font-black text-blue-400">+{formatCurrency(player.wage || 0)}/mes</span>
          </div>
        </div>

        <button type="submit" disabled={totalAmount <= 0} className="w-full bg-red-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-red-400 transition-all disabled:opacity-50">Confirmar Venta</button>
      </form>
    </div>
  );
}
