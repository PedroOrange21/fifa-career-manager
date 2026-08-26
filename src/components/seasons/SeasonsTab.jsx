import { useState } from 'react';
import { CalendarClock, Trophy, GitCompareArrows } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { abbreviateValue } from '../../utils/format';
import EndSeasonWizard from './EndSeasonWizard';
import SeasonCompare from './SeasonCompare';

export default function SeasonsTab() {
  const { activeClub } = useClubs();
  const { seasons } = useClubData();
  const [showWizard, setShowWizard] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compareSeasons = compareIds.map((id) => seasons.find((s) => s.id === id)).filter(Boolean);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl text-center">
        <CalendarClock className="mx-auto mb-2 text-green-500" size={28} />
        <h2 className="text-lg font-black uppercase italic tracking-tighter text-fg">Temporada {activeClub?.currentSeasonNumber ?? 1}</h2>
        <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">En curso</p>
        <button onClick={() => setShowWizard(true)} className="w-full mt-4 bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all hover:bg-green-400">Terminar Temporada</button>
      </div>

      {compareSeasons.length === 2 && <SeasonCompare seasons={compareSeasons} />}

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2 flex items-center gap-2"><Trophy size={12} /> Historial de Temporadas</h3>
        {seasons.length === 0 && (<div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Aún no has terminado ninguna temporada</div>)}
        {seasons.length > 0 && (
          <p className="px-4 pb-2 text-[9px] text-fg-faint font-bold uppercase tracking-widest flex items-center gap-1"><GitCompareArrows size={11} /> Toca dos temporadas para compararlas</p>
        )}
        <div className="divide-y divide-border-subtle">
          {seasons.map((s) => {
            const avgRating = s.squadSnapshot?.length ? Math.round(s.squadSnapshot.reduce((sum, p) => sum + p.rating, 0) / s.squadSnapshot.length) : null;
            const selected = compareIds.includes(s.id);
            return (
              <button key={s.id} onClick={() => toggleCompare(s.id)} className={`w-full text-left p-4 flex items-center justify-between gap-4 transition-all ${selected ? 'bg-green-500/10' : 'hover:bg-well'}`}>
                <div>
                  <div className="font-black uppercase italic text-sm text-fg">Temporada {s.seasonNumber}</div>
                  <div className="text-[9px] text-fg-faint font-black uppercase tracking-widest mt-0.5">{s.wins}V {s.draws}E {s.losses}D · {s.goalsFor}-{s.goalsAgainst} goles</div>
                </div>
                <div className="text-right shrink-0">
                  {avgRating && <div className="text-[9px] text-fg-muted font-black uppercase tracking-widest">Media {avgRating}</div>}
                  <div className="text-[9px] text-green-500 font-black uppercase tracking-widest">{abbreviateValue(s.budgetEnd)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showWizard && <EndSeasonWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
}
