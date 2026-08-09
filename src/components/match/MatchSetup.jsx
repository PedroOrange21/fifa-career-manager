import { useState } from 'react';
import { Tv, Play } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';

export default function MatchSetup({ onStart }) {
  const { players, lineup } = useClubData();
  const [opponent, setOpponent] = useState('');

  const starters = Object.values(lineup)
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean);

  const canStart = opponent.trim() && starters.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl text-center">
        <Tv className="mx-auto mb-3 text-green-500" size={32} />
        <h2 className="text-lg font-black uppercase italic tracking-tighter text-fg">Modo Partido en Directo</h2>
        <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">Registra goles, asistencias y tarjetas en tiempo real</p>
      </div>

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl space-y-2">
        <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Rival</label>
        <input type="text" placeholder="Ej: Real Madrid" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2">Titulares ({starters.length})</h3>
        {starters.length === 0 ? (
          <div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Coloca jugadores en la táctica primero</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-4 pt-0">
            {starters.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-well px-3 py-2 rounded-xl border border-border-subtle">
                <div className={`w-7 h-7 rounded-lg flex shrink-0 items-center justify-center font-black text-[9px] ${getCardStyle(p.rating)}`}>{p.rating}</div>
                <span className="text-[10px] font-bold uppercase italic text-black dark:text-white truncate">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button disabled={!canStart} onClick={() => onStart({ opponent: opponent.trim(), starters })} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400 disabled:opacity-40 disabled:active:scale-100">
        <Play size={16} /> Iniciar Partido
      </button>
    </div>
  );
}
