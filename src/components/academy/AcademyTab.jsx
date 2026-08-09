import { useState } from 'react';
import { TrendingUp, Sprout, ShieldCheck } from 'lucide-react';
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

function YouthPlayerRow({ p, promoted, onUpdate }) {
  return (
    <div className="p-3 md:p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3 md:gap-4">
        <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
        <div className="flex-1 min-w-0">
          <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white flex items-center gap-2">
            {p.name}
            {promoted && <span className="shrink-0 flex items-center gap-1 text-[7px] md:text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20"><ShieldCheck size={10} /> Primer Equipo</span>}
          </div>
          <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest">{p.positions?.join(' · ')} · {p.age} Años</div>
          <PotentialBar rating={p.rating} potential={p.potential} />
        </div>
        {p.potential ? <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shrink-0">Pot. {p.potential}</span> : null}
      </div>
      <EvolutionTimeline history={p.evolutionHistory} />
      <button onClick={() => onUpdate(p)} className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-black uppercase text-[10px] hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 border border-emerald-500/20 mt-1"><TrendingUp size={14} /> Actualizar Valoración</button>
    </div>
  );
}

export default function AcademyTab() {
  const { players, lineup, bench } = useClubData();
  const [updatingPlayer, setUpdatingPlayer] = useState(null);

  const isPromoted = (p) => Object.values(lineup).includes(p.id) || Object.values(bench).includes(p.id);

  const allYouth = players.filter((p) => p.type === 'Cantera').sort((a, b) => (b.potential || b.rating) - (a.potential || a.rating));
  const inAcademy = allYouth.filter((p) => !isPromoted(p));
  const promoted = allYouth.filter((p) => isPromoted(p));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest flex items-center gap-2"><Sprout size={14} /> {allYouth.length} Jugadores de Cantera</span>
      </div>

      <div>
        <div className="px-2 flex items-center gap-2 mb-2 text-fg-muted"><Sprout size={14} /><h3 className="text-[10px] font-black uppercase tracking-widest italic">En la Cantera</h3></div>
        <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
          {inAcademy.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin jugadores en el filial</div>)}
          {inAcademy.map((p) => <YouthPlayerRow key={p.id} p={p} promoted={false} onUpdate={setUpdatingPlayer} />)}
        </div>
      </div>

      {promoted.length > 0 && (
        <div>
          <div className="px-2 flex items-center gap-2 mb-2 text-blue-400"><ShieldCheck size={14} /><h3 className="text-[10px] font-black uppercase tracking-widest italic">Promovidos al Primer Equipo</h3></div>
          <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-blue-500/20 overflow-hidden divide-y divide-border-subtle shadow-2xl">
            {promoted.map((p) => <YouthPlayerRow key={p.id} p={p} promoted onUpdate={setUpdatingPlayer} />)}
          </div>
        </div>
      )}

      {updatingPlayer && <UpdateRatingModal player={updatingPlayer} onClose={() => setUpdatingPlayer(null)} />}
    </div>
  );
}
