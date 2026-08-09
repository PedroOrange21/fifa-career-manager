import { LayoutDashboard } from 'lucide-react';
import { FORMATIONS } from '../../constants/formations';
import { getPitchTierStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import ClearButton from './ClearButton';
import TacticsDropdown from './TacticsDropdown';

export default function FormationPitch({ dnd, onEmptySlotClick, onPlayerSlotClick }) {
  const { players, formation, lineup, clearLineup, handleFormationChange } = useClubData();
  const { draggedPlayer, handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal } = dnd;

  return (
    <div className="bg-[#1a2e1d] border-4 border-green-500/20 rounded-[32px] md:rounded-[48px] p-6 relative min-h-[550px] md:min-h-[620px] overflow-hidden shadow-inner">
      <TacticsDropdown icon={LayoutDashboard} value={formation} options={Object.keys(FORMATIONS)} onChange={handleFormationChange} wrapperClassName="absolute top-3 right-4 z-30" />
      <div className="absolute inset-4 border-2 border-white/30 rounded-[28px] pointer-events-none"></div><div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 pointer-events-none"></div><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-36 md:h-36 border-2 border-white/30 rounded-full pointer-events-none"></div><div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 md:w-48 h-16 md:h-20 border-b-2 border-x-2 border-white/30 pointer-events-none"></div><div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 md:w-48 h-16 md:h-20 border-t-2 border-x-2 border-white/30 pointer-events-none"></div>
      {FORMATIONS[formation].map((slot, idx) => {
        const player = players.find((p) => p.id === lineup[idx]); const draggedPlayerObj = draggedPlayer ? players.find((p) => p.id === draggedPlayer) : null;
        const canDragPlayerPlayHere = draggedPlayerObj?.positions?.includes(slot.pos);
        const isEmptySlotHighlight = draggedPlayer && !player && canDragPlayerPlayHere;
        const isOccupiedSlotHighlight = draggedPlayer && player && draggedPlayer !== player.id && canDragPlayerPlayHere;
        return (
          <div key={idx} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10 group hover:z-50">
            <button data-slot={idx} onClick={() => { if (player) onPlayerSlotClick(player, idx); else onEmptySlotClick(idx); }} draggable={!!player} onDragStart={(e) => handleDragStart(e, player?.id, idx)} onTouchStart={(e) => handleTouchStartLocal(e, player?.id, idx)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx)} className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex flex-col items-center justify-center font-black transition-all duration-300 shadow-2xl active:scale-90 touch-none z-10 ${player ? `bg-zinc-900 border-4 ${getPitchTierStyle(player.rating)} scale-105` : 'bg-black/80 border-2 border-white/10 border-dashed text-white/20 hover:border-white/40'} ${isEmptySlotHighlight ? 'border-green-400 bg-green-500/20' : ''} ${isOccupiedSlotHighlight ? 'ring-4 ring-green-500/50 border-green-400' : ''}`}>
              {player ? (<div className="flex flex-col items-center leading-none"><span className="text-[7px] md:text-[8px] font-bold mb-0.5 uppercase">{slot.pos}</span><span className="text-sm md:text-base font-black">{player.rating}</span></div>) : <span className="text-[8px] md:text-[9px] uppercase tracking-tighter">{slot.pos}</span>}
            </button>
            {player && (<div className="flex flex-col items-center pointer-events-none -mt-3 gap-0 z-20"><span className="text-[7px] md:text-[8px] font-bold bg-black text-white px-1.5 md:px-2 py-0.5 rounded-full border border-white/10 shadow-lg whitespace-nowrap uppercase italic max-w-[65px] md:max-w-[80px] truncate leading-tight">{player.name}</span>{player.positions?.filter((p) => p !== slot.pos).length > 0 && (<span className="text-[6px] md:text-[7px] text-green-400 font-black uppercase tracking-widest bg-black/80 px-1.5 py-0.5 rounded mt-px">{player.positions.filter((p) => p !== slot.pos).join(' · ')}</span>)}</div>)}
          </div>
        );
      })}
      <ClearButton onConfirm={clearLineup} label="Vaciar el 11 inicial" className="absolute bottom-4 right-4 z-30" />
    </div>
  );
}
