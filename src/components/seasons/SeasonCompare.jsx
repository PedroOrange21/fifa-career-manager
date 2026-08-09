import { GitCompareArrows } from 'lucide-react';
import { abbreviateValue } from '../../utils/format';

const avgRating = (s) => s.squadSnapshot?.length ? Math.round(s.squadSnapshot.reduce((sum, p) => sum + p.rating, 0) / s.squadSnapshot.length) : 0;

function Row({ label, valueA, valueB }) {
  return (
    <div className="grid grid-cols-3 items-center py-2 border-b border-border-subtle last:border-0">
      <span className="text-sm font-black text-fg text-left truncate">{valueA}</span>
      <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted text-center">{label}</span>
      <span className="text-sm font-black text-fg text-right truncate">{valueB}</span>
    </div>
  );
}

export default function SeasonCompare({ seasons }) {
  const [a, b] = [...seasons].sort((s1, s2) => s1.seasonNumber - s2.seasonNumber);
  const topScorerA = a.topScorers?.[0];
  const topScorerB = b.topScorers?.[0];

  return (
    <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-green-500/20 shadow-2xl animate-in fade-in">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-green-500 italic mb-4 flex items-center gap-2"><GitCompareArrows size={14} /> Comparativa de Temporadas</h3>
      <div className="flex justify-between mb-4">
        <span className="text-xs font-black uppercase italic text-fg">Temp. {a.seasonNumber}</span>
        <span className="text-xs font-black uppercase italic text-fg">Temp. {b.seasonNumber}</span>
      </div>
      <Row label="Partidos" valueA={a.matchesPlayed} valueB={b.matchesPlayed} />
      <Row label="V / E / D" valueA={`${a.wins}/${a.draws}/${a.losses}`} valueB={`${b.wins}/${b.draws}/${b.losses}`} />
      <Row label="Goles a Favor" valueA={a.goalsFor} valueB={b.goalsFor} />
      <Row label="Goles en Contra" valueA={a.goalsAgainst} valueB={b.goalsAgainst} />
      <Row label="Media de Plantilla" valueA={avgRating(a)} valueB={avgRating(b)} />
      <Row label="Máximo Goleador" valueA={topScorerA ? `${topScorerA.name} (${topScorerA.goals})` : '—'} valueB={topScorerB ? `${topScorerB.name} (${topScorerB.goals})` : '—'} />
      <Row label="Presupuesto Final" valueA={abbreviateValue(a.budgetEnd)} valueB={abbreviateValue(b.budgetEnd)} />
    </div>
  );
}
