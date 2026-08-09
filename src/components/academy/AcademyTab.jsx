import { useState } from 'react';
import { TrendingUp, Sprout } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import UpdateRatingModal from './UpdateRatingModal';

function PotentialBar({ rating, potential }) {
  if (!potential || potential <= rating) return null;
  const pct = Math.max(0, Math.min(100, ((rating - 40) / (potential - 40)) * 100));
  return (
    <div className="w-full h-1.5 bg-well-strong rounded-full overflow-hidden mt-2">
      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EvolutionTimeline({ history }) {
  if (!history || history.length === 0) return null;
  const ordered = [...history].sort((a, b) => b.date - a.date);
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {ordered.map((h, i) => (
        <span key={i} className="text-[8px] text-fg-faint font-black bg-well px-2 py-0.5 rounded">{new Date(h.date).toLocaleDateString('es-ES')}: {h.rating}</span>
      ))}
    </div>
  );
}

export default function AcademyTab() {
  const { players } = useClubData();
  const [updatingPlayer, setUpdatingPlayer] = useState(null);

  const youthPlayers = players.filter((p) => p.type === 'Cantera').sort((a, b) => (b.potential || b.rating) - (a.potential || a.rating));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest flex items-center gap-2"><Sprout size={14} /> {youthPlayers.length} Jugadores de Cantera</span>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {youthPlayers.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin jugadores de cantera</div>)}
        {youthPlayers.map((p) => (
          <div key={p.id} className="p-3 md:p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
              <div className="flex-1 min-w-0">
                <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div>
                <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest">{p.positions?.join(' · ')} · {p.age} Años</div>
                <PotentialBar rating={p.rating} potential={p.potential} />
              </div>
              {p.potential ? <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shrink-0">Pot. {p.potential}</span> : null}
            </div>
            <EvolutionTimeline history={p.evolutionHistory} />
            <button onClick={() => setUpdatingPlayer(p)} className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-black uppercase text-[10px] hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 border border-emerald-500/20 mt-1"><TrendingUp size={14} /> Actualizar Valoración</button>
          </div>
        ))}
      </div>

      {updatingPlayer && <UpdateRatingModal player={updatingPlayer} onClose={() => setUpdatingPlayer(null)} />}
    </div>
  );
}
