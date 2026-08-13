import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import Dropdown from '../common/Dropdown';

const LOAN_DURATION_OPTIONS = [
  { value: '6 Meses', label: '6 Meses' },
  { value: '1 Temporada', label: '1 Temporada' },
  { value: '2 Temporadas', label: '2 Temporadas' },
];

export default function LoanOutModal({ player, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { cedePlayer } = useClubData();
  const [destinationClub, setDestinationClub] = useState('');
  const [duration, setDuration] = useState('1 Temporada');
  const [wagePercentage, setWagePercentage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destinationClub.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await cedePlayer(player, { destinationClub: destinationClub.trim(), duration, wagePercentage: Number(wagePercentage) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black italic text-yellow-500 text-sm uppercase flex items-center gap-2"><ArrowRightLeft size={16} /> Ceder a {player.name}</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Club de Destino *</label>
            <input type="text" required autoFocus placeholder="Ej: Villarreal CF" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-yellow-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm" value={destinationClub} onChange={(e) => setDestinationClub(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Duración de la Cesión</label>
            <Dropdown value={duration} options={LOAN_DURATION_OPTIONS} onChange={setDuration} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">% Salario Pagado por Nuestro Club</label>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5" className="flex-1 accent-yellow-500" value={wagePercentage} onChange={(e) => setWagePercentage(e.target.value)} />
              <span className="w-14 text-center font-black text-fg bg-well rounded-lg py-1.5 text-sm shrink-0">{wagePercentage}%</span>
            </div>
          </div>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-yellow-400 transition-all disabled:opacity-50">{isSubmitting ? 'Guardando...' : 'Confirmar Cesión'}</button>
      </form>
    </div>
  );
}
