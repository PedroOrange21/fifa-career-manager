import { X, Check, Search } from 'lucide-react';
import { FORMATIONS } from '../../constants/formations';
import { getCardStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export default function PickingSlotModal({ pickingSlot, onClose, onNavigateToScouting }) {
  useBodyScrollLock();
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
  // reemplazo/intercambio) siempre encabeza la lista, por delante de cualquier otra
  // prioridad de disponibilidad.
  const isCurrentSlotPlayer = (p) => (isBenchSlot ? bench[pickingSlot.split('-')[1]] === p.id : lineup[pickingSlot] === p.id);

  // Prioridad de disponibilidad: Seleccionado > Banquillo > No Convocados/Reserva > 11 Inicial (otra posición) > Transferibles > Cedidos Fuera.
  const getPriority = (p) => {
    if (isCurrentSlotPlayer(p)) return 0;
    if (Object.values(bench).includes(p.id)) return 1;
    if (Object.values(lineup).includes(p.id)) return 3;
    if (p.transferStatus === 'Transferible') return 4;
    if (p.transferStatus === 'CedidoFuera') return 5;
    return 2;
  };

  const eligiblePlayers = players
    .filter((p) => isBenchSlot || (p.positions && slotData && p.positions.includes(slotData.pos)))
    .sort((a, b) => {
      const pa = getPriority(a); const pb = getPriority(b);
      if (pa !== pb) return pa - pb;
      return b.rating - a.rating;
    });

  const currentSlotOccupied = isBenchSlot ? !!bench[pickingSlot.split('-')[1]] : !!lineup[pickingSlot];
  const availableCount = eligiblePlayers.filter((p) => p.transferStatus !== 'CedidoFuera').length;
  const showEmptyState = !isBenchSlot && !currentSlotOccupied && availableCount === 0;

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] p-4 md:p-6 flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm mx-auto shadow-2xl relative my-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-fg">Colocar Jugador</h2><p className="text-[9px] md:text-[10px] text-green-500 font-black uppercase tracking-widest">Alineación: {isBenchSlot ? 'Banquillo' : slotData?.pos}</p></div><button onClick={onClose} className="p-3 bg-well rounded-full hover:bg-well-strong transition-all text-fg-muted hover:text-fg"><X size={20} /></button></div>
        <div className="overflow-y-auto space-y-2 max-h-[60vh] pr-1 no-scrollbar">
          {showEmptyState && (
            <div className="text-center py-6 px-2 space-y-4">
              <p className="text-xs font-bold text-fg-muted uppercase tracking-wide leading-relaxed">No hay jugadores disponibles para esta posición</p>
              <button onClick={goToScouting} className="w-full p-4 rounded-2xl bg-green-500 text-black font-black uppercase text-[10px] tracking-wider hover:bg-green-400 transition-all flex items-center justify-center gap-2"><Search size={14} /> Buscar en el Mercado</button>
            </div>
          )}
          {eligiblePlayers.map((p) => {
            const isLoanedOut = p.transferStatus === 'CedidoFuera';
            const isAlreadyIn11 = Object.values(lineup).includes(p.id); const isAlreadyInBench = Object.values(bench).includes(p.id);
            const isCurrentSlot = isCurrentSlotPlayer(p);
            return (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                disabled={isLoanedOut}
                className={`w-full p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4 transition-all border ${isLoanedOut ? 'opacity-50 grayscale pointer-events-none bg-well/50 border-transparent' : isCurrentSlot ? 'border-green-500 bg-green-500/10' : 'bg-well border-transparent hover:bg-well-strong'}`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 mb-0.5">{p.positions?.[0]}</span><span className="text-base md:text-lg">{p.rating}</span></div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm md:text-base truncate text-black dark:text-white">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                    <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase">{p.age} Años</span>
                    {isLoanedOut && (<span className="text-[7px] md:text-[8px] bg-zinc-500/20 text-zinc-400 px-2 py-0.5 rounded uppercase font-black tracking-widest">Cedido Fuera</span>)}
                    {(!isLoanedOut && !isCurrentSlot && (isAlreadyIn11 || isAlreadyInBench)) && (<span className={`text-[7px] md:text-[8px] px-2 py-0.5 rounded uppercase font-black tracking-widest ${isAlreadyIn11 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isAlreadyIn11 ? 'En el 11' : 'Banquillo'}</span>)}
                  </div>
                </div>
                {isCurrentSlot && !isLoanedOut && <Check className="text-green-500" size={18} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
