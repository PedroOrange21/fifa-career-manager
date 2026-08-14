import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateName } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';

export default function UncalledZone({ dnd, onPlayerClick }) {
  const { players, lineup, bench } = useClubData();
  const { draggedPlayer, handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal, shouldSuppressClick } = dnd;

  const notInTactics = (p) => !Object.values(lineup).includes(p.id) && !Object.values(bench).includes(p.id);
  // Un canterano sin promocionar no es un jugador del primer equipo: aunque técnicamente
  // "no está convocado" (no aparece en once ni banquillo), no debe listarse aquí — solo deja
  // de ser Cantera (y puede entrar en esta zona) al subir al primer equipo con contrato.
  const uncalled = players.filter((p) => p.type !== 'Cantera' && notInTactics(p) && (p.transferStatus || 'Activo') === 'Activo').sort((a, b) => b.rating - a.rating);

  return (
    <div data-slot="uncalled" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'uncalled')} className={`bg-surface p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl min-h-[120px] transition-colors ${draggedPlayer ? 'border-dashed border-border bg-well' : ''}`}>
      <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic mb-3">No Convocados</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {uncalled.map((p) => (
          <div key={p.id} data-slot="uncalled" draggable onDragStart={(e) => handleDragStart(e, p.id, 'uncalled')} onTouchStart={(e) => handleTouchStartLocal(e, p.id, 'uncalled')} onClick={() => { if (shouldSuppressClick()) return; onPlayerClick(p, 'uncalled'); }} className="flex items-center gap-3 bg-well px-3 py-2 rounded-xl border border-border-subtle cursor-pointer active:cursor-grabbing touch-none hover:bg-well-strong">
            <div className={`w-8 h-8 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-base ${getCardStyle(p.rating)}`}>{p.rating}</div><div className="flex flex-col flex-1 min-w-0 text-left"><span className="text-[10px] md:text-xs font-bold uppercase italic text-black dark:text-white truncate">{abbreviateName(p.name)}</span><span className="text-[8px] text-green-400 font-black uppercase tracking-widest truncate">{p.positions?.join(' · ')}</span></div>
          </div>
        ))}
        {uncalled.length === 0 && <span className="text-[10px] text-fg-faint italic p-2 col-span-full">Todos los jugadores están convocados.</span>}
      </div>
    </div>
  );
}
