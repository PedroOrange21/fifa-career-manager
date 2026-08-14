import { useEffect, useState } from 'react';
import { X, Check, ChevronLeft, ChevronRight, Plus, Trash2, Wallet, Users, Sparkles, RotateCcw } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { ALL_POSITIONS } from '../../constants/positions';
import { formatValueInput, parseValue, formatCurrency, isValidPotentialInput } from '../../utils/format';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import Dropdown from '../common/Dropdown';

const POSITION_OPTIONS = ALL_POSITIONS.map((p) => ({ value: p, label: p }));
const TOTAL_STEPS = 5;

const newActiveRow = () => ({ id: crypto.randomUUID(), name: '', position: '', rating: '', age: '', wage: '', releaseClause: '' });
const newAcademyRow = () => ({ id: crypto.randomUUID(), name: '', potential: '', rating: '', age: '', position: '' });
const newLoanedRow = () => ({ id: crypto.randomUUID(), name: '', position: '', rating: '', age: '', destinationClub: '', wagePercentage: '' });

// h-[52px]: misma altura que el componente Dropdown (fija, sin prop para personalizarla),
// para que ambos queden alineados cuando comparten fila en un grid.
const FIELD = 'w-full h-[52px] bg-well-strong px-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg text-sm placeholder:text-fg-faint';
const FIELD_CENTER = `${FIELD} text-center`;

// Puerta de entrada: decide si corresponde mostrar el asistente (sin montar sus hooks de
// "pantalla limpia" salvo que realmente vaya a mostrarse) y, si es así, monta el modal.
// Condición de activación: hay un club activo, ya se resolvió el primer snapshot de
// jugadores (playersLoaded evita el falso positivo al cambiar de club), la plantilla está
// realmente vacía y este club no tiene el onboarding ya resuelto (completado u omitido).
export default function OnboardingWizard() {
  const { activeClub } = useClubs();
  const { players, playersLoaded } = useClubData();
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  // Si se cambia de club (p. ej. desde el menú de usuario), se reevalúa desde cero para el
  // club recién activado, en vez de arrastrar el "omitido" de la partida anterior.
  useEffect(() => { setLocallyDismissed(false); }, [activeClub?.id]);

  const shouldShow = !!activeClub && playersLoaded && players.length === 0 && !activeClub.onboardingCompleted && !locallyDismissed;
  if (!shouldShow) return null;
  return <OnboardingWizardModal onDismiss={() => setLocallyDismissed(true)} />;
}

