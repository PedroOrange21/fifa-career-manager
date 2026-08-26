import { useState } from 'react';
import { ChevronDown, Trophy, ArrowLeftRight, ShieldAlert, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, abbreviateValue } from '../../utils/format';

// Sueldo semanal que realmente carga a nuestro club (mismo criterio que FinanceTab): el total
// del jugador, salvo que esté cedido fuera, caso en el que solo pesa el % que asumimos nosotros.
const effectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return Math.round((p.wage || 0) * (pct / 100));
  }
  return p.wage || 0;
};

const ovrGrowthOf = (p) => (p.rating || 0) - (p.seasonStartRating ?? p.rating ?? 0);
const valueGrowthOf = (p) => (p.marketValue || 0) - (p.seasonStartMarketValue ?? p.marketValue ?? 0);

function Section({ icon: Icon, title, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-well rounded-2xl border border-border-subtle overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-3.5 py-3 touch-manipulation">
        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${color}`}><Icon size={13} className="shrink-0" /> {title}</span>
        <ChevronDown size={13} className={`text-fg-faint transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3.5 pb-3.5 space-y-2 animate-in fade-in duration-150">{children}</div>}
    </div>
  );
}

function InsightRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-well-strong rounded-xl px-3 py-2">
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-widest text-fg-faint">{label}</div>
        {sub && <div className="text-[9px] font-bold text-fg-faint truncate">{sub}</div>}
      </div>
      <div className="text-xs font-black text-fg shrink-0">{value}</div>
    </div>
  );
}

