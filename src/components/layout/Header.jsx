import { useClubs } from '../../context/ClubsContext';
import { formatCurrency } from '../../utils/format';
import ClubMenu from './ClubMenu';

export default function Header({ setActiveTab, onSwitchClub }) {
  const { activeClub, clubs, loadingClubs } = useClubs();
  const hasNoClubs = clubs.length === 0 && !loadingClubs;
  const transferBudget = activeClub?.transferBudget || 0;

  return (
    <header className="p-4 border-b border-border flex justify-between items-center sticky top-0 bg-surface/90 backdrop-blur-md z-40">
      <div className="flex flex-col">
        <h1 className="text-green-500 font-black italic tracking-tighter text-lg md:text-xl leading-none">soccerclothes.</h1>
        <span className="text-fg-secondary font-black tracking-[0.2em] text-[8px] uppercase mt-0.5 ml-0.5">MODO CARRERA</span>
      </div>

      <div className="flex items-center gap-4">
        {!hasNoClubs && activeClub && (
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[9px] font-black uppercase text-fg-muted tracking-widest">Presupuesto</span>
            <span className={`font-black text-sm ${transferBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(transferBudget)}</span>
          </div>
        )}
        <ClubMenu setActiveTab={setActiveTab} onSwitchClub={onSwitchClub} />
      </div>
    </header>
  );
}