function OnboardingWizardModal({ onDismiss }) {
  useAutoHideChrome();
  const { setBudget, completeOnboarding } = useClubs();
  const { addOrUpdatePlayer } = useClubData();

  const [step, setStep] = useState(1);
  const [startType, setStartType] = useState(null); // 'scratch' | 'continue'
  const [activePlayers, setActivePlayers] = useState([]);
  const [hasAcademy, setHasAcademy] = useState(null);
  const [academyPlayers, setAcademyPlayers] = useState([]);
  const [hasLoanedOut, setHasLoanedOut] = useState(null);
  const [loanedPlayers, setLoanedPlayers] = useState([]);
  const [initialBudget, setInitialBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const updateRow = (setter) => (id, field, value) => setter((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = (setter, factory) => () => setter((rows) => [...rows, factory()]);
  const removeRow = (setter) => (id) => setter((rows) => rows.filter((r) => r.id !== id));

  const updateActiveRow = updateRow(setActivePlayers);
  const addActiveRow = addRow(setActivePlayers, newActiveRow);
  const removeActiveRow = removeRow(setActivePlayers);

  const updateAcademyRow = updateRow(setAcademyPlayers);
  const addAcademyRow = addRow(setAcademyPlayers, newAcademyRow);
  const removeAcademyRow = removeRow(setAcademyPlayers);

  const updateLoanedRow = updateRow(setLoanedPlayers);
  const addLoanedRow = addRow(setLoanedPlayers, newLoanedRow);
  const removeLoanedRow = removeRow(setLoanedPlayers);

  // "Por defecto sugiere entre 3 y 4": al responder que sí, se precargan 3 filas vacías
  // listas para rellenar, en vez de obligar a pulsar "+" repetidamente.
  const answerHasAcademy = (val) => {
    setHasAcademy(val);
    if (val) { if (academyPlayers.length === 0) setAcademyPlayers([newAcademyRow(), newAcademyRow(), newAcademyRow()]); }
    else setAcademyPlayers([]);
  };
  const answerHasLoanedOut = (val) => {
    setHasLoanedOut(val);
    if (val) { if (loanedPlayers.length === 0) setLoanedPlayers([newLoanedRow()]); }
    else setLoanedPlayers([]);
  };

  // "Empezar desde cero" no tiene plantilla, academia ni cedidos que registrar: los pasos
  // 2-4 se saltan por completo, yendo directos del Paso 1 al Paso 5 (Finanzas) y viceversa.
  const goNext = () => {
    setError('');
    if (step === 1) {
      if (!startType) { setError('Elige cómo quieres empezar.'); return; }
      setStep(startType === 'scratch' ? 5 : 2);
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };
  const goPrev = () => {
    setError('');
    if (step === 5 && startType === 'scratch') { setStep(1); return; }
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSkip = async () => {
    onDismiss();
    try { await completeOnboarding(); } catch (err) { console.error(err); }
  };

  const handleFinish = async () => {
    if (isSaving) return;
    setError('');
    setIsSaving(true);
    try {
      const tasks = [];

      for (const p of activePlayers) {
        if (!p.name.trim()) continue;
        tasks.push(addOrUpdatePlayer({
          name: p.name.trim(),
          positions: p.position ? [p.position] : [],
          rating: parseInt(p.rating) || 1,
          age: parseInt(p.age) || 18,
          preferredFoot: 'Diestro',
          type: 'Comprado',
          value: 0,
          marketValue: 0,
          wage: parseValue(p.wage),
          releaseClause: parseValue(p.releaseClause) || null,
          transferStatus: 'Activo',
        }));
      }

      for (const p of academyPlayers) {
        if (!p.name.trim()) continue;
        const potential = p.potential.trim();
        tasks.push(addOrUpdatePlayer({
          name: p.name.trim(),
          positions: p.position ? [p.position] : [],
          rating: parseInt(p.rating) || 1,
          age: parseInt(p.age) || 16,
          preferredFoot: 'Diestro',
          type: 'Cantera',
          value: 0,
          marketValue: 0,
          wage: 0,
          potential: potential && isValidPotentialInput(potential) ? potential : null,
          transferStatus: 'Activo',
        }));
      }

      for (const p of loanedPlayers) {
        if (!p.name.trim()) continue;
        tasks.push(addOrUpdatePlayer({
          name: p.name.trim(),
          positions: p.position ? [p.position] : [],
          rating: parseInt(p.rating) || 1,
          age: parseInt(p.age) || 18,
          preferredFoot: 'Diestro',
          type: 'Comprado',
          value: 0,
          marketValue: 0,
          wage: 0,
          transferStatus: 'CedidoFuera',
          outboundLoan: {
            destinationClub: p.destinationClub.trim() || 'Club desconocido',
            duration: '1 Temporada',
            wagePercentage: parseInt(p.wagePercentage) || 0,
          },
        }));
      }

      if (initialBudget) tasks.push(setBudget(parseValue(initialBudget)));

      await Promise.all(tasks);
      onDismiss();
      await completeOnboarding();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar todo. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  // Vista previa de la masa salarial mensual que arrastrará el club con los sueldos ya
  // introducidos en el Paso 2 (informativa: la cifra real siempre se recalcula a partir de
  // los jugadores guardados, igual que en Finanzas — aquí solo se anticipa el resultado).
  const projectedWageBill = activePlayers.reduce((sum, p) => sum + (parseValue(p.wage) || 0), 0);

  const stepLabel = ['Tipo de Inicio', 'Plantilla Activa', 'Academia', 'Cedidos', 'Finanzas'][step - 1];
  const isLastStep = step === TOTAL_STEPS;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <div className="min-w-0">
            <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Sparkles size={16} className="shrink-0" /> Bienvenido a tu Club</h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-fg-faint mt-0.5">Paso {step} de {TOTAL_STEPS} · {stepLabel}</p>
          </div>
          <button type="button" onClick={handleSkip} title="Omitir y configurar más tarde" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-fg-faint hover:text-fg hover:bg-well transition-colors text-[9px] font-black uppercase tracking-widest">
            Omitir <X size={14} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${n <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 text-red-400 text-[10px] font-black">{error}</div>
          )}

          <div className="space-y-4 pb-4 animate-in fade-in duration-300">
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-fg-muted">¿Cómo quieres empezar tu Modo Carrera?</p>
                <button type="button" onClick={() => setStartType('scratch')} className={`w-full p-4 rounded-2xl border text-left transition-all ${startType === 'scratch' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                  <div className="font-black uppercase text-sm flex items-center gap-2"><RotateCcw size={16} /> Empezar desde Cero</div>
                  <div className="text-[10px] font-bold mt-1 opacity-70">Sin plantilla todavía — la irás fichando tú mismo desde la Plantilla y el Mercado.</div>
                </button>
                <button type="button" onClick={() => setStartType('continue')} className={`w-full p-4 rounded-2xl border text-left transition-all ${startType === 'continue' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                  <div className="font-black uppercase text-sm flex items-center gap-2"><Users size={16} /> Continuar un Modo Carrera ya Empezado</div>
                  <div className="text-[10px] font-bold mt-1 opacity-70">Registra ahora tu plantilla, academia y cedidos actuales.</div>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-fg-muted">Añade los jugadores de tu primer equipo. Puedes dejar filas vacías y completarlas más tarde.</p>
                {activePlayers.map((r) => (
                  <div key={r.id} className="bg-well rounded-2xl p-3 space-y-2 relative">
                    <button type="button" onClick={() => removeActiveRow(r.id)} className="absolute top-2.5 right-2.5 p-1 text-fg-faint hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    <input placeholder="Nombre del jugador" className={FIELD} value={r.name} onChange={(e) => updateActiveRow(r.id, 'name', e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <Dropdown value={r.position} options={POSITION_OPTIONS} onChange={(v) => updateActiveRow(r.id, 'position', v)} placeholder="Pos." />
                      <input placeholder="Media" inputMode="numeric" className={FIELD_CENTER} value={r.rating} onChange={(e) => updateActiveRow(r.id, 'rating', e.target.value.replace(/\D/g, ''))} />
                      <input placeholder="Edad" inputMode="numeric" className={FIELD_CENTER} value={r.age} onChange={(e) => updateActiveRow(r.id, 'age', e.target.value.replace(/\D/g, ''))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Sueldo mensual (€)" inputMode="numeric" className={FIELD} value={r.wage} onChange={(e) => updateActiveRow(r.id, 'wage', formatValueInput(e.target.value))} />
                      <input placeholder="Cláusula (€) — opcional" inputMode="numeric" className={FIELD} value={r.releaseClause} onChange={(e) => updateActiveRow(r.id, 'releaseClause', formatValueInput(e.target.value))} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addActiveRow} className="w-full py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <Plus size={14} /> Añadir Jugador
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-fg-muted">¿Tu club tiene canteranos en la Academia?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => answerHasAcademy(true)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasAcademy === true ? 'bg-emerald-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Sí</button>
                  <button type="button" onClick={() => answerHasAcademy(false)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasAcademy === false ? 'bg-well-strong text-fg' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>No</button>
                </div>
                {hasAcademy && (
                  <>
                    {academyPlayers.map((r) => (
                      <div key={r.id} className="bg-well rounded-2xl p-3 space-y-2 relative">
                        <button type="button" onClick={() => removeAcademyRow(r.id)} className="absolute top-2.5 right-2.5 p-1 text-fg-faint hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        <input placeholder="Nombre del canterano" className={FIELD} value={r.name} onChange={(e) => updateAcademyRow(r.id, 'name', e.target.value)} />
                        <div className="grid grid-cols-3 gap-2">
                          <Dropdown value={r.position} options={POSITION_OPTIONS} onChange={(v) => updateAcademyRow(r.id, 'position', v)} placeholder="Pos." />
                          <input placeholder="Media" inputMode="numeric" className={FIELD_CENTER} value={r.rating} onChange={(e) => updateAcademyRow(r.id, 'rating', e.target.value.replace(/\D/g, ''))} />
                          <input placeholder="Edad" inputMode="numeric" className={FIELD_CENTER} value={r.age} onChange={(e) => updateAcademyRow(r.id, 'age', e.target.value.replace(/\D/g, ''))} />
                        </div>
                        <input placeholder="Potencial: 88 o rango 64-88" className={FIELD} value={r.potential} onChange={(e) => updateAcademyRow(r.id, 'potential', e.target.value.replace(/[^\d-]/g, ''))} />
                      </div>
                    ))}
                    <button type="button" onClick={addAcademyRow} className="w-full py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <Plus size={14} /> Añadir Canterano
                    </button>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-fg-muted">¿Tienes jugadores cedidos actualmente en otros clubes?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => answerHasLoanedOut(true)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasLoanedOut === true ? 'bg-blue-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Sí</button>
                  <button type="button" onClick={() => answerHasLoanedOut(false)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasLoanedOut === false ? 'bg-well-strong text-fg' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>No</button>
                </div>
                {hasLoanedOut && (
                  <>
                    {loanedPlayers.map((r) => (
                      <div key={r.id} className="bg-well rounded-2xl p-3 space-y-2 relative">
                        <button type="button" onClick={() => removeLoanedRow(r.id)} className="absolute top-2.5 right-2.5 p-1 text-fg-faint hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        <input placeholder="Nombre del jugador" className={FIELD} value={r.name} onChange={(e) => updateLoanedRow(r.id, 'name', e.target.value)} />
                        <div className="grid grid-cols-3 gap-2">
                          <Dropdown value={r.position} options={POSITION_OPTIONS} onChange={(v) => updateLoanedRow(r.id, 'position', v)} placeholder="Pos." />
                          <input placeholder="Media" inputMode="numeric" className={FIELD_CENTER} value={r.rating} onChange={(e) => updateLoanedRow(r.id, 'rating', e.target.value.replace(/\D/g, ''))} />
                          <input placeholder="Edad" inputMode="numeric" className={FIELD_CENTER} value={r.age} onChange={(e) => updateLoanedRow(r.id, 'age', e.target.value.replace(/\D/g, ''))} />
                        </div>
                        <input placeholder="Club de destino" className={FIELD} value={r.destinationClub} onChange={(e) => updateLoanedRow(r.id, 'destinationClub', e.target.value)} />
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-fg-faint ml-1 uppercase tracking-widest">% Salario asumido por tu club</label>
                          <div className="flex items-center gap-3">
                            <input type="range" min="0" max="100" step="5" className="flex-1 accent-blue-500" value={r.wagePercentage || 0} onChange={(e) => updateLoanedRow(r.id, 'wagePercentage', e.target.value)} />
                            <span className="w-12 text-center font-black text-fg bg-well-strong rounded-lg py-1.5 text-xs shrink-0">{r.wagePercentage || 0}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addLoanedRow} className="w-full py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <Plus size={14} /> Añadir Cedido
                    </button>
                  </>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-fg-muted">Por último, ajusta las finanzas iniciales de tu club.</p>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 flex items-center gap-1.5"><Wallet size={12} /> Presupuesto de Transferencias (€)</label>
                  <input placeholder="Ej: 20.000.000" inputMode="numeric" className={FIELD} value={initialBudget} onChange={(e) => setInitialBudget(formatValueInput(e.target.value))} />
                </div>
                {startType === 'continue' && projectedWageBill > 0 && (
                  <div className="p-4 rounded-2xl bg-well border border-border-subtle">
                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-faint flex items-center gap-1.5 mb-1"><Users size={12} /> Masa Salarial Mensual Estimada</span>
                    <div className="text-lg font-black italic text-fg">{formatCurrency(projectedWageBill)}</div>
                    <p className="text-[9px] text-fg-faint font-bold mt-1">Calculada con los sueldos introducidos en el Paso 2.</p>
                  </div>
                )}
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest"><Sparkles size={13} /> Todo Listo</div>
                  <p className="text-[10px] font-bold text-fg-muted">Al confirmar, se guardará tu plantilla y podrás seguir gestionando todo desde Plantilla, Academia y Mercado.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {step > 1 && (
            <button type="button" onClick={goPrev} disabled={isSaving} className="shrink-0 w-14 flex items-center justify-center bg-well text-fg-muted p-4 rounded-xl hover:bg-well-strong transition-all disabled:opacity-50">
              <ChevronLeft size={18} />
            </button>
          )}
          {!isLastStep ? (
            <button type="button" onClick={goNext} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all">
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleFinish} disabled={isSaving} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-400 transition-all disabled:opacity-50">
              {isSaving ? 'Guardando...' : (<><Check size={16} /> Empezar mi Modo Carrera</>)}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