// Informe analítico de fin de temporada: se calcula enteramente en el cliente a partir de los
// datos YA CARGADOS en "players" (seasonStats/seasonStartRating/seasonStartMarketValue), justo
// antes de que endSeason() los archive y reinicie — es la ÚLTIMA foto posible de la temporada
// que se está cerrando. No persiste nada por sí mismo (es puramente informativo dentro del
// asistente), así que no requiere ningún cambio en ClubDataContext.
export default function SeasonFeedbackReport({ players, prizeMoney = 0 }) {
  const activePlayers = players.filter((p) => p.type !== 'Cantera');

  const incomingLoans = activePlayers.filter((p) => p.type === 'Cedido');
  const outgoingLoans = activePlayers.filter((p) => p.transferStatus === 'CedidoFuera');

  const withGoals = activePlayers.filter((p) => (p.seasonStats?.goals || 0) > 0);
  const topScorer = withGoals.length ? withGoals.reduce((best, p) => (p.seasonStats.goals > best.seasonStats.goals ? p : best)) : null;
  const withAssists = activePlayers.filter((p) => (p.seasonStats?.assists || 0) > 0);
  const topAssister = withAssists.length ? withAssists.reduce((best, p) => (p.seasonStats.assists > best.seasonStats.assists ? p : best)) : null;
  const revalued = activePlayers.filter((p) => valueGrowthOf(p) > 0);
  const mostRevalued = revalued.length ? revalued.reduce((best, p) => (valueGrowthOf(p) > valueGrowthOf(best) ? p : best)) : null;
  const grown = activePlayers.filter((p) => ovrGrowthOf(p) > 0);
  const breakoutPlayer = grown.length ? grown.reduce((best, p) => (ovrGrowthOf(p) > ovrGrowthOf(best) ? p : best)) : null;

  // Posiciones huérfanas / sin rotación: solo un jugador cubriendo esa posición principal (fuera
  // de cesiones salientes, que no cuentan como disponibles). Sobrecarga: un jugador con muchos
  // más partidos que el resto de su misma posición, señal de que el club depende demasiado de él.
  const rotationPool = activePlayers.filter((p) => p.transferStatus !== 'CedidoFuera');
  const positionGroups = {};
  rotationPool.forEach((p) => {
    const pos = p.positions?.[0] || 'Sin posición';
    (positionGroups[pos] ||= []).push(p);
  });
  const orphanPositions = Object.entries(positionGroups).filter(([, group]) => group.length === 1).map(([pos, group]) => ({ pos, player: group[0] }));
  const overloadedPlayers = rotationPool.filter((p) => (p.seasonStats?.matchesPlayed || 0) > 45);

  const ATTACKING_POSITIONS = ['DC', 'ED', 'EI', 'MCO', 'SD'];
  const lowPerformers = activePlayers.filter((p) => {
    const s = p.seasonStats || {};
    if (s.averageRating > 0 && s.averageRating < 6.5) return true;
    if (ATTACKING_POSITIONS.includes(p.positions?.[0]) && (s.matchesPlayed || 0) >= 15 && (s.goals || 0) + (s.assists || 0) < 3) return true;
    return false;
  });
  const agingDecline = activePlayers.filter((p) => (p.age || 0) >= 30 && ovrGrowthOf(p) < 0);

  const annualWageBill = activePlayers.reduce((sum, p) => sum + effectiveWage(p), 0) * 52;
  const netBalance = prizeMoney - annualWageBill;

  const hasAnyLoans = incomingLoans.length > 0 || outgoingLoans.length > 0;
  const hasAnyAlert = orphanPositions.length > 0 || overloadedPlayers.length > 0 || lowPerformers.length > 0 || agingDecline.length > 0;

  return (
    <div className="space-y-3">
      <div className="text-xs font-black uppercase tracking-widest text-fg-secondary px-1">Informe y Feedback de Temporada</div>

      {hasAnyLoans && (
        <Section icon={ArrowLeftRight} title="Evolución de Cedidos" color="text-yellow-500">
          {incomingLoans.map((p) => {
            const growth = ovrGrowthOf(p);
            const avg = p.seasonStats?.averageRating || 0;
            const worthBuying = avg >= 7 || (p.seasonStats?.matchesPlayed || 0) >= 20;
            return (
              <div key={p.id} className="bg-well-strong rounded-xl px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-fg truncate">{p.name} <span className="text-[8px] text-fg-faint uppercase font-bold">(Cedido a nuestro club)</span></span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-black shrink-0 ${growth > 0 ? 'text-green-500' : growth < 0 ? 'text-red-400' : 'text-fg-faint'}`}>
                    {growth !== 0 && (growth > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />)} {p.seasonStartRating ?? p.rating} → {p.rating}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-fg-muted">{worthBuying ? '✅ Rindió lo suficiente: justifica ejecutar la opción de compra.' : '⚠️ Rendimiento insuficiente para justificar la compra — valora devolverlo.'}</p>
              </div>
            );
          })}
          {outgoingLoans.map((p) => {
            const growth = ovrGrowthOf(p);
            const avg = p.seasonStats?.averageRating || 0;
            const ready = growth > 0 && avg >= 6.8;
            return (
              <div key={p.id} className="bg-well-strong rounded-xl px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-fg truncate">{p.name} <span className="text-[8px] text-fg-faint uppercase font-bold">(Cedido Fuera)</span></span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-black shrink-0 ${growth > 0 ? 'text-green-500' : growth < 0 ? 'text-red-400' : 'text-fg-faint'}`}>
                    {growth !== 0 && (growth > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />)} {growth > 0 ? `+${growth}` : growth} OVR
                  </span>
                </div>
                <p className="text-[9px] font-bold text-fg-faint">PJ {p.seasonStats?.matchesPlayed ?? 0} · Nota {p.seasonStats?.averageRating || '—'}</p>
                <p className="text-[9px] font-bold text-fg-muted">{ready ? '✅ Progreso sólido: listo para pelear un puesto en el primer equipo.' : '⚠️ Aún no está listo — conviene una nueva cesión o valorar su venta.'}</p>
              </div>
            );
          })}
        </Section>
      )}

      <Section icon={Trophy} title="Puntos Fuertes" color="text-green-500">
        {!topScorer && !topAssister && !mostRevalued && !breakoutPlayer && (
          <p className="text-[10px] font-bold text-fg-faint">Sin datos suficientes todavía — escanea las estadísticas finales de la plantilla.</p>
        )}
        {topScorer && <InsightRow label="Máximo Goleador" value={`${topScorer.seasonStats.goals} G`} sub={topScorer.name} />}
        {topAssister && <InsightRow label="Mejor Asistente" value={`${topAssister.seasonStats.assists} A`} sub={topAssister.name} />}
        {mostRevalued && <InsightRow label="Más Revalorizado" value={`+${abbreviateValue(valueGrowthOf(mostRevalued))}`} sub={mostRevalued.name} />}
        {breakoutPlayer && <InsightRow label="Jugador Revelación" value={`+${ovrGrowthOf(breakoutPlayer)} OVR`} sub={breakoutPlayer.name} />}
      </Section>

      <Section icon={ShieldAlert} title="Áreas de Mejora y Alertas" color="text-red-400">
        {!hasAnyAlert && <p className="text-[10px] font-bold text-fg-faint">Sin alertas relevantes esta temporada.</p>}
        {orphanPositions.map(({ pos, player }) => (
          <InsightRow key={`orphan-${pos}`} label={`Falta de Rotación · ${pos}`} value="1 jugador" sub={`${player.name} es el único disponible en esa posición`} />
        ))}
        {overloadedPlayers.map((p) => (
          <InsightRow key={`overload-${p.id}`} label="Sobrecarga de Partidos" value={`${p.seasonStats.matchesPlayed} PJ`} sub={p.name} />
        ))}
        {lowPerformers.map((p) => (
          <InsightRow key={`low-${p.id}`} label="Rendimiento Bajo" value={p.seasonStats?.averageRating ? `Nota ${p.seasonStats.averageRating}` : 'Sin impacto'} sub={p.name} />
        ))}
        {agingDecline.map((p) => (
          <InsightRow key={`aging-${p.id}`} label="Declive por Edad" value={`${ovrGrowthOf(p)} OVR · ${p.age} años`} sub={`${p.name} — planifica su relevo`} />
        ))}
      </Section>

      <Section icon={Wallet} title="Consejo Financiero" color="text-blue-400">
        <InsightRow label="Premios de la Temporada" value={`+${formatCurrency(prizeMoney)}`} />
        <InsightRow label="Masa Salarial Anual" value={`-${formatCurrency(annualWageBill)}`} />
        <div className={`rounded-xl px-3 py-2.5 text-[10px] font-bold ${netBalance >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'}`}>
          {netBalance >= 0
            ? `Los premios cubren la masa salarial anual con un margen de ${formatCurrency(netBalance)}.`
            : `La masa salarial anual supera lo ganado en premios por ${formatCurrency(Math.abs(netBalance))} — vigila el presupuesto del próximo curso.`}
        </div>
      </Section>
    </div>
  );
}
