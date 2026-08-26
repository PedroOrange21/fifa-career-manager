import { useMemo, useState } from 'react';
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

let customTitleIdCounter = 0;
const nextCustomTitleId = () => `custom-title-${Date.now()}-${customTitleIdCounter++}`;

// Asistente de 4 pasos para "Terminar Temporada" (Temporadas), sustituye al antiguo
// ConfirmModal genérico: Balance y Palmarés (títulos dinámicos según las competiciones ya
// detectadas en las estadísticas de la plantilla, cada uno con su propio premio económico, más
// "Otro Título" para cualquier competición que la IA no haya visto todavía) -> Escaneo Final de
// Rendimiento y Comparador (reutiliza el mismo escaneo masivo de Estadísticas que Onboarding/
// PlayerStatsTab, obligatorio antes de avanzar) -> Resolución de Cesiones y Contratos (comprar/
// devolver cesiones entrantes, recuperar cesiones salientes, renovar contratos a punto de
// finalizar) -> Confirmar, que ejecuta endSeason() (el snapshot de careerHistory/edad/contrato/
// reseteo de stats ya lo hace endSeason por sí solo, ver ClubDataContext).
export default function EndSeasonWizard({ onClose }) {
  useAutoHideChrome();
  useBodyScrollLock();
  const { activeClub } = useClubs();
  const { players, endSeason, resolveIncomingLoan, setPlayerTransferStatus, renewContract } = useClubData();

  const [step, setStep] = useState(0);
  const currentStepId = STEP_SEQUENCE[step];

  // Competiciones ya detectadas en las estadísticas de la plantilla (ver competitionBreakdown en
  // seasonStats, poblado por el escaneo individual/masivo de Estadísticas durante la temporada):
  // cada una se ofrece como un título marcable con su propio premio económico, en vez de un
  // campo de texto libre. "customTitles" cubre cualquier competición que la IA no haya visto
  // todavía (p. ej. si nunca se escaneó un desglose por competición).
  const availableCompetitions = useMemo(() => {
    const set = new Set();
    players.forEach((p) => (p.seasonStats?.competitionBreakdown || []).forEach((c) => { if (c.competition) set.add(c.competition); }));
    return Array.from(set);
  }, [players]);

  const [titleSelections, setTitleSelections] = useState({}); // { [competicion]: { checked, prize } }
  const [customTitles, setCustomTitles] = useState([]); // [{ id, name, prize }]
  const [leaguePosition, setLeaguePosition] = useState('');

  const toggleTitle = (name) => setTitleSelections((prev) => ({ ...prev, [name]: { checked: !prev[name]?.checked, prize: prev[name]?.prize || '' } }));
  const setTitlePrize = (name, raw) => setTitleSelections((prev) => ({ ...prev, [name]: { checked: true, prize: formatValueInput(raw) } }));
  const addCustomTitle = () => setCustomTitles((prev) => [...prev, { id: nextCustomTitleId(), name: '', prize: '' }]);
  const updateCustomTitle = (id, patch) => setCustomTitles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeCustomTitle = (id) => setCustomTitles((prev) => prev.filter((t) => t.id !== id));

  const selectedTitleNames = [
    ...Object.entries(titleSelections).filter(([, v]) => v.checked).map(([name]) => name),
    ...customTitles.map((t) => t.name.trim()).filter(Boolean),
  ];
  const totalPrizeMoney = Object.values(titleSelections).filter((v) => v.checked).reduce((sum, v) => sum + parseValue(v.prize), 0)
    + customTitles.reduce((sum, t) => sum + parseValue(t.prize), 0);

  // Escaneo Final de Rendimiento: obligatorio antes de poder avanzar a Cesiones/Contratos — se
  // marca en cuanto se aplica al menos una revisión de estadísticas dentro de ESTE asistente
  // (ver onDone de StatsImportReviewModal más abajo), nunca antes.
  const [statsScanMode, setStatsScanMode] = useState(false);
  const [statsReview, setStatsReview] = useState(null);
  const [hasScannedFinal, setHasScannedFinal] = useState(false);

  const incomingLoans = players.filter((p) => p.type === 'Cedido');
  const outgoingLoans = players.filter((p) => p.transferStatus === 'CedidoFuera' && p.outboundLoan);
  const expiringContracts = players.filter((p) => p.type !== 'Cantera' && p.type !== 'Cedido' && p.contractYears != null && p.contractYears <= 1);

  const [isEnding, setIsEnding] = useState(false);

  const canAdvance = currentStepId !== 'scan' || hasScannedFinal;
  const goNext = () => { if (canAdvance) setStep((s) => Math.min(STEP_SEQUENCE.length - 1, s + 1)); };
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const handleConfirm = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await endSeason({
        titles: selectedTitleNames,
        leaguePosition: leaguePosition ? parseInt(leaguePosition, 10) : null,
        prizeMoney: totalPrizeMoney,
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
                  <div className="space-y-2 mt-1">
                    {availableCompetitions.length === 0 && customTitles.length === 0 && (
                      <p className="text-[10px] font-bold text-fg-faint px-1">No se detectaron competiciones en las estadísticas de la plantilla todavía. Añade un título con "Otro Título".</p>
                    )}
                    {availableCompetitions.map((comp) => {
                      const sel = titleSelections[comp] || { checked: false, prize: '' };
                      return (
                        <div key={comp} className="p-2.5 rounded-xl bg-well border border-border-subtle space-y-2">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => toggleTitle(comp)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors touch-manipulation ${sel.checked ? 'border-green-500 bg-green-500' : 'border-border-subtle'}`}>
                              {sel.checked && <Check size={12} className="text-black" />}
                            </button>
                            <span className="flex-1 text-xs font-black text-fg truncate">{comp}</span>
                          </div>
                          {sel.checked && (
                            <input type="text" inputMode="numeric" value={sel.prize} onChange={(e) => setTitlePrize(comp, e.target.value)} placeholder="Premio económico (€)" className="w-full bg-well-strong p-2.5 rounded-lg outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint" />
                          )}
                        </div>
                      );
                    })}
                    {customTitles.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-well border border-border-subtle space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={t.name} onChange={(e) => updateCustomTitle(t.id, { name: e.target.value })} placeholder="Nombre del título" className="flex-1 bg-well-strong p-2.5 rounded-lg outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint" />
                          <button type="button" onClick={() => removeCustomTitle(t.id)} className="shrink-0 p-2 text-fg-faint hover:text-red-400 transition-colors touch-manipulation"><X size={14} /></button>
                        </div>
                        <input type="text" inputMode="numeric" value={t.prize} onChange={(e) => updateCustomTitle(t.id, { prize: formatValueInput(e.target.value) })} placeholder="Premio económico (€)" className="w-full bg-well-strong p-2.5 rounded-lg outline-none border border-border-subtle focus:border-green-500 font-bold text-xs text-fg placeholder:text-fg-faint" />
                      </div>
                    ))}
                    <button type="button" onClick={addCustomTitle} className="w-full py-2.5 rounded-xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest touch-manipulation">
                      <Plus size={13} /> Otro Título
                    </button>
                  </div>
                  {totalPrizeMoney > 0 && (
                    <p className="text-[9px] font-bold text-green-500 mt-2 ml-1">Total en premios: {formatCurrency(totalPrizeMoney)} (se sumará al Presupuesto de Traspasos)</p>
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
              </div>
            )}

            {currentStepId === 'scan' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-well border border-border-subtle">
                  <p className="text-xs font-bold text-fg-muted leading-relaxed">Escanea la pantalla final de <span className="text-fg font-black">Centro de Plantilla &gt; Estadísticas</span> de cada jugador para actualizar su rendimiento y ver el crecimiento de la temporada.</p>
                </div>
                {!hasScannedFinal && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex gap-2 text-yellow-500 text-[10px] font-bold items-center">
                    <AlertTriangle size={14} className="shrink-0" /><span>Es obligatorio escanear y aplicar las estadísticas finales antes de continuar.</span>
                  </div>
                )}
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
                  <p className="text-[10px] font-bold text-fg-muted">{selectedTitleNames.length > 0 ? `Títulos: ${selectedTitleNames.join(', ')}` : 'Sin títulos registrados'}{leaguePosition ? ` · Posición ${leaguePosition}` : ''}</p>
                  {totalPrizeMoney > 0 && <p className="text-[10px] font-bold text-green-500">+{formatCurrency(totalPrizeMoney)} en premios</p>}
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
            <button type="button" onClick={goNext} disabled={!canAdvance} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:bg-green-500">
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
          onDone={() => { setStatsReview(null); setHasScannedFinal(true); }}
        />
      )}
    </div>
  );
}
