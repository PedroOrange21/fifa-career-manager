import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { formatCurrency, formatMoneyLiveWithCursor, parseValue } from '../../utils/format';
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
  const [hasBuyOption, setHasBuyOption] = useState(false);
  const [buyOption, setBuyOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Desglose salarial en tiempo real: cuánto sigue pagando nuestro club y cuánto asume (o se
  // ahorra) el club de destino, en mensual y anual, recalculado en cada movimiento de la barra.
  const wage = player.wage || 0;
  const ourShareMonthly = Math.round(wage * (wagePercentage / 100));
  const ourShareYearly = ourShareMonthly * 12;
  const destShareMonthly = wage - ourShareMonthly;
  const destShareYearly = destShareMonthly * 12;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!destinationClub.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await cedePlayer(player, {
      destinationClub: destinationClub.trim(),
      duration,
      wagePercentage: Number(wagePercentage),
      buyOption: hasBuyOption ? (parseValue(buyOption) || null) : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative max-h-[90dvh] overflow-y-auto no-scrollbar" onClick={(e) => e.stopPropagation()}>
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
            <Dropdown value={duration} options={LOAN_DURATION_OPTIONS} onChange={setDuration} labelClassName="text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">% Salario Pagado por Nuestro Club</label>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5" className="flex-1 accent-yellow-500" value={wagePercentage} onChange={(e) => setWagePercentage(e.target.value)} />
              <span className="w-14 text-center font-black text-fg bg-well rounded-lg py-1.5 text-sm shrink-0">{wagePercentage}%</span>
            </div>
            {/* Desglose sutil y compacto (sin caja propia, texto atenuado): dos líneas bien
                separadas por justify-between, en vez del bloque destacado anterior. */}
            <div className="space-y-0.5 mt-1.5 px-1">
              <div className="flex justify-between items-center gap-2 text-[9px] font-bold text-fg-faint">
                <span className="shrink-0">Nuestro Club</span>
                <span className="text-fg-muted text-right">{formatCurrency(ourShareMonthly)}/mes · {formatCurrency(ourShareYearly)}/año</span>
              </div>
              <div className="flex justify-between items-center gap-2 text-[9px] font-bold text-fg-faint">
                <span className="shrink-0">Club Destino</span>
                <span className="text-fg-muted text-right">{formatCurrency(destShareMonthly)}/mes · {formatCurrency(destShareYearly)}/año</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => setHasBuyOption((v) => !v)} className="w-full flex items-center justify-between gap-2 p-3 bg-well rounded-xl border border-border-subtle touch-manipulation">
              <span className="text-[10px] font-black uppercase text-fg-muted">Incluir Opción de Compra</span>
              <span className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${hasBuyOption ? 'bg-yellow-500' : 'bg-well-strong'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${hasBuyOption ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
            {hasBuyOption && (
              <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 40.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-yellow-500 text-center font-black text-fg placeholder:text-fg-faint" value={buyOption} onChange={(e) => formatMoneyLiveWithCursor(e.target, setBuyOption)} />
            )}
          </div>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-yellow-400 transition-all disabled:opacity-50">{isSubmitting ? 'Guardando...' : 'Confirmar Cesión'}</button>
      </form>
    </div>
  );
}
