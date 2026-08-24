import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, Plus, Wallet, Shield, Camera, ShieldAlert, Trash2, Pencil, Sparkles, User, CalendarDays, Coins, Star, GraduationCap, BarChart3, MapPin, Target, Crop, Users } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency, formatValueInput, parseValue, weeklyWageBudgetFromTransfer } from '../../utils/format';
import { readFileAsDataUrl } from '../../utils/cropImage';
import { getCardStyle } from '../../utils/cardStyle';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import PlayerForm from '../squad/PlayerForm';
import ScanPlayerCardModal from '../squad/ScanPlayerCardModal';
import BulkScanReviewModal from '../squad/BulkScanReviewModal';
import ConfirmModal from '../common/ConfirmModal';
import AIGlowButton from '../common/AIGlowButton';
import ImageCropperModal from '../common/ImageCropperModal';

// Sugerencia de temporada actual a partir de la fecha real: la temporada futbolística europea
// arranca en torno a julio, así que de julio en adelante se sugiere "año/año+1" y antes de julio
// "año-1/año" — solo un punto de partida cómodo, el campo queda totalmente editable.
function defaultSeasonLabel() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: '€ Euros' },
  { value: 'GBP', label: '£ Libras' },
  { value: 'USD', label: '$ Dólares' },
];

// Filosofía/ADN del club: define la identidad de la carrera, puramente informativa por ahora
// (se guarda en el club y se muestra en el Resumen) — no condiciona todavía ninguna otra
// pantalla de la app, es la base sobre la que construir más adelante recomendaciones de
// fichajes/objetivos ajustadas al estilo elegido.
const PHILOSOPHY_OPTIONS = [
  { value: 'galactico', icon: Star, emoji: '🌟', title: 'Galáctico / Élite', desc: 'Fichajes estelares y presupuesto grande: ganarlo todo ya.' },
  { value: 'cantera', icon: GraduationCap, emoji: '🎓', title: 'Rey de la Cantera', desc: 'Apuesta por la Academia y el talento joven propio.' },
  { value: 'moneyball', icon: BarChart3, emoji: '📊', title: 'Moneyball / Realista', desc: 'Gestión eficiente del presupuesto, valor por encima de nombre.' },
  { value: 'local', icon: MapPin, emoji: '🛡️', title: 'Identidad Local', desc: 'Prioriza jugadores del país y una plantilla con raíces propias.' },
];

const SEASON_OBJECTIVE_OPTIONS = [
  'Pelear por el Título',
  'Clasificar a Competición Europea',
  'Consolidación en la Categoría',
  'Evitar el Descenso',
  'Reconstrucción a Largo Plazo',
];

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

