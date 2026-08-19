import { useEffect, useRef, useState } from 'react';
import { X, Check, ChevronLeft, ChevronRight, ChevronDown, Plus, Wallet, Users, Sparkles, RotateCcw, Shield, Camera, RefreshCcw, ShieldAlert, Trash2, Pencil, Video, Images } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency, formatValueInput, parseValue, weeklyWageBudgetFromTransfer } from '../../utils/format';
import { resizeImageToDataUrl } from '../../utils/image';
import { getCardStyle } from '../../utils/cardStyle';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import PlayerForm from '../squad/PlayerForm';
import ScanPlayerCardModal from '../squad/ScanPlayerCardModal';
import VideoScanModal from '../squad/VideoScanModal';
import BulkScanReviewModal from '../squad/BulkScanReviewModal';
import ConfirmModal from '../common/ConfirmModal';

const BUDGET_PRESETS = [1000000, 5000000, 10000000, 50000000, 100000000, 200000000, 500000000, 1000000000];

function abbreviateBudget(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toLocaleString('es-ES', { useGrouping: true })}M €`;
  if (amount >= 1000) return `${amount / 1000}Mil €`;
  return `${amount} €`;
}

// Puerta de entrada: decide si corresponde mostrar el asistente (sin montar sus hooks de
// "pantalla limpia" salvo que realmente vaya a mostrarse) y, si es así, monta el modal.
// Condición de activación: hay un club activo, ya se resolvió el primer snapshot de
// jugadores (playersLoaded evita el falso positivo al cambiar de club), la plantilla está
// realmente vacía y este club no tiene el onboarding ya resuelto (completado u omitido).
// ClubShell la condiciona además a que no esté abierto el asistente de creación de club
// (showClubModal), que es quien lleva el onboarding de un club recién creado.
export default function OnboardingWizard() {
  const { activeClub } = useClubs();
  const { players, playersLoaded } = useClubData();
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  // Si se cambia de club (p. ej. desde el menú de usuario), se reevalúa desde cero para el
  // club recién activado, en vez de arrastrar el "omitido" de la partida anterior.
  useEffect(() => { setLocallyDismissed(false); }, [activeClub?.id]);

  const shouldShow = !!activeClub && playersLoaded && players.length === 0 && !activeClub.onboardingCompleted && !locallyDismissed;
  if (!shouldShow) return null;
  return <OnboardingWizardModal clubExists onDismiss={() => setLocallyDismissed(true)} />;
}

// h-[52px]: misma altura que el componente Dropdown, para que ambos queden alineados cuando
// comparten fila en un grid.
const FIELD = 'w-full h-[52px] bg-well-strong px-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg text-sm placeholder:text-fg-faint';

// Asistente unificado: identidad + fondos iniciales del club (solo si aún no existe, es decir
// al crear un club nuevo, primero o adicional) seguido siempre por la distinción entre
// "Empezar desde cero" y "Modo Carrera ya empezado", el registro de jugadores (reutilizando
// literalmente PlayerForm, el mismo formulario de "Fichar Jugador") y un resumen final.
// clubExists=false (invocado desde ClubModal al crear un club): añade los pasos de
// identidad/fondos por delante y crea el club en Firestore al final del paso de fondos.
// clubExists=true (invocado automáticamente por el wrapper de arriba): empieza directamente
// en el paso de "Estado de la Partida", ya que el club y su presupuesto ya existen.
export function OnboardingWizardModal({ clubExists = true, onDismiss, onFirstClubCreated }) {
  useAutoHideChrome();
  const { clubs, activeClubId, activeClub, createClub, completeOnboarding } = useClubs();
  const { players, playerToDelete, setPlayerToDelete, confirmDeletePlayer } = useClubData();

  // "status" (Tipo de Inicio de Partida) va ANTES que "budget" (Fondos): así, al llegar a
  // Fondos, ya se sabe si el club empieza desde cero (selector de presupuesto habitual) o es
  // una partida ya avanzada (campo único de presupuesto actual, sin presets — ver
  // currentStepId === 'budget' más abajo).
  const STEP_SEQUENCE = clubExists
    ? ['status', 'active', 'academy', 'summary']
    : ['identity', 'status', 'budget', 'active', 'academy', 'summary'];

  const [step, setStep] = useState(0);
  const currentStepId = STEP_SEQUENCE[step];

  // --- Paso Identidad (solo clubExists=false) ---
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // --- Paso Fondos (solo clubExists=false) ---
  const [budget, setBudget] = useState(BUDGET_PRESETS[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customBudget, setCustomBudget] = useState('');
  // Campo único de "Modo Carrera ya Empezado" (startType === 'continue'): separado de
  // customBudget/customMode (los del selector de presets de "Empezar desde Cero") para que
  // volver atrás y cambiar de tipo de inicio no arrastre un valor del otro modo por error.
  const [continueBudgetInput, setContinueBudgetInput] = useState('');
  const [createdClubId, setCreatedClubId] = useState(null);
  // Presupuesto Semanal de Salarios: se sugiere automáticamente (Presup. Traspasos / 52, igual
  // que EA Sports FC) pero queda totalmente editable, porque el reparto real del juego no
  // siempre coincide exactamente con esa fórmula en una partida ya avanzada. Se resincroniza
  // con la sugerencia mientras el usuario no la haya tocado a mano (weeklyWageTouched); en
  // cuanto edita el campo, deja de seguir los cambios de presupuesto automáticamente.
  const [weeklyWageInput, setWeeklyWageInput] = useState('');
  const [weeklyWageTouched, setWeeklyWageTouched] = useState(false);

  // --- Paso Estado de la Partida ---
  const [startType, setStartType] = useState(null); // 'scratch' | 'continue'

  // --- Paso Academia ---
  const [hasAcademy, setHasAcademy] = useState(null);

  // --- Registro de jugadores: abre PlayerForm (idéntico a "Fichar Jugador") por encima de
  // este asistente; cada ficha se guarda directamente en Firestore, así que la lista que se
  // muestra aquí simplemente lee "players" en vivo, sin estado local propio. ---
  const [addingPlayerMode, setAddingPlayerMode] = useState(null); // 'active' | 'academy' | null

  // --- Carga masiva con IA: aquí el usuario típicamente mete 20-30 jugadores de golpe, así que
  // el Vídeo es la opción destacada (pasar el joystick por la plantilla/Academia unos 20-30
  // segundos) y el lote de fotos queda como alternativa — mismo ScanPlayerCardModal/
  // BulkScanReviewModal que reutilizan PlayerList y AcademyTab. forceBatch=true en
  // ScanPlayerCardModal para que incluso UNA sola foto pase por la tabla de revisión en vez de
  // abrir PlayerForm directamente — aquí la intención es siempre "carga masiva", nunca una
  // ficha individual paso a paso. Vídeo: VideoScanModal extrae los fotogramas EN LOCAL
  // (extractFramesFromVideo) y los deja en pendingVideoFrames, que ScanPlayerCardModal consume
  // vía "initialFiles" para arrancar el escaneo directo, sin mostrar su propio selector de
  // cámara/galería. ---
  const [bulkScanMode, setBulkScanMode] = useState(null); // 'active' | 'academy' | null
  const [videoScanMode, setVideoScanMode] = useState(null); // 'active' | 'academy' | null
  const [pendingVideoFrames, setPendingVideoFrames] = useState(null);
  const [bulkReview, setBulkReview] = useState(null);

  // --- Paso Resumen: desglose desplegable de las dos listas ("Jugadores"/"Canteranos"), con
  // edición en línea (reutiliza PlayerForm en modo edición, igual que Plantilla/Academia/
  // Táctica) y borrado (reutiliza playerToDelete/confirmDeletePlayer de ClubDataContext, mismo
  // flujo con "Deshacer" que el resto de la app) ---
  const [expandedGroup, setExpandedGroup] = useState(null); // 'active' | 'academy' | null
  const [editingSummaryPlayer, setEditingSummaryPlayer] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 150, 0.8);
      setLogo(dataUrl);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const pickPreset = (amount) => { setCustomMode(false); setCustomBudget(''); setBudget(amount); };
  const pickCustom = () => { setCustomMode(true); setBudget(parseValue(customBudget)); };
  const onCustomBudgetChange = (raw) => {
    const formatted = formatValueInput(raw);
    setCustomBudget(formatted);
    setBudget(parseValue(formatted));
  };
  const onContinueBudgetChange = (raw) => {
    const formatted = formatValueInput(raw);
    setContinueBudgetInput(formatted);
    setBudget(parseValue(formatted));
  };

  // Mientras el usuario no haya editado a mano el Presup. Sem., se mantiene sincronizado con la
  // sugerencia automática (Presupuesto de Traspasos / 52) cada vez que cambia el presupuesto.
  useEffect(() => {
    if (weeklyWageTouched) return;
    setWeeklyWageInput(formatValueInput(String(weeklyWageBudgetFromTransfer(budget))));
  }, [budget, weeklyWageTouched]);

  const onWeeklyWageChange = (raw) => {
    setWeeklyWageTouched(true);
    setWeeklyWageInput(formatValueInput(raw));
  };

  const activeRosterPlayers = players.filter((p) => p.type !== 'Cantera');
  const academyRosterPlayers = players.filter((p) => p.type === 'Cantera');

  const canGoNext = () => {
    if (currentStepId === 'identity') return name.trim().length > 0;
    // "Modo Carrera ya Empezado": campo único directo, sin selector de presets — solo hace
    // falta que el usuario haya introducido una cantidad mayor que cero.
    if (currentStepId === 'budget') return startType === 'continue' ? parseValue(continueBudgetInput) > 0 : (!customMode || parseValue(customBudget) > 0);
    if (currentStepId === 'status') return !!startType;
    if (currentStepId === 'academy') return hasAcademy !== null || academyRosterPlayers.length > 0;
    return true;
  };

  const goNext = async () => {
    setError('');
    if (!canGoNext()) {
      if (currentStepId === 'identity') setError('El nombre del club es obligatorio.');
      else if (currentStepId === 'budget') setError('Introduce una cantidad mayor que cero.');
      else if (currentStepId === 'status') setError('Elige cómo quieres empezar.');
      else if (currentStepId === 'academy') setError('Responde si tu club tiene canteranos.');
      return;
    }
    if (currentStepId === 'budget') {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const result = await createClub(name, logo, budget, parseValue(weeklyWageInput) || null);
        setCreatedClubId(result?.clubId || null);
        setIsSaving(false);
        setStep((s) => s + 1);
      } catch (err) {
        console.error(err);
        setError('No se pudo crear el club. Inténtalo de nuevo.');
        setIsSaving(false);
      }
      return;
    }
    setStep((s) => Math.min(STEP_SEQUENCE.length - 1, s + 1));
  };
  const goPrev = () => { setError(''); setStep((s) => Math.max(0, s - 1)); };

  // Solo se marca el onboarding como resuelto si este propio asistente llegó a tener un club
  // real asociado (ya existía, o se acaba de crear aquí): omitir en los pasos de identidad o
  // fondos, antes de crear el club, no debe tocar el onboarding de ningún otro club.
  const handleSkip = async () => {
    onDismiss?.();
    if (clubExists || createdClubId) {
      try { await completeOnboarding(); } catch (err) { console.error(err); }
    }
  };

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await completeOnboarding();
      onDismiss?.();
      onFirstClubCreated?.();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  // Una vez creado el club (o si ya existía), "clubs.length > 0" es siempre cierto — el botón
  // de cerrar solo se oculta durante identidad/fondos cuando este es el primer club del
  // usuario (no puede quedarse sin ningún club activo).
  const showDismiss = clubExists || clubs.length > 0;

  const isScratch = startType === 'scratch';
  // skipInitialTransaction en los tres casos: cualquier jugador registrado aquí es estado base
  // previo del club (ya fichado antes de usar la app), nunca una compra real hecha dentro de
  // ella — el historial de transacciones y el presupuesto no deben verse afectados.
  // "Empieza desde Cero" (isScratch): estos jugadores nunca vinieron de otro club, así que el
  // campo Club de Procedencia se oculta por completo (hideSourceClub, ver PlayerForm) y se fija
  // directamente a "En el club desde el inicio" sin pedírselo al usuario. En "Modo Carrera ya
  // Empezado" el campo se muestra editable con normalidad, para indicar de qué equipo real vino
  // cada jugador.
  const playerFormPropsFor = (mode) => {
    if (mode === 'academy') return { prefill: { type: 'Cantera' }, lockedType: 'Cantera', skipInitialTransaction: true };
    if (isScratch) return { prefill: { type: 'Comprado', sourceClub: 'En el club desde el inicio' }, lockedType: 'Comprado', hidePurchasePrice: true, hideSourceClub: true, skipInitialTransaction: true };
    return { prefill: { type: 'Comprado' }, restrictTypes: ['Comprado', 'Cedido'], skipInitialTransaction: true };
  };

  // Mismo criterio que playerFormPropsFor, pero para BulkScanReviewModal: "propertyDefault" es
  // solo el punto de partida de cada fila detectada como Propiedad (nunca Cedido/Cantera, que
  // la IA ya clasifica sola) — el usuario puede corregirlo fila a fila en la propia tabla. En
  // Onboarding, tanto empezando desde cero como continuando una carrera ya avanzada, una
  // tarjeta de Propiedad se preasigna siempre a "Ya en el Club": es la forma natural de dar de
  // alta la plantilla de partida sin tener que rellenar precio/club de origen de cada jugador.
  const bulkScanPropsFor = (mode) => {
    if (mode === 'academy') return { mode: 'academia', propertyDefault: 'Comprado', skipInitialTransaction: true };
    return { mode: 'primerEquipo', propertyDefault: 'Inicial', skipInitialTransaction: true };
  };

  const handleBulkScanExtracted = (results) => {
    setBulkReview({ ...bulkScanPropsFor(bulkScanMode), results });
    setBulkScanMode(null);
    setPendingVideoFrames(null);
  };

  const STEP_LABELS = {
    identity: 'Escudo y Nombre',
    budget: 'Fondos Iniciales',
    status: 'Estado de la Partida',
    active: isScratch ? 'Jugadores Base' : 'Plantilla Actual',
    academy: 'Academia',
    summary: 'Resumen',
  };

  const displayName = clubExists ? (activeClub?.name || '') : name;
  const displayLogo = clubExists ? activeClub?.logo : logo;
  const displayBudget = clubExists ? (activeClub?.transferBudget || 0) : budget;

  return (
    <>
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
            <div className="min-w-0">
              <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Sparkles size={16} className="shrink-0" /> {clubExists ? 'Bienvenido a tu Club' : 'Crea tu Club'}</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-fg-faint mt-0.5">Paso {step + 1} de {STEP_SEQUENCE.length} · {STEP_LABELS[currentStepId]}</p>
            </div>
            {showDismiss && (
              <button type="button" onClick={handleSkip} title="Omitir y configurar más tarde" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-fg-faint hover:text-fg hover:bg-well transition-colors text-[9px] font-black uppercase tracking-widest">
                Omitir <X size={14} />
              </button>
            )}
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-center gap-1.5">
              {STEP_SEQUENCE.map((id, i) => (
                <div key={id} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
              ))}
            </div>
          </div>

          <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse">
                <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
              </div>
            )}

            <div key={currentStepId} className="space-y-4 pb-4 animate-in fade-in duration-300">
              {currentStepId === 'identity' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => !isUploadingLogo && fileInputRef.current?.click()}>
                      {logo ? <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl border-2 border-border object-cover shadow-2xl" /> : <div className="w-20 h-20 rounded-2xl bg-well border-2 border-dashed border-border flex flex-col items-center justify-center shadow-2xl hover:border-green-500 transition-all text-fg-muted hover:text-green-500"><Shield size={28} /><span className="text-[8px] font-black uppercase mt-1">Escudo</span></div>}
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} />
                      <button type="button" disabled={isUploadingLogo} className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{isUploadingLogo ? <RefreshCcw size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Nombre del Club</label>
                    <input type="text" autoFocus placeholder="Ej: CD Olvera" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } }} />
                  </div>
                </div>
              )}

              {currentStepId === 'budget' && (
                <div className="space-y-4">
                  {startType === 'continue' ? (
                    <>
                      {/* "Modo Carrera ya Empezado": sin selector de presets — un único campo
                          directo con el presupuesto real de la partida en curso, tal como lo
                          muestra el propio juego. */}
                      <div className="flex items-start gap-2 p-3 rounded-2xl bg-well border border-border-subtle">
                        <Wallet size={16} className="text-green-500 shrink-0 mt-0.5" />
                        <span className="text-xs font-bold text-fg-muted leading-relaxed">Ve en tu juego a la pestaña <span className="text-fg font-black">Oficina &gt; Resumen del presupuesto</span> e introduce los datos actuales de tu club.</span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Presupuesto para Traspasos Actual (€)</label>
                        <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 45.000.000" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={continueBudgetInput} onChange={(e) => onContinueBudgetChange(e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-well border border-border-subtle">
                        <Wallet size={16} className="text-green-500 shrink-0" />
                        <span className="text-xs font-bold text-fg-muted">Fondos para fichajes y masa salarial desde el primer día</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {BUDGET_PRESETS.map((amount) => (
                          <button key={amount} type="button" onClick={() => pickPreset(amount)} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${!customMode && budget === amount ? 'bg-green-500 text-black border-green-500' : 'bg-well border-border-subtle text-fg-secondary hover:border-fg-muted'}`}>
                            {abbreviateBudget(amount)}
                          </button>
                        ))}
                        <button type="button" onClick={pickCustom} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${customMode ? 'bg-green-500 text-black border-green-500' : 'bg-well border-border-subtle text-fg-secondary hover:border-fg-muted'}`}>
                          Personalizar
                        </button>
                      </div>
                      {customMode && (
                        <div className="space-y-2 animate-in fade-in duration-150">
                          <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Cantidad Personalizada</label>
                          <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 20.000.000" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={customBudget} onChange={(e) => onCustomBudgetChange(e.target.value)} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Sugerido automáticamente como Presupuesto de Traspasos / 52 (igual que EA
                      Sports FC), pero totalmente editable: ese reparto no siempre coincide con
                      la cifra exacta que muestra una partida real ya avanzada. */}
                  <div className="pt-2 border-t border-border-subtle space-y-2">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Presupuesto Semanal de Salarios (€)</label>
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-well border border-border-subtle focus-within:border-green-500">
                      <Wallet size={16} className="text-green-500 shrink-0" />
                      <input type="text" inputMode="numeric" placeholder="Ej: 16.257.000" className="flex-1 min-w-0 bg-transparent outline-none font-black text-green-500 text-sm placeholder:text-fg-faint placeholder:font-bold" value={weeklyWageInput} onChange={(e) => onWeeklyWageChange(e.target.value)} />
                      <span className="text-[10px] font-black text-fg-faint shrink-0">/sem</span>
                    </div>
                    <p className="text-[9px] font-bold text-fg-faint ml-1">Sugerido automáticamente; edítalo si tu juego muestra una cifra distinta.</p>
                  </div>
                </div>
              )}

              {currentStepId === 'status' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-fg-muted">¿Cómo quieres empezar tu Modo Carrera?</p>
                  <button type="button" onClick={() => setStartType('scratch')} className={`w-full p-4 rounded-2xl border text-left transition-all ${startType === 'scratch' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                    <div className="font-black uppercase text-sm flex items-center gap-2"><RotateCcw size={16} /> Empezar desde Cero</div>
                    <div className="text-[10px] font-bold mt-1 opacity-70">Arranca una carrera limpia y nueva: presupuesto inicial por defecto y plantilla vacía, para ir registrando a tus jugadores paso a paso desde ahora.</div>
                  </button>
                  <button type="button" onClick={() => setStartType('continue')} className={`w-full p-4 rounded-2xl border text-left transition-all ${startType === 'continue' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                    <div className="font-black uppercase text-sm flex items-center gap-2"><Users size={16} /> Modo Carrera ya Empezado</div>
                    <div className="text-[10px] font-bold mt-1 opacity-70">Vuelca los datos de una partida ya avanzada de EA Sports FC: los fichajes que ya hiciste, el presupuesto actual de tu club y tus jugadores reales, ya adaptados.</div>
                  </button>
                </div>
              )}

              {currentStepId === 'active' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-fg-muted">{isScratch ? 'Añade los jugadores base de tu primer equipo.' : 'Añade tu plantilla actual, ficha a ficha.'}</p>
                  <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    {activeRosterPlayers.length === 0 ? (
                      <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Aún no has añadido jugadores</div>
                    ) : activeRosterPlayers.map((p) => (
                      <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-fg truncate">{p.name}</span>
                        <span className="text-[9px] font-black text-fg-faint uppercase shrink-0 ml-2">{p.positions?.[0] || '—'} · {p.rating}</span>
                      </div>
                    ))}
                  </div>
                  {/* Opción principal destacada: aquí el usuario típicamente mete 20-30
                      jugadores de golpe, así que el vídeo (pasar el joystick por la plantilla)
                      es el camino rápido recomendado; fotos y manual quedan como alternativas
                      secundarias, no escondidas pero sin competir en protagonismo. */}
                  <button type="button" onClick={() => setVideoScanMode('active')} className="w-full py-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest touch-manipulation shadow-lg shadow-blue-600/20">
                    <Video size={16} /> Escanear Plantilla con Vídeo (Rápido)
                  </button>
                  <p className="text-[9px] font-bold text-fg-faint text-center px-2 -mt-1.5">Pasa tu plantilla en 30 segundos con el joystick y la IA cargará todo tu equipo.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setPendingVideoFrames(null); setBulkScanMode('active'); }} className="py-3 rounded-2xl border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                      <Images size={13} /> Subir Lote de Fotos
                    </button>
                    <button type="button" onClick={() => setAddingPlayerMode('active')} className="py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                      <Plus size={13} /> Manual
                    </button>
                  </div>
                </div>
              )}

              {currentStepId === 'academy' && (
                <div className="space-y-3">
                  {/* Si ya llegaron canteranos a la Academia por redirección automática desde
                      un escaneo de Primer Equipo (esCanterano, ver BulkScanReviewModal), se da
                      por hecho que la respuesta es "Sí" y se salta directamente a la lista —
                      preguntar de nuevo sería redundante con lo que el usuario ya hizo. */}
                  {academyRosterPlayers.length > 0 ? (
                    <p className="text-xs font-bold text-fg-muted">Ya tienes <span className="text-fg font-black">{academyRosterPlayers.length}</span> canterano{academyRosterPlayers.length === 1 ? '' : 's'} registrado{academyRosterPlayers.length === 1 ? '' : 's'} en tu Academia. ¿Quieres añadir más o continuar?</p>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-fg-muted">¿Tu club tiene canteranos en la Academia?</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setHasAcademy(true)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasAcademy === true ? 'bg-emerald-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Sí</button>
                        <button type="button" onClick={() => setHasAcademy(false)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${hasAcademy === false ? 'bg-well-strong text-fg' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>No</button>
                      </div>
                    </>
                  )}
                  {(hasAcademy || academyRosterPlayers.length > 0) && (
                    <>
                      <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                        {academyRosterPlayers.length === 0 ? (
                          <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Aún no has añadido canteranos</div>
                        ) : academyRosterPlayers.map((p) => (
                          <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-fg truncate">{p.name}</span>
                            <span className="text-[9px] font-black text-fg-faint uppercase shrink-0 ml-2">{p.positions?.[0] || '—'} · Pot. {p.potential || '—'}</span>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setVideoScanMode('academy')} className="w-full py-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest touch-manipulation shadow-lg shadow-blue-600/20">
                        <Video size={16} /> Escanear Academia con Vídeo (Rápido)
                      </button>
                      <p className="text-[9px] font-bold text-fg-faint text-center px-2 -mt-1.5">Pasa tu Academia en 30 segundos con el joystick y la IA cargará todos tus canteranos.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => { setPendingVideoFrames(null); setBulkScanMode('academy'); }} className="py-3 rounded-2xl border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                          <Images size={13} /> Subir Lote de Fotos
                        </button>
                        <button type="button" onClick={() => setAddingPlayerMode('academy')} className="py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                          <Plus size={13} /> Manual
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentStepId === 'summary' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-well border border-border-subtle">
                    {displayLogo ? <img src={displayLogo} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-border-subtle shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-well-strong flex items-center justify-center shrink-0"><Shield size={22} className="text-fg-faint" /></div>}
                    <div className="min-w-0">
                      <div className="font-black uppercase italic text-base truncate text-fg">{displayName || 'Tu Club'}</div>
                      <div className="flex items-center gap-1.5 text-green-500 font-black text-xs mt-0.5"><Wallet size={12} /> {formatCurrency(displayBudget)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setExpandedGroup((g) => (g === 'active' ? null : 'active'))} className={`p-3 rounded-xl border text-center transition-all touch-manipulation ${expandedGroup === 'active' ? 'bg-green-500/10 border-green-500/40' : 'bg-well border-border-subtle hover:bg-well-strong'}`}>
                      <div className="text-lg font-black italic text-fg">{activeRosterPlayers.length}</div>
                      <div className="flex items-center justify-center gap-1 text-[9px] uppercase text-fg-faint font-black tracking-widest">
                        Jugadores <ChevronDown size={11} className={`transition-transform ${expandedGroup === 'active' ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    <button type="button" onClick={() => setExpandedGroup((g) => (g === 'academy' ? null : 'academy'))} className={`p-3 rounded-xl border text-center transition-all touch-manipulation ${expandedGroup === 'academy' ? 'bg-green-500/10 border-green-500/40' : 'bg-well border-border-subtle hover:bg-well-strong'}`}>
                      <div className="text-lg font-black italic text-fg">{academyRosterPlayers.length}</div>
                      <div className="flex items-center justify-center gap-1 text-[9px] uppercase text-fg-faint font-black tracking-widest">
                        Canteranos <ChevronDown size={11} className={`transition-transform ${expandedGroup === 'academy' ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  </div>

                  {/* Desglose desplegable: datos clave de cada jugador ya registrado, para
                      revisar todo el equipo de un vistazo antes de confirmar — editable en
                      línea (lápiz, abre PlayerForm en modo edición) y con borrado (papelera,
                      mismo flujo con "Deshacer" que Plantilla/Academia). */}
                  {expandedGroup === 'active' && (
                    <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {activeRosterPlayers.length === 0 ? (
                        <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Sin jugadores todavía</div>
                      ) : activeRosterPlayers.map((p) => (
                        <div key={p.id} className="px-3 py-2.5 flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[6px] opacity-70 font-bold">{p.positions?.[0]}</span><span className="text-[11px]">{p.rating}</span></div>
                          <button type="button" onClick={() => setEditingSummaryPlayer(p)} className="min-w-0 flex-1 text-left touch-manipulation">
                            <div className="text-xs font-black text-fg truncate">{p.name}</div>
                            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.positions?.[0] || '—'} · {p.rating} OVR · {p.age} Años</div>
                          </button>
                          <button type="button" onClick={() => setEditingSummaryPlayer(p)} title="Editar" className="shrink-0 p-1.5 text-fg-faint hover:text-green-500 transition-colors touch-manipulation"><Pencil size={13} /></button>
                          <button type="button" onClick={() => setPlayerToDelete(p.id)} title="Eliminar" className="shrink-0 p-1.5 text-fg-faint hover:text-red-400 transition-colors touch-manipulation"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {expandedGroup === 'academy' && (
                    <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {academyRosterPlayers.length === 0 ? (
                        <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Sin canteranos todavía</div>
                      ) : academyRosterPlayers.map((p) => (
                        <div key={p.id} className="px-3 py-2.5 flex items-center gap-2">
                          <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[6px] opacity-70 font-bold">{p.positions?.[0]}</span><span className="text-[11px]">{p.rating}</span></div>
                          <button type="button" onClick={() => setEditingSummaryPlayer(p)} className="min-w-0 flex-1 text-left touch-manipulation">
                            <div className="text-xs font-black text-fg truncate">{p.name}</div>
                            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.positions?.[0] || '—'} · {p.rating} OVR · {p.age} Años</div>
                          </button>
                          <span className="text-[10px] font-black text-emerald-500 shrink-0">Pot. {p.potential || '—'}</span>
                          <button type="button" onClick={() => setEditingSummaryPlayer(p)} title="Editar" className="shrink-0 p-1.5 text-fg-faint hover:text-green-500 transition-colors touch-manipulation"><Pencil size={13} /></button>
                          <button type="button" onClick={() => setPlayerToDelete(p.id)} title="Eliminar" className="shrink-0 p-1.5 text-fg-faint hover:text-red-400 transition-colors touch-manipulation"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-1.5">
                    <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest"><Sparkles size={13} /> Todo Listo</div>
                    <p className="text-[10px] font-bold text-fg-muted">Al entrar, podrás seguir gestionando todo desde Plantilla, Academia y Mercado.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {step > 0 && (
              <button type="button" onClick={goPrev} disabled={isSaving} className="shrink-0 w-14 flex items-center justify-center bg-well text-fg-muted p-4 rounded-xl hover:bg-well-strong transition-all disabled:opacity-50">
                <ChevronLeft size={18} />
              </button>
            )}
            {currentStepId !== 'summary' ? (
              <button type="button" onClick={goNext} disabled={isSaving} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50">
                {isSaving ? 'Creando...' : (<>Siguiente <ChevronRight size={16} /></>)}
              </button>
            ) : (
              <button type="button" onClick={handleFinish} disabled={isSaving} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-400 transition-all disabled:opacity-50">
                {isSaving ? 'Guardando...' : (<><Check size={16} /> Entrar a mi Club</>)}
              </button>
            )}
          </footer>
        </div>
      </div>

      {addingPlayerMode && (
        <PlayerForm {...playerFormPropsFor(addingPlayerMode)} onClose={() => setAddingPlayerMode(null)} />
      )}

      {videoScanMode && (
        <VideoScanModal
          scanNoun={videoScanMode === 'academy' ? 'canterano' : 'jugador'}
          onClose={() => setVideoScanMode(null)}
          onBack={() => setVideoScanMode(null)}
          onFramesExtracted={(frames) => {
            setPendingVideoFrames(frames);
            setBulkScanMode(videoScanMode);
            setVideoScanMode(null);
          }}
        />
      )}
      {bulkScanMode && (
        <ScanPlayerCardModal
          mode={bulkScanMode === 'academy' ? 'academia' : 'primerEquipo'}
          forceBatch
          initialFiles={pendingVideoFrames}
          onClose={() => { setBulkScanMode(null); setPendingVideoFrames(null); }}
          onBatchExtracted={handleBulkScanExtracted}
        />
      )}
      {bulkReview && (
        <BulkScanReviewModal
          mode={bulkReview.mode}
          results={bulkReview.results}
          propertyDefault={bulkReview.propertyDefault}
          skipInitialTransaction={bulkReview.skipInitialTransaction}
          academyStepHint="podrás revisarlo en el Paso 5"
          onClose={() => setBulkReview(null)}
        />
      )}

      {editingSummaryPlayer && (
        <PlayerForm editingPlayer={editingSummaryPlayer} initialStep={4} onClose={() => setEditingSummaryPlayer(null)} />
      )}
      {playerToDelete && (
        <ConfirmModal
          icon={ShieldAlert}
          title="Eliminar Jugador"
          message="¿Estás seguro de que deseas eliminar este jugador?"
          confirmLabel="Eliminar"
          onCancel={() => setPlayerToDelete(null)}
          onConfirm={confirmDeletePlayer}
        />
      )}
    </>
  );
}
