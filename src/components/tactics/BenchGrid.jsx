import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateName } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';
import ClearButton from './ClearButton';

export default function BenchGrid({ dnd, onEmptySlotClick, onPlayerSlotClick }) {
  const { players, bench, clearBench } = useClubData();
  const { draggedPlayer, handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal, shouldSuppressClick } = dnd;

  return (
    <div className="bg-surface p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic">Banquillo</h3>
        <ClearButton onConfirm={clearBench} label="Vaciar banquillo" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
          const playerId = bench[idx]; const player = playerId ? players.find((p) => p.id === playerId) : null;
          const slot = `bench-${idx}`;
          return (
            <div key={`bench-wrapper-${idx}`} data-slot={slot} onClick={() => { if (shouldSuppressClick()) return; if (player) onPlayerSlotClick(player, slot); else onEmptySlotClick(slot); }} draggable={!!player} onDragStart={(e) => handleDragStart(e, player?.id, slot)} onTouchStart={(e) => handleTouchStartLocal(e, player?.id, slot)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, slot)} className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer active:cursor-grabbing touch-none transition-all duration-200 min-h-[48px] ${player ? 'bg-well border-border-subtle hover:bg-well-strong' : 'bg-well/60 border-border border-dashed hover:border-fg-muted justify-center'} ${draggedPlayer && !player ? 'border-green-400 bg-green-500/10' : ''}`}>
              {player ? (<><div className={`w-8 h-8 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-base ${getCardStyle(player.rating)}`}>{player.rating}</div><div className="flex flex-col flex-1 min-w-0 pointer-events-none text-left"><span className="text-[10px] md:text-xs font-bold uppercase italic text-black dark:text-white truncate">{abbreviateName(player.name)}</span><span className="text-[8px] text-green-400 font-black uppercase tracking-widest truncate">{player.positions?.join(' · ')}</span></div></>) : (<div className="flex items-center justify-center opacity-30 pointer-events-none"><span className="text-xl font-black leading-none">+</span></div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