// Asistente unificado de 5 pasos, SIEMPRE en el mismo orden y sin ninguna bifurcación de "empezar
// desde cero vs. modo carrera ya empezado" (se retiró esa pregunta por completo): Identidad del
// Club y Mánager -> Filosofía y ADN -> Fondos y Presupuesto -> Plantilla Actual (IA o Manual) ->
// Confirmación y Resumen. clubExists=false (invocado desde ClubModal al crear un club) recorre
// los 5 pasos completos y crea el club en Firestore al final del paso de Fondos.
// clubExists=true (invocado automáticamente por el wrapper de arriba, para retomar un club que
// ya se creó pero se quedó sin plantilla) salta directo a Plantilla + Resumen: identidad,
// filosofía y fondos ya quedaron guardados la primera vez que se recorrió este asistente, así
// que repetirlos aquí sería redundante — es la única variación entre ambos modos.
export function OnboardingWizardModal({ clubExists = true, onDismiss, onFirstClubCreated }) {
  useAutoHideChrome();
  const { clubs, activeClub, createClub, completeOnboarding } = useClubs();
  const { players, playerToDelete, setPlayerToDelete, confirmDeletePlayer } = useClubData();

  const STEP_SEQUENCE = clubExists
    ? ['squad', 'summary']
    : ['identity', 'philosophy', 'budget', 'squad', 'summary'];

  const [step, setStep] = useState(0);
  const currentStepId = STEP_SEQUENCE[step];

  // --- Paso 1: Identidad del Club y Mánager (solo clubExists=false) ---
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(''); // Resultado final ya recortado (cuadrado, comprimido).
  const [logoOriginal, setLogoOriginal] = useState(''); // Fuente sin recortar, para poder reencuadrar más tarde sin perder calidad.
  const [cropperSrc, setCropperSrc] = useState(''); // Imagen abierta en el modal de recorte, o '' si está cerrado.
  const [managerName, setManagerName] = useState('');
  const [seasonLabel, setSeasonLabel] = useState(defaultSeasonLabel);
  const [currency, setCurrency] = useState('EUR');
  const fileInputRef = useRef(null);

  // --- Paso 2: Filosofía y ADN del Club (solo clubExists=false) ---
  const [philosophy, setPhilosophy] = useState(null);
  const [seasonObjective, setSeasonObjective] = useState(null);

  // --- Paso 3: Fondos y Presupuesto Inicial (solo clubExists=false) ---
  const [transferBudgetInput, setTransferBudgetInput] = useState('');
  const [createdClubId, setCreatedClubId] = useState(null);
  // Presupuesto Semanal de Salarios: se sugiere automáticamente (Presup. Traspasos / 52, igual
  // que EA Sports FC) pero queda totalmente editable, porque el reparto real del juego no
  // siempre coincide exactamente con esa fórmula. Se resincroniza con la sugerencia mientras el
  // usuario no la haya tocado a mano (weeklyWageTouched); en cuanto edita el campo, deja de
  // seguir los cambios de presupuesto automáticamente.
  const [weeklyWageInput, setWeeklyWageInput] = useState('');
  const [weeklyWageTouched, setWeeklyWageTouched] = useState(false);

  // --- Paso 4: Plantilla Actual — registro de jugadores, con dos secciones (pestañas) dentro
  // del MISMO paso: Primer Equipo y Academia/Cantera. addingPlayerMode ('active'|'academy')
  // abre PlayerForm (idéntico a "Fichar Jugador") por encima de este asistente; cada ficha se
  // guarda directamente en Firestore, así que la lista que se muestra aquí simplemente lee
  // "players" en vivo (nunca un borrador local que se pueda perder al navegar Atrás/Siguiente:
  // ver el guard de createdClubId en goNext, la causa real de que la plantilla "desapareciera").
  // bulkScanMode/bulkReview son la vía de carga masiva con IA (lote de fotos o ráfaga con
  // cámara, ver ScanPlayerCardModal/BulkScanReviewModal) — la opción destacada de cada pestaña;
  // un canterano que la IA detecte suelto en un lote de Primer Equipo (esCanterano) se archiva
  // solo en la pestaña Academia, sin que el usuario tenga que hacer nada. ---
  const [squadTab, setSquadTab] = useState('active'); // 'active' | 'academy'
  const [addingPlayerMode, setAddingPlayerMode] = useState(null); // 'active' | 'academy' | null
  const [bulkScanMode, setBulkScanMode] = useState(null); // 'active' | 'academy' | null
  const [bulkReview, setBulkReview] = useState(null);

  // --- Paso 5: Confirmación y Resumen — desglose desplegable de las dos listas ("Jugadores"/
  // "Canteranos", esta última solo si la IA reclasificó alguno), con edición en línea (reutiliza
  // PlayerForm en modo edición) y borrado (reutiliza playerToDelete/confirmDeletePlayer de
  // ClubDataContext, mismo flujo con "Deshacer" que el resto de la app) ---
  const [expandedGroup, setExpandedGroup] = useState(null); // 'active' | 'academy' | null
  const [editingSummaryPlayer, setEditingSummaryPlayer] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Selección de archivo (primera vez, o "Cambiar Foto"): lee el archivo ORIGINAL sin
  // redimensionar y abre el recorte interactivo antes de fijar nada como escudo definitivo.
  const handleLogoFileChange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoOriginal(dataUrl);
      setCropperSrc(dataUrl);
    } catch (err) {
      console.error('Error leyendo el escudo:', err);
    }
  };
  // "Editar Encuadre": reabre el recorte sobre la imagen ORIGINAL ya guardada (logoOriginal),
  // nunca sobre el resultado ya recortado/comprimido — así el segundo recorte no pierde calidad.
  const handleReopenCropper = () => { if (logoOriginal) setCropperSrc(logoOriginal); };
  const handleCropApplied = (dataUrl) => { setLogo(dataUrl); setCropperSrc(''); };
  const handleCropCancel = () => {
    setCropperSrc('');
    // Si se cancela el primer recorte (nunca hubo un "logo" definitivo antes), no dejar la
    // fuente original huérfana sin ningún resultado que mostrar.
    if (!logo) setLogoOriginal('');
  };

  const onTransferBudgetChange = (raw) => setTransferBudgetInput(formatValueInput(raw));
  const budgetAmount = parseValue(transferBudgetInput);

  // Mientras el usuario no haya editado a mano el Presup. Sem., se mantiene sincronizado con la
  // sugerencia automática (Presupuesto de Traspasos / 52) cada vez que cambia el presupuesto.
  useEffect(() => {
    if (weeklyWageTouched) return;
    setWeeklyWageInput(formatValueInput(String(weeklyWageBudgetFromTransfer(budgetAmount))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetAmount, weeklyWageTouched]);

  const onWeeklyWageChange = (raw) => {
    setWeeklyWageTouched(true);
    setWeeklyWageInput(formatValueInput(raw));
  };

  const activeRosterPlayers = players.filter((p) => p.type !== 'Cantera');
  const academyRosterPlayers = players.filter((p) => p.type === 'Cantera');

  const canGoNext = () => {
    if (currentStepId === 'identity') return name.trim().length > 0 && managerName.trim().length > 0;
    if (currentStepId === 'philosophy') return !!philosophy;
    if (currentStepId === 'budget') return budgetAmount > 0;
    return true;
  };

  const goNext = async () => {
    setError('');
    if (!canGoNext()) {
      if (currentStepId === 'identity') setError('El nombre del club y del mánager son obligatorios.');
      else if (currentStepId === 'philosophy') setError('Elige un estilo de gestión para tu club.');
      else if (currentStepId === 'budget') setError('Introduce una cantidad mayor que cero.');
      return;
    }
    if (currentStepId === 'budget') {
      if (isSaving) return;
      // Guard crítico: si el usuario ya creó el club (avanzó una vez más allá de este paso) y
      // vuelve aquí con "Atrás" para revisar algo, "Siguiente" NO debe volver a llamar a
      // createClub — antes lo hacía siempre sin condición, así que retroceder y avanzar de
      // nuevo creaba un SEGUNDO club con un clubId nuevo, la app cambiaba de club activo a ese
      // duplicado recién creado y la plantilla ya escaneada (que seguía colgando del primer
      // club, ahora huérfano) "desaparecía" de la vista — el síntoma real detrás del reporte de
      // "los jugadores escaneados desaparecen al navegar". Con el club ya creado, simplemente se
      // avanza de paso; los datos de Identidad/Filosofía/Fondos ya quedaron guardados la
      // primera vez.
      if (createdClubId) {
        setStep((s) => s + 1);
        return;
      }
      setIsSaving(true);
      try {
        const result = await createClub(name, logo, budgetAmount, parseValue(weeklyWageInput) || null, {
          managerName, seasonLabel, currency, philosophy, seasonObjective,
        });
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
  // real asociado (ya existía, o se acaba de crear aquí): omitir en los pasos previos a crear
  // el club no debe tocar el onboarding de ningún otro club.
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
  // de cerrar solo se oculta durante los pasos previos a crear el club cuando este es el primer
  // club del usuario (no puede quedarse sin ningún club activo).
  const showDismiss = clubExists || clubs.length > 0;

  // Registro de Plantilla Inicial (Primer Equipo): nunca implica una compra real (ver
  // initialSquadTypes en PlayerForm y restrictToInitialTypes en BulkScanReviewModal, que
  // retiran "Comprado" del selector) — solo 3 estados de situación (En Propiedad / Cedido en
  // Nuestro Club / Cedido a Otro Club), así el historial de traspasos de la carrera nunca se ve
  // alterado por un jugador que ya estaba en el club antes de usar la app. Academia usa el
  // mismo patrón "sin transacción real" que ya tenía (lockedType 'Cantera'), sin necesidad de
  // los 3 estados de situación — un canterano no tiene ni compra ni cesión que registrar.
  const playerFormPropsFor = (mode) => (mode === 'academy'
    ? { prefill: { type: 'Cantera' }, lockedType: 'Cantera', skipInitialTransaction: true }
    : { prefill: { type: 'Comprado', sourceClub: 'En el club desde el inicio' }, initialSquadTypes: true, hidePurchasePrice: true, hideSourceClub: true, skipInitialTransaction: true });
  const bulkScanPropsFor = (mode) => (mode === 'academy'
    ? { mode: 'academia', propertyDefault: 'Comprado', skipInitialTransaction: true }
    : { mode: 'primerEquipo', propertyDefault: 'Inicial', skipInitialTransaction: true, restrictToInitialTypes: true });

  const handleBulkScanExtracted = (results) => {
    setBulkReview({ ...bulkScanPropsFor(bulkScanMode), results });
    setBulkScanMode(null);
  };

  const STEP_LABELS = {
    identity: 'Identidad',
    philosophy: 'Filosofía',
    budget: 'Fondos Iniciales',
    squad: 'Plantilla Actual',
    summary: 'Resumen',
  };

  const displayName = clubExists ? (activeClub?.name || '') : name;
  const displayLogo = clubExists ? activeClub?.logo : logo;
  const displayBudget = clubExists ? (activeClub?.transferBudget || 0) : budgetAmount;
  const displayManagerName = clubExists ? (activeClub?.managerName || '') : managerName;
  const displaySeasonLabel = clubExists ? (activeClub?.seasonLabel || '') : seasonLabel;
  const displayPhilosophy = clubExists ? activeClub?.philosophy : philosophy;
  const philosophyMeta = PHILOSOPHY_OPTIONS.find((p) => p.value === displayPhilosophy);

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
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      {logo ? <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl border-2 border-border object-cover shadow-2xl" /> : <div className="w-20 h-20 rounded-2xl bg-well border-2 border-dashed border-border flex flex-col items-center justify-center shadow-2xl hover:border-green-500 transition-all text-fg-muted hover:text-green-500"><Shield size={28} /><span className="text-[8px] font-black uppercase mt-1">Escudo</span></div>}
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleLogoFileChange} />
                      <button type="button" className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white" /></button>
                    </div>
                    {logo && (
                      <button type="button" onClick={handleReopenCropper} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-fg-faint hover:text-green-500 transition-colors touch-manipulation">
                        <Crop size={11} className="shrink-0" /> Editar Encuadre / Recortar
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Nombre del Club</label>
                    <input type="text" autoFocus placeholder="Ej: CD Olvera" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 flex items-center gap-1.5"><User size={11} className="shrink-0" /> Nombre del Mánager (DT)</label>
                    <input type="text" placeholder="Ej: Tu nombre" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 flex items-center gap-1.5"><CalendarDays size={11} className="shrink-0" /> Temporada</label>
                      <input type="text" placeholder="Ej: 2025/26" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={seasonLabel} onChange={(e) => setSeasonLabel(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 flex items-center gap-1.5"><Coins size={11} className="shrink-0" /> Moneda</label>
                      <div className="flex gap-1">
                        {CURRENCY_OPTIONS.map((c) => (
                          <button key={c.value} type="button" onClick={() => setCurrency(c.value)} className={`flex-1 h-[52px] rounded-xl text-[10px] font-black transition-all touch-manipulation ${currency === c.value ? 'bg-green-500 text-black' : 'bg-well text-fg-muted border border-border-subtle hover:bg-well-strong'}`}>{c.label.split(' ')[0]}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStepId === 'philosophy' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-fg-muted">¿Cuál es el ADN de tu club?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PHILOSOPHY_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = philosophy === opt.value;
                        return (
                          <button key={opt.value} type="button" onClick={() => setPhilosophy(opt.value)} className={`p-3.5 rounded-2xl border text-left transition-all touch-manipulation ${active ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                            <Icon size={18} className="mb-1.5" />
                            <div className="font-black uppercase text-[11px] leading-tight">{opt.emoji} {opt.title}</div>
                            <div className="text-[9px] font-bold mt-1 opacity-70 leading-snug">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 flex items-center gap-1.5"><Target size={11} className="shrink-0" /> Objetivo de la Temporada</label>
                    <div className="space-y-1.5">
                      {SEASON_OBJECTIVE_OPTIONS.map((obj) => (
                        <button key={obj} type="button" onClick={() => setSeasonObjective(obj)} className={`w-full py-2.5 px-3 rounded-xl text-left text-[10px] font-black uppercase transition-all touch-manipulation ${seasonObjective === obj ? 'bg-green-500 text-black' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>{obj}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStepId === 'budget' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-well border border-border-subtle">
                    <Wallet size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-fg-muted leading-relaxed">Ve en tu juego a la pestaña <span className="text-fg font-black">Oficina &gt; Resumen del presupuesto &gt; Presupuesto</span> e introduce los datos actuales de tu club.</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Presupuesto de Traspasos (€)</label>
                    <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 45.000.000" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={transferBudgetInput} onChange={(e) => onTransferBudgetChange(e.target.value)} />
                  </div>

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

              {currentStepId === 'squad' && (
                <div className="space-y-3">
                  {/* Pestañas Primer Equipo / Academia: MISMO Paso 4, dos secciones — un
                      canterano detectado sin querer en un lote de Primer Equipo (esCanterano)
                      se archiva solo en la pestaña Academia, sin que el usuario tenga que
                      cambiar de pestaña a propósito para verlo aparecer ahí. */}
                  <div className="flex gap-2 p-1 bg-well rounded-2xl border border-border-subtle">
                    <button type="button" onClick={() => setSquadTab('active')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all touch-manipulation ${squadTab === 'active' ? 'bg-green-500 text-black' : 'text-fg-muted hover:text-fg'}`}>
                      <Users size={13} className="shrink-0" /> Primer Equipo ({activeRosterPlayers.length})
                    </button>
                    <button type="button" onClick={() => setSquadTab('academy')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all touch-manipulation ${squadTab === 'academy' ? 'bg-green-500 text-black' : 'text-fg-muted hover:text-fg'}`}>
                      <GraduationCap size={13} className="shrink-0" /> Academia ({academyRosterPlayers.length})
                    </button>
                  </div>

                  {squadTab === 'active' ? (
                    <>
                      <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                        {activeRosterPlayers.length === 0 ? (
                          <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Aún no has añadido jugadores</div>
                        ) : activeRosterPlayers.map((p) => (
                          <div key={p.id} className="px-3 py-2 flex items-center gap-2">
                            <button type="button" onClick={() => setEditingSummaryPlayer(p)} className="min-w-0 flex-1 text-left touch-manipulation">
                              <div className="text-xs font-black text-fg truncate">{p.name}</div>
                              <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.positions?.[0] || '—'} · {p.rating} OVR</div>
                            </button>
                            <button type="button" onClick={() => setEditingSummaryPlayer(p)} title="Editar" className="shrink-0 p-1.5 text-fg-faint hover:text-green-500 transition-colors touch-manipulation"><Pencil size={13} /></button>
                            <button type="button" onClick={() => setPlayerToDelete(p.id)} title="Eliminar" className="shrink-0 p-1.5 text-fg-faint hover:text-red-400 transition-colors touch-manipulation"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-2xl bg-well border border-border-subtle">
                        <p className="text-[10px] font-bold text-fg-muted leading-relaxed">Ve en tu juego a <span className="text-fg font-black">Plantilla &gt; Menú de plantilla &gt; Finanzas</span>, y haz una foto a la información que aparece a la derecha de la pantalla para cada jugador.</p>
                      </div>
                      {/* Opción principal destacada, con el diseño premium de IA (borde
                          degradado animado + halo, ver AIGlowButton): aquí el usuario
                          típicamente mete 20-30 jugadores de golpe. "Añadir a Mano" queda como
                          alternativa secundaria discreta. */}
                      <AIGlowButton onClick={() => setBulkScanMode('active')}>
                        Escanear Plantilla con IA
                      </AIGlowButton>
                      <button type="button" onClick={() => setAddingPlayerMode('active')} className="w-full py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                        <Plus size={13} /> Añadir Jugadores a Mano
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                        {academyRosterPlayers.length === 0 ? (
                          <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Aún no has añadido canteranos</div>
                        ) : academyRosterPlayers.map((p) => (
                          <div key={p.id} className="px-3 py-2 flex items-center gap-2">
                            <button type="button" onClick={() => setEditingSummaryPlayer(p)} className="min-w-0 flex-1 text-left touch-manipulation">
                              <div className="text-xs font-black text-fg truncate">{p.name}</div>
                              <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">{p.positions?.[0] || '—'} · Pot. {p.potential || '—'}</div>
                            </button>
                            <button type="button" onClick={() => setEditingSummaryPlayer(p)} title="Editar" className="shrink-0 p-1.5 text-fg-faint hover:text-green-500 transition-colors touch-manipulation"><Pencil size={13} /></button>
                            <button type="button" onClick={() => setPlayerToDelete(p.id)} title="Eliminar" className="shrink-0 p-1.5 text-fg-faint hover:text-red-400 transition-colors touch-manipulation"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-2xl bg-well border border-border-subtle">
                        <p className="text-[10px] font-bold text-fg-muted leading-relaxed">Ve en tu juego a <span className="text-fg font-black">Academia &gt; Menú de plantilla &gt; Finanzas</span>, y haz una foto a la información que aparece a la derecha de la pantalla para cada canterano.</p>
                      </div>
                      <AIGlowButton onClick={() => setBulkScanMode('academy')}>
                        Escanear Academia con IA
                      </AIGlowButton>
                      <button type="button" onClick={() => setAddingPlayerMode('academy')} className="w-full py-3 rounded-2xl border border-dashed border-border-subtle text-fg-muted hover:text-green-500 hover:border-green-500/40 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                        <Plus size={13} /> Añadir Canteranos a Mano
                      </button>
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
                      {displayManagerName && <div className="text-[10px] font-bold text-fg-muted truncate">DT: {displayManagerName}{displaySeasonLabel ? ` · Temporada ${displaySeasonLabel}` : ''}</div>}
                      <div className="flex items-center gap-1.5 text-green-500 font-black text-xs mt-0.5"><Wallet size={12} /> {formatCurrency(displayBudget)}</div>
                    </div>
                  </div>

                  {philosophyMeta && (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-well border border-border-subtle">
                      <philosophyMeta.icon size={16} className="text-green-500 shrink-0" />
                      <span className="text-xs font-black text-fg">{philosophyMeta.emoji} {philosophyMeta.title}</span>
                    </div>
                  )}

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
                      mismo flujo con "Deshacer" que el resto de la app). Los canteranos que
                      aparecen aquí llegaron por reclasificación automática de la IA durante el
                      escaneo de plantilla (esCanterano), no por un paso de Academia dedicado. */}
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
                {isSaving ? 'Guardando...' : '🚀 Entrar al Despacho del Club'}
              </button>
            )}
          </footer>
        </div>
      </div>

      {cropperSrc && (
        <ImageCropperModal imageSrc={cropperSrc} onCancel={handleCropCancel} onApply={handleCropApplied} />
      )}

      {addingPlayerMode && (
        <PlayerForm {...playerFormPropsFor(addingPlayerMode)} onClose={() => setAddingPlayerMode(null)} />
      )}

      {bulkScanMode && (
        <ScanPlayerCardModal
          mode={bulkScanMode === 'academy' ? 'academia' : 'primerEquipo'}
          forceBatch
          onClose={() => setBulkScanMode(null)}
          onBatchExtracted={handleBulkScanExtracted}
        />
      )}
      {bulkReview && (
        <BulkScanReviewModal
          mode={bulkReview.mode}
          results={bulkReview.results}
          propertyDefault={bulkReview.propertyDefault}
          skipInitialTransaction={bulkReview.skipInitialTransaction}
          restrictToInitialTypes={bulkReview.restrictToInitialTypes}
          academyStepHint="podrás revisarlo en el Resumen"
          confirmLabel="Confirmar y Guardar Plantilla"
          onClose={() => setBulkReview(null)}
        />
      )}

      {editingSummaryPlayer && (
        <PlayerForm editingPlayer={editingSummaryPlayer} initialStep={4} initialSquadTypes={editingSummaryPlayer.type !== 'Cantera'} onClose={() => setEditingSummaryPlayer(null)} />
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
