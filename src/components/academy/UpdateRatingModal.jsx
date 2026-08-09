import { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export default function UpdateRatingModal({ player, onClose }) {
  useBodyScrollLock();
  const { updateYouthRating } = useClubData();
  const [rating, setRating] = useState(String(player.rating));
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = parseInt(rating);
    if (isNaN(value) || value < 1 || value > 99) return setError('Media entre 1 y 99.');
    await updateYouthRating(player, value);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h3 className="font-black italic text-emerald-500 text-sm uppercase flex items-center gap-2"><TrendingUp size={16} /> Actualizar a {player.name}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>
        {error && <p className="text-[10px] font-black text-red-400 mb-3">{error}</p>}
        <div className="space-y-1 mb-6">
          <label className="text-[9px] font-black text-fg-muted ml-1">Nueva Media (Media actual: {player.rating}{player.potential ? ` · Potencial: ${player.potential}` : ''})</label>
          <input type="number" autoFocus min="1" max="99" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-emerald-500 text-center font-black text-2xl text-fg" value={rating} onChange={(e) => setRating(e.target.value)} />
        </div>
        <button type="submit" className="w-full bg-emerald-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-emerald-400 transition-all">Guardar Evolución</button>
      </form>
    </div>
  );
}
