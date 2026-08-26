import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trophy, Plus, TrendingUp, TrendingDown, ArrowDownToLine, Undo2, RefreshCcw, Check, AlertTriangle } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatValueInput, parseValue, formatCurrency, abbreviateValue } from '../../utils/format';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import AIGlowButton from '../common/AIGlowButton';
import ScanPlayerCardModal from '../squad/ScanPlayerCardModal';
import StatsImportReviewModal from '../squad/StatsImportReviewModal';

const STEP_SEQUENCE = ['balance', 'scan', 'loans', 'confirm'];
const STEP_LABELS = {
  balance: 'Balance y Palmarés',
  scan: 'Rendimiento Final',
  loans: 'Cesiones y Contratos',
  confirm: 'Confirmar',
};

// Asistente de 4 pasos para "Terminar Temporada" (Temporadas), sustituye al antiguo
// ConfirmModal genérico: Balance y Palmarés (títulos/posición/premios, informativos salvo el
// premio económico que sí suma al presupuesto) -> Escaneo Final de Rendimiento y Comparador
// (reutiliza el mismo escaneo masivo de Estadísticas que Onboarding/PlayerStatsTab, luego
// muestra el crecimiento OVR/valor de cada jugador ya actualizado) -> Resolución de Cesiones y
// Contratos (comprar/devolver cesiones entrantes, recuperar cesiones salientes, renovar
// contratos a punto de finalizar) -> Confirmar, que ejecuta endSeason() con los datos del Paso
// 1 (el snapshot de careerHistory/edad/contrato/reseteo de stats ya lo hace endSeason por sí
// solo, ver ClubDataContext).
export default function EndSeasonWizard({ onClose }) {
  useAutoHideChrome();
  useBodyScrollLock();
  const { activeClub } = useClubs();
  const { players, endSeason, resolveIncomingLoan, setPlayerTransferStatus, renewContract } = useClubData();

  const [step, setStep] = useState(0);
  const currentStepId = STEP_SEQUENCE[step];

  const [titles, setTitles] = useState([]);
  const [titleInput, setTitleInput] = useState('');
  const [leaguePosition, setLeaguePosition] = useState('');
  const [prizeMoneyInput, setPrizeMoneyInput] = useState('');

  const addTitle = () => {
    const t = titleInput.trim();
    if (!t) return;
    setTitles((prev) => [...prev, t]);
    setTitleInput('');
  };
  const removeTitle = (i) => setTitles((prev) => prev.filter((_, idx) => idx !== i));

  const [statsScanMode, setStatsScanMode] = useState(false);
  const [statsReview, setStatsReview] = useState(null);

  const incomingLoans = players.filter((p) => p.type === 'Cedido');
  const outgoingLoans = players.filter((p) => p.transferStatus === 'CedidoFuera' && p.outboundLoan);
  const expiringContracts = players.filter((p) => p.type !== 'Cantera' && p.type !== 'Cedido' && p.contractYears != null && p.contractYears <= 1);

  const [isEnding, setIsEnding] = useState(false);

  const goNext = () => setStep((s) => Math.min(STEP_SEQUENCE.length - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const handleConfirm = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await endSeason({
        titles,
        leaguePosition: leaguePosition ? parseInt(leaguePosition, 10) : null,
        prizeMoney: parseValue(prizeMoneyInput),
      });
      onClose?.();
    } catch (err) {
      console.error('Error terminando la temporada:', err);
      setIsEnding(false);
    }
  };

  // Comparador: cualquier jugador con una foto de inicio de temporada (seasonStartRating) ya
  // tiene algo que comparar, aunque el crecimiento sea 0 — ordenado de mayor a menor progreso.
  const comparablePlayers = [...players]
    .filter((p) => p.seasonStartRating != null)
    .sort((a, b) => ((b.rating || 0) - (b.seasonStartRating ?? b.rating ?? 0)) - ((a.rating || 0) - (a.seasonStartRating ?? a.rating ?? 0)));

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <div className="min-w-0">
            <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Trophy size={16} className="shrink-0" /> Terminar Temporada</h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-fg-faint mt-0.5">Paso {step + 1} de {STEP_SEQUENCE.length} · {STEP_LABELS[currentStepId]}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isEnding} className="shrink-0 p-2 rounded-full text-fg-faint hover:text-fg hover:bg-well transition-colors disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-1.5">
            {STEP_SEQUENCE.map((id, i) => (
              <div key={id} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar">
          <div key={currentStepId} className="space-y-4 pb-4 animate-in fade-in duration-300">

            {currentStepId === 'balance' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Títulos Conseguidos</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTitle(); } }}
                      placeholder="Ej: Liga, Copa..."
                      className="flex-1 bg-well-strong p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint"
                    />
                    <button type="button" onClick={addTitle} className="shrink-0 w-11 h-11 rounded-xl bg-green-500 text-black flex items-center justify-center touch-manipulation"><Plus size={18} /></button>
                  </div>
                  {titles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {titles.map((t, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                          🏆 {t} <button type="button" onClick={() => removeTitle(i)} className="touch-manipulation"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Posición Final en Liga</label>
                  <input
                    type="number"
                    min="1"
                    value={leaguePosition}
                    onChange={(e) => setLeaguePosition(e.target.value)}
                    placeholder="Ej: 1"
                    className="w-full mt-1 bg-well-strong p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Premios Económicos (€)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={prizeMoneyInput}
                    onChange={(e) => setPrizeMoneyInput(formatValueInput(e.target.value))}
                    placeholder="0"
                    className="w-full mt-1 bg-well-strong p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint"
                  />
                  <p className="text-[9px] font-bold text-fg-faint mt-1 ml-1">Se sumará directamente al Presupuesto de Traspasos.</p>
                </div>
              </div>
            )}

            {currentStepId === 'scan' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-well border border-border-subtle">
                  <p className="text-xs font-bold text-fg-muted leading-relaxed">Escanea la pantalla final de <span className="text-fg font-black">Centro de Plantilla &gt; Estadísticas</span> de cada jugador para actualizar su rendimiento y ver el crecimiento de la temporada.</p>
                </div>
                <AIGlowButton onClick={() => setStatsScanMode(true)}>
                  Escanear Rendimiento Final
                </AIGlowButton>

                {comparablePlayers.length > 0 && (
                  <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    {comparablePlayers.map((p) => {
                      const ovrGrowth = (p.rating || 0) - (p.seasonStartRating ?? p.rating ?? 0);
                      const valueGrowth = (p.marketValue || 0) - (p.seasonStartMarketValue ?? p.marketValue ?? 0);
                      const stats = p.seasonStats || {};
                      return (
                        <div key={p.id} className="px-3.5 py-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-fg truncate">{p.name}</span>
                            <span className={`flex items-center gap-1 text-[10px] font-black shrink-0 px-2 py-0.5 rounded-full ${ovrGrowth > 0 ? 'bg-green-500/10 text-green-500' : ovrGrowth < 0 ? 'bg-red-500/10 text-red-400' : 'bg-well-strong text-fg-faint'}`}>
                              {p.seasonStartRating ?? p.rating} → {p.rating}
                              {ovrGrowth !== 0 && (ovrGrowth > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-fg-faint uppercase tracking-wide">
                            <span>PJ {stats.matchesPlayed ?? 0} · G {stats.goals ?? 0} · A {stats.assists ?? 0}</span>
                            <span className={valueGrowth > 0 ? 'text-green-500' : valueGrowth < 0 ? 'text-red-400' : ''}>{abbreviateValue(p.marketValue)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {currentStepId === 'loans' && (
              <div className="space-y-4">
                {incomingLoans.length === 0 && outgoingLoans.length === 0 && expiringContracts.length === 0 && (
                  <div className="p-8 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Nada pendiente de resolver</div>
                )}

                {incomingLoans.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-yellow-500"><ArrowDownToLine size={12} /> Cesiones Entrantes</div>
                    <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                      {incomingLoans.map((p) => (
                        <div key={p.id} className="p-3 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-fg truncate">{p.name}</div>
                            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.originClub || 'Club de origen sin definir'}{p.buyOption ? ` · Opción ${formatCurrency(p.buyOption)}` : ''}</div>
                          </div>
                          <button type="button" onClick={() => resolveIncomingLoan(p, 'buy')} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-green-500 text-black touch-manipulation">Comprar</button>
                          <button type="button" onClick={() => resolveIncomingLoan(p, 'return')} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-well-strong text-fg-muted touch-manipulation">Devolver</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {outgoingLoans.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-zinc-400"><Undo2 size={12} /> Cesiones Salientes</div>
                    <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                      {outgoingLoans.map((p) => (
                        <div key={p.id} className="p-3 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-fg truncate">{p.name}</div>
                            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">Cedido Fuera · {p.outboundLoan?.duration || 'Sin definir'}</div>
                          </div>
                          <button type="button" onClick={() => setPlayerTransferStatus(p.id, 'Activo')} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-green-500 text-black flex items-center gap-1 touch-manipulation"><Undo2 size={11} /> Recuperar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expiringContracts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-red-400"><AlertTriangle size={12} /> Contratos a Punto de Finalizar</div>
                    <div className="bg-well rounded-2xl border border-red-500/20 divide-y divide-border-subtle overflow-hidden">
                      {expiringContracts.map((p) => (
                        <div key={p.id} className="p-3 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-fg truncate">{p.name}</div>
                            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.contractYears === 0 ? 'Contrato finalizado' : `${p.contractYears} año restante`}</div>
                          </div>
                          <button type="button" onClick={() => renewContract(p.id, 2)} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1 touch-manipulation"><RefreshCcw size={11} /> Renovar +2</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStepId === 'confirm' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-well border border-border-subtle space-y-2">
                  <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest"><Trophy size={13} /> Resumen de la Temporada {activeClub?.currentSeasonNumber ?? 1}</div>
                  <p className="text-[10px] font-bold text-fg-muted">{titles.length > 0 ? `Títulos: ${titles.join(', ')}` : 'Sin títulos registrados'}{leaguePosition ? ` · Posición ${leaguePosition}` : ''}</p>
                  {parseValue(prizeMoneyInput) > 0 && <p className="text-[10px] font-bold text-green-500">+{formatCurrency(parseValue(prizeMoneyInput))} en premios</p>}
                </div>
                <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
                  <p className="text-[10px] font-bold text-fg-muted leading-relaxed">Al confirmar: toda la plantilla envejece un año, los contratos restantes se reducen en un año, las estadísticas de esta temporada se archivan en el historial de carrera de cada jugador y se reinician a 0 para la nueva temporada.</p>
                </div>
              </div>
            )}

          </div>
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {step > 0 && (
            <button type="button" onClick={goPrev} disabled={isEnding} className="shrink-0 w-14 flex items-center justify-center bg-well text-fg-muted p-4 rounded-xl hover:bg-well-strong transition-all disabled:opacity-50">
              <ChevronLeft size={18} />
            </button>
          )}
          {currentStepId !== 'confirm' ? (
            <button type="button" onClick={goNext} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all">
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleConfirm} disabled={isEnding} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-400 transition-all disabled:opacity-50">
              {isEnding ? 'Guardando...' : (<><Check size={16} /> Confirmar y Empezar Nueva Temporada</>)}
            </button>
          )}
        </footer>
      </div>

      {statsScanMode && (
        <ScanPlayerCardModal
          mode="estadisticas"
          forceBatch
          onClose={() => setStatsScanMode(false)}
          onBatchExtracted={(results) => { setStatsReview(results); setStatsScanMode(false); }}
        />
      )}
      {statsReview && (
        <StatsImportReviewModal
          results={statsReview}
          onClose={() => setStatsReview(null)}
          onDone={() => setStatsReview(null)}
        />
      )}
    </div>
  );
}
