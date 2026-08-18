import { X, Check, Search, GraduationCap } from 'lucide-react';
import { FORMATIONS } from '../../constants/formations';
import { getCardStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

export default function PickingSlotModal({ pickingSlot, onClose, onNavigateToScouting }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { players, formation, lineup, bench, assignPlayerToSlot } = useClubData();

  const pick = (playerId) => {
    assignPlayerToSlot(pickingSlot, playerId);
    onClose();
  };

  const goToScouting = () => {
    onClose();
    onNavigateToScouting?.();
  };

  const isBenchSlot = String(pickingSlot).startsWith('bench-');
  const slotData = isBenchSlot ? null : FORMATIONS[formation][pickingSlot];

  // El jugador que ya ocupa la casilla que se está editando (el implicado en el
  // reemplazo/intercambio) siempre encabeza el bloque del Primer Equipo, por delante del
  // resto (que se ordena por media).
  const isCurrentSlotPlayer = (p) => (isBenchSlot ? bench[pickingSlot.split('-')[1]] === p.id : lineup[pickingSlot] === p.id);
  const isAcademyPlayer = (p) => p.type === 'Cantera';
  const isLoanedOutPlayer = (p) => p.transferStatus === 'CedidoFuera';

  const positionEligible = players.filter((p) => isBenchSlot || (p.positions && slotData && p.positions.includes(slotData.pos)));

  // Tres bloques jerárquicos y disjuntos, cada uno ordenado por media descendente: Primer
  // Equipo disponible arriba del todo, Academia/Cantera (bloqueados, ver isBlocked más abajo)
  // en medio, y Cedidos a otros Clubes (también bloqueados) siempre al final de la lista.
  const byRatingDesc = (a, b) => b.rating - a.rating;
  const firstTeamPlayers = positionEligible
    .filter((p) => !isAcademyPlayer(p) && !isLoanedOutPlayer(p))
    .sort((a, b) => (isCurrentSlotPlayer(b) ? 1 : 0) - (isCurrentSlotPlayer(a) ? 1 : 0) || byRatingDesc(a, b));
  const academyPlayers = positionEligible.filter((p) => isAcademyPlayer(p)).sort(byRatingDesc);
  const loanedOutPlayers = positionEligible.filter((p) => isLoanedOutPlayer(p)).sort(byRatingDesc);

  const currentSlotOccupied = isBenchSlot ? !!bench[pickingSlot.split('-')[1]] : !!lineup[pickingSlot];
  // Solo cuenta el Primer Equipo como "disponible": Academia y Cedidos están bloqueados, así
  // que si son los únicos candidatos para la posición, se considera igual que no haber
  // ninguno.
  const showEmptyState = !isBenchSlot && !currentSlotOccupied && firstTeamPlayers.length === 0;

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] p-4 md:p-6 flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm mx-auto shadow-2xl relative my-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-fg">Colocar Jugador</h2><p className="text-[9px] md:text-[10px] text-green-500 font-black uppercase tracking-widest">Alineación: {isBenchSlot ? 'Banquillo' : slotData?.pos}</p></div><button onClick={onClose} className="p-1.5 bg-well rounded-full hover:bg-well-strong transition-colors text-fg-muted hover:text-fg"><X size={14} /></button></div>
        <div className="overflow-y-auto space-y-2 max-h-[60vh] pr-1 no-scrollbar">
          {showEmptyState && (
            <div className="text-center py-6 px-2 space-y-4">
              <p className="text-xs font-bold text-fg-muted uppercase tracking-wide leading-relaxed">No hay jugadores disponibles para esta posición</p>
              <button onClick={goToScouting} className="w-full p-4 rounded-2xl bg-green-500 text-black font-black uppercase text-[10px] tracking-wider hover:bg-green-400 transition-all flex items-center justify-center gap-2"><Search size={14} /> Buscar en el Mercado</button>
            </div>
          )}
          {[
            { label: 'Primer Equipo', list: firstTeamPlayers },
            { label: 'Academia / Cantera', list: academyPlayers },
            { label: 'Cedidos a Otros Clubes', list: loanedOutPlayers },
          ].map(({ label, list }) => list.length === 0 ? null : (
            <div key={label} className="space-y-2">
              <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint px-1 pt-1 first:pt-0">{label}</div>
              {list.map((p) => {
                const isLoanedOut = isLoanedOutPlayer(p);
                // Un canterano no promocionado al primer equipo (type === 'Cantera'; al
                // promover pasa a 'Comprado', ver PromoteToFirstTeamModal) no puede alinearse
                // todavía — bloqueado igual que un cedido fuera, con su propia insignia
                // distintiva.
                const isAcademy = isAcademyPlayer(p);
                const isBlocked = isLoanedOut || isAcademy;
                const isAlreadyIn11 = Object.values(lineup).includes(p.id); const isAlreadyInBench = Object.values(bench).includes(p.id);
                const isCurrentSlot = isCurrentSlotPlayer(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => pick(p.id)}
                    disabled={isBlocked}
                    className={`relative w-full p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4 transition-all border ${isBlocked ? 'opacity-50 grayscale bg-well/50 border-transparent cursor-not-allowed' : isCurrentSlot ? 'border-green-500 bg-green-500/10' : 'bg-well border-transparent hover:bg-well-strong'}`}
                  >
                    {isAcademy && (
                      <span title="Canterano: no disponible hasta ser promocionado al primer equipo" className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <GraduationCap size={11} />
                      </span>
                    )}
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 mb-0.5">{p.positions?.[0]}</span><span className="text-base md:text-lg">{p.rating}</span></div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-black uppercase italic text-sm md:text-base truncate text-black dark:text-white">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                        <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase">{p.age} Años</span>
                        {isLoanedOut && (<span className="text-[7px] md:text-[8px] bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded uppercase font-black tracking-widest">Cedido Fuera</span>)}
                        {isAcademy && (<span className="text-[7px] md:text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-black tracking-widest">Cantera</span>)}
                        {(!isBlocked && !isCurrentSlot && (isAlreadyIn11 || isAlreadyInBench)) && (<span className={`text-[7px] md:text-[8px] px-2 py-0.5 rounded uppercase font-black tracking-widest ${isAlreadyIn11 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isAlreadyIn11 ? 'En el 11' : 'Banquillo'}</span>)}
                      </div>
                    </div>
                    {isCurrentSlot && !isBlocked && <Check className="text-green-500" size={18} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
