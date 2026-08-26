import { X, Trophy, Wallet, Users } from 'lucide-react';
import { formatCurrency, abbreviateValue } from '../../utils/format';
import { FORMATIONS } from '../../constants/formations';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import PerformanceTable from '../common/PerformanceTable';

// Ficha completa de una temporada YA ARCHIVADA (ver endSeason en ClubDataContext): palmarés,
// balance financiero, once ideal (a partir de lineupSnapshot, la alineación tal como estaba en
// el momento de cerrar la temporada) y la tabla de rendimiento individual de cada jugador de la
// plantilla de entonces — todo leído directamente del propio doc de la temporada (squadSnapshot
// ya lleva el desglose completo incrustado), nunca de los jugadores en vivo: así el detalle
// histórico sigue siendo consultable aunque un jugador se haya vendido después.
export default function SeasonDetailModal({ season, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const squad = season.squadSnapshot || [];
  const lineupSnapshot = season.lineupSnapshot;
  const slots = lineupSnapshot?.formation ? FORMATIONS[lineupSnapshot.formation] : null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Trophy size={16} className="shrink-0" /> Temporada {season.seasonNumber}</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4 pb-5 flex-1 overflow-y-auto no-scrollbar space-y-4">
          <div className="p-4 rounded-2xl bg-well border border-border-subtle space-y-2">
            <div className="flex items-center gap-2 text-yellow-500 font-black text-[10px] uppercase tracking-widest"><Trophy size={13} className="shrink-0" /> Palmarés</div>
            <p className="text-xs font-bold text-fg-muted">{season.titles?.length > 0 ? season.titles.join(', ') : 'Sin títulos registrados'}</p>
            {season.leaguePosition ? <p className="text-[10px] font-bold text-fg-faint uppercase tracking-wide">Posición Final en Liga: {season.leaguePosition}</p> : null}
            {season.prizeMoney > 0 ? <p className="text-[10px] font-bold text-green-500">+{formatCurrency(season.prizeMoney)} en premios</p> : null}
          </div>

          <div className="p-4 rounded-2xl bg-well border border-border-subtle space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-widest"><Wallet size={13} className="shrink-0" /> Balance Financiero</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-well-strong rounded-xl py-2">
                <div className="text-sm font-black text-fg">{season.wins}-{season.draws}-{season.losses}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint">V-E-D</div>
              </div>
              <div className="text-center bg-well-strong rounded-xl py-2">
                <div className="text-sm font-black text-fg">{season.goalsFor}-{season.goalsAgainst}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint">Goles</div>
              </div>
              <div className="text-center bg-well-strong rounded-xl py-2">
                <div className="text-sm font-black text-green-500">{abbreviateValue(season.budgetEnd)}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint">Presupuesto</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-fg-secondary font-black text-[10px] uppercase tracking-widest"><Users size={13} className="shrink-0" /> Once Ideal</div>
            {slots && lineupSnapshot?.lineup ? (
              <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                {slots.map((slot, i) => {
                  const playerId = lineupSnapshot.lineup[String(i)];
                  const player = squad.find((p) => p.playerId === playerId);
                  return (
                    <div key={i} className="px-3.5 py-2 flex items-center gap-3">
                      <span className="w-9 shrink-0 text-center text-[9px] font-black uppercase text-fg-faint bg-well-strong rounded-lg py-1">{slot.pos}</span>
                      <span className={`text-xs font-black truncate ${player ? 'text-fg' : 'text-fg-faint italic'}`}>{player?.name || 'Sin asignar'}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest bg-well rounded-2xl border border-border-subtle">No se guardó una alineación para esta temporada</div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-fg-secondary font-black text-[10px] uppercase tracking-widest">Rendimiento Individual</div>
            {squad.length > 0 ? (
              <PerformanceTable rows={[...squad].sort((a, b) => (b.rating || 0) - (a.rating || 0))} totals={null} labelKey="name" labelHeader="Jugador" />
            ) : (
              <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest bg-well rounded-2xl border border-border-subtle">Sin datos de plantilla para esta temporada</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
