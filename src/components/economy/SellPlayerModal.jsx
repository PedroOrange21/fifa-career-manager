import { useState } from 'react';
import { X, Tag } from 'lucide-react';
import { formatValueInput, parseValue } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

export default function SellPlayerModal({ player, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { sellPlayer } = useClubData();
  const [price, setPrice] = useState(formatValueInput(String(player.marketValue || player.value || '')));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseValue(price);
    if (amount <= 0) return;
    await sellPlayer(player, amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-black italic text-red-500 text-sm uppercase flex items-center gap-2"><Tag size={16} /> Vender a {player.name}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>
        <div className="space-y-1 mb-6">
          <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Venta (€)</label>
          <input type="text" autoFocus required placeholder="Ej: 60.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-red-500 text-center font-black text-lg text-fg placeholder:text-fg-faint" value={price} onChange={(e) => setPrice(formatValueInput(e.target.value))} />
        </div>
        <button type="submit" className="w-full bg-red-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-red-400 transition-all">Confirmar Venta</button>
      </form>
    </div>
  );
}
