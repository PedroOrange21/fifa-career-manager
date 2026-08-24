import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Camera, RefreshCcw, User, ChevronLeft, ChevronRight, Check, Globe2, Pencil, Shirt } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { flagEmoji, detectCountry } from '../../constants/countries';
import { formatValueInput, parseValue, formatCurrency, isValidPotentialInput } from '../../utils/format';
import { resizeImageToDataUrl } from '../../utils/image';
import { getCardStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { usePreventBackdropTouch } from '../../hooks/usePreventBackdropTouch';
import Dropdown from '../common/Dropdown';

const STEP_TITLES = ['Identidad', 'Atributos', 'Términos Económicos', 'Revisión Final'];
const TOTAL_STEPS = STEP_TITLES.length;

// Par de círculos que indica de un vistazo la pierna hábil (izquierda/derecha). El círculo
// del lado dominante se destaca (bg-black en modo claro, bg-white en modo oscuro); el del
// otro lado queda atenuado en gris. "Ambas" destaca los dos. Colores explícitos por tema
// (no tokens) porque el botón/desplegable de Pierna mantiene el mismo fondo bg-well en
// ambos modos y necesita este contraste fijo para leerse bien en los dos.
function FootIndicator({ variant, size = 14 }) {
  const rightActive = variant === 'Diestro' || variant === 'Ambas';
  const leftActive = variant === 'Zurdo' || variant === 'Ambas';
  const activeClass = 'bg-black dark:bg-white';
  const dimClass = 'bg-zinc-300 opacity-50 dark:bg-zinc-700 dark:opacity-40';
  const style = { width: size, height: size };
  return (
    <span className="flex items-center gap-1">
      <span style={style} className={`rounded-full ${leftActive ? activeClass : dimClass}`} />
      <span style={style} className={`rounded-full ${rightActive ? activeClass : dimClass}`} />
    </span>
  );
}

// "icon" (pequeño, w-2.5) se usa dentro de las listas de opciones del desplegable; "closedIcon"
// (tamaño actual, w-3.5) se usa donde se muestra el valor ya seleccionado y fijo (el botón
// cerrado y la ficha de revisión), para que no se vea reducido ahí.
const FOOT_OPTIONS = [
  { value: 'Diestro', label: 'Diestro', icon: <FootIndicator variant="Diestro" size={10} />, closedIcon: <FootIndicator variant="Diestro" /> },
  { value: 'Zurdo', label: 'Zurdo', icon: <FootIndicator variant="Zurdo" size={10} />, closedIcon: <FootIndicator variant="Zurdo" /> },
  { value: 'Ambas', label: 'Ambas', icon: <FootIndicator variant="Ambas" size={10} />, closedIcon: <FootIndicator variant="Ambas" /> },
];

// Duración de la cesión: compartida por la cesión ENTRANTE (jugador tipo "Cedido" que llega a
// nuestro club) y la SALIENTE (outboundLoan, jugador propio cedido fuera).
const LOAN_DURATION_OPTIONS = [
  { value: '6 Meses', label: '6 Meses' },
  { value: '1 Temporada', label: '1 Temporada' },
  { value: '2 Temporadas', label: '2 Temporadas' },
];

// Relevancia (antes "Rol Pactado"): expectativa de peso en la plantilla acordada al fichar/
// traer cedido al jugador (no aplica a Cantera, que todavía no tiene un rol competitivo
// definido).
const AGREED_ROLE_OPTIONS = [
  { value: 'Crucial', label: 'Crucial' },
  { value: 'Importante', label: 'Importante' },
  { value: 'Rotación', label: 'Rotación' },
  { value: 'Esporádico', label: 'Esporádico' },
  { value: 'Promesa', label: 'Promesa' },
];

// Campos de texto/número compactos, uniformes en toda la tarjeta: 16px (text-base) en
// móvil para evitar el auto-zoom de Safari/Chrome, algo más compactos en escritorio.
const FIELD_BASE = 'w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-black text-base md:text-sm text-fg placeholder:text-fg-faint';
const FIELD_CLASS = `${FIELD_BASE} text-center`;
// Variante para la Revisión Final tras el escaneo con IA (ver postScanReview): mismo tamaño
// que FIELD_CLASS a la altura h-11 de esa pantalla, pero con el borde en rojo — se genera
// aparte en vez de concatenar utilidades border-* contradictorias sobre FIELD_CLASS, que
// Tailwind no garantiza resolver en un orden concreto.
const FIELD_CLASS_ERROR = 'w-full h-11 bg-well p-4 rounded-xl outline-none border border-red-500 focus:border-red-500 font-black text-base md:text-sm text-fg placeholder:text-fg-faint text-center';

// Ningún campo de este asistente se envía con Enter: no hay <form>, así que Enter no
// tendría efecto por defecto, pero lo bloqueamos explícitamente para que nunca dispare
// un avance de paso ni ninguna acción inesperada mientras el usuario escribe.
const blockEnterKey = (e) => { if (e.key === 'Enter') e.preventDefault(); };

const splitName = (fullName) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

const toFormState = (p) => {
  const { firstName, lastName } = splitName(p?.name);
  const positions = p?.positions || (p?.pos ? [p.pos] : []);
  return {
    firstName, lastName,
    photo: p?.photo || '',
    nationality: p?.nationality || '',
    primaryPosition: positions[0] || '',
    secondaryPositions: positions.slice(1) || [],
    rating: p?.rating ? String(p.rating) : '',
    age: p?.age ? String(p.age) : '',
    preferredFoot: p?.preferredFoot || 'Diestro',
    type: p?.type || 'Comprado',
    marketValue: formatValueInput(String(p?.marketValue || p?.value || '')),
    value: formatValueInput(String(p?.value || '')),
    loanDuration: p?.loanDuration || '1 Temporada',
    originClub: p?.originClub || '',
    // hasBuyOption/buyOption/wagePercentage: caen a los mismos campos dentro de outboundLoan
    // cuando el jugador es una cesión SALIENTE (ver handleConfirm más abajo, que los guarda ahí
    // en vez de a nivel superior) — así reabrir para editar un CedidoFuera ya existente
    // rellena el slider y la opción de compra con sus valores reales en vez de arrancar vacíos.
    hasBuyOption: !!(p?.buyOption || p?.outboundLoan?.buyOption),
    buyOption: formatValueInput(String(p?.buyOption || p?.outboundLoan?.buyOption || '')),
    wagePercentage: (p?.wagePercentage ?? p?.outboundLoan?.wagePercentage) != null ? String(p.wagePercentage ?? p.outboundLoan.wagePercentage) : '',
    potential: p?.potential != null ? String(p.potential) : '',
    wage: formatValueInput(String(p?.wage || '')),
    releaseClause: formatValueInput(String(p?.releaseClause || '')),
    contractYears: p?.contractYears || '',
    // Club de Procedencia y Relevancia: contexto de scouting/plantilla aplicable a cualquier
    // incorporación al primer equipo (Comprado o Cedido), distinto de "Club de Origen" (que es
    // específico del modelo de cesión entrante, el club que sigue siendo dueño del jugador).
    sourceClub: p?.sourceClub || '',
    agreedRole: p?.agreedRole || '',
    // No editables por el asistente en sí (transferStatus se cambia desde la Plantilla/Táctica,
    // no aquí), pero deben conservarse al guardar: si no se incluyeran en el payload de
    // handleConfirm, cualquier edición desde el Paso 4 resetearía en silencio a un jugador
    // Cedible/Transferible/CedidoFuera de vuelta a "Activo".
    transferStatus: p?.transferStatus || 'Activo',
    // Respaldo por compatibilidad: algunos jugadores cedidos fuera solo tienen "loanDuration"
    // (dato antiguo) en vez de outboundLoan.duration (el campo real que rellena cedePlayer),
    // igual que ya contempla la lista de Plantilla al mostrar este mismo dato.
    outboundLoan: p?.outboundLoan || (p?.loanDuration ? { duration: p.loanDuration } : null),
    // "Plantilla Inicial" (ver hidePurchasePrice/hideSourceClub más abajo): tampoco editable
    // desde este asistente en sí — se fija solo al crear el jugador (Paso 2 de "Fichar
    // Jugador" en PlayerList, o el propio OnboardingWizard) y debe conservarse en cualquier
    // edición posterior, igual que transferStatus.
    isInitialSquad: !!p?.isInitialSquad,
  };
};

const emptyPlayer = toFormState(null);
const playerToFormState = toFormState;

// Fila de edición del resumen (Paso 4): muestra el valor + lápiz, y al pulsar despliega el
// control de edición en el sitio, sin salir de la pantalla. Definido fuera de PlayerForm
// (identidad estable entre renders) para no perder el foco de los inputs internos en cada
// pulsación de tecla, algo que ocurriría si se declarase dentro del cuerpo del componente.
// missing: exclusivo de la Revisión Final tras un escaneo con IA (postScanReview, ver más
// abajo) — resalta la fila en rojo con un aviso "Campo requerido" mientras el dato siga
// vacío; en cuanto el usuario lo rellena, "missing" pasa a false en el siguiente render (se
// deriva directamente de form, sin estado propio) y la fila vuelve a su estilo normal.
function ReviewRow({ label, active, onOpen, display, children, missing }) {
  return (
    <div className={`px-4 py-2.5 transition-colors duration-300 ${missing ? 'bg-red-500/10' : ''}`}>
      <div className="flex justify-between items-center gap-2">
        <span className={`text-[9px] font-black uppercase shrink-0 ${missing ? 'text-red-500' : 'text-fg-muted'}`}>
          {label}
          {missing && <span className="ml-1.5 normal-case text-red-500/80">· Campo requerido</span>}
        </span>
        {!active && (
          <button type="button" onClick={onOpen} className="flex items-center gap-1.5 min-w-0 touch-manipulation">
            <span className={`text-xs font-black truncate ${missing ? 'text-red-500' : 'text-fg'}`}>{display}</span>
            <Pencil size={10} className={`shrink-0 ${missing ? 'text-red-400' : 'text-fg-faint'}`} />
          </button>
        )}
      </div>
      {active && <div className="mt-2">{children}</div>}
    </div>
  );
}

const REVIEW_INPUT_CLASS = 'w-full bg-well-strong p-2.5 rounded-lg outline-none border border-border-subtle focus:border-green-500 font-bold text-sm text-fg placeholder:text-fg-faint';
const REVIEW_INPUT_ERROR_CLASS = 'w-full bg-well-strong p-2.5 rounded-lg outline-none border border-red-500 focus:border-red-500 font-bold text-sm text-fg placeholder:text-fg-faint';
const REVIEW_DONE_CLASS = 'mt-2 w-full py-2 rounded-lg bg-green-500/10 text-green-500 text-[9px] font-black uppercase touch-manipulation';

// Cabecera de bloque para agrupar visualmente el resumen del Paso 4 en secciones.
function SectionHeader({ emoji, title }) {
  return (
    <div className="w-full flex items-center gap-2 mt-5 mb-1 px-1 first:mt-0">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-fg-secondary">{title}</span>
    </div>
  );
}

// lockedType / restrictTypes / hidePurchasePrice: variantes usadas tanto por PlayerList (una
// vez decidido el destino Primer Equipo/Academia en el paso previo al propio formulario, ver
// AddPlayerDestinationModal) como por el asistente de bienvenida (OnboardingWizard), para
// reutilizar este mismo formulario "Fichar Jugador" sin duplicar su lógica — lockedType oculta
// por completo el selector de Tipo de Adquisición (p. ej. canteranos, siempre 'Cantera');
// restrictTypes limita qué botones se muestran sin bloquear la elección (p. ej. Primer Equipo:
// solo Comprado/Cedido, sin Cantera);
// hidePurchasePrice oculta el Precio de Compra para jugadores "base" del club que nunca se
// compraron por una cifra (siguen teniendo Valor de Mercado, Sueldo, etc.).
// hideSourceClub: usado por el asistente de bienvenida cuando la partida "Empieza desde Cero"
// — esos jugadores nunca vinieron de otro club (son la base original del club), así que el
// campo Club de Procedencia se oculta por completo (Paso 3 y Paso 4) y se guarda tal cual venga
// en "prefill.sourceClub" (ver OnboardingWizard, que lo fija a "En el club desde el inicio")
// sin que el usuario pueda tocarlo. Relevancia no se ve afectada, sigue visible y editable.
// skipInitialTransaction: usado por el asistente de configuración inicial del club (Create
// Your Club) — un "Comprado" registrado ahí es estado base previo, no una compra real, así
// que no debe descontar presupuesto ni generar un registro en el historial de transacciones.
// initialEditField: abre directamente en modo edición (Paso 4) el campo del resumen indicado
// (p. ej. "wage") y desplaza la vista hasta él — usado por el acceso directo desde el
// Desglose de Sueldos de Finanzas, para que el usuario pueda cambiar el salario sin tener que
// buscarlo manualmente entre el resto de la ficha.
// postScanReview: usado exclusivamente por el resultado del escaneo con IA (ver
// handleScanExtracted en PlayerList) — deja la Revisión Final como pantalla única y directa
// (sin barra de progreso "Paso 4 de 4" ni botón "Anterior", ya que aquí no hay pasos 1-3
// recorridos de verdad en esta sesión) y resalta en rojo los campos que la tarjeta escaneada
// nunca trae y siguen vacíos: Club de Procedencia (Comprado y Cedido), Precio de Compra
// (Comprado) o Club de Origen (Cedido) — el tipo concreto ya lo decidió el usuario en
// AddPlayerOperationTypeModal antes incluso de escanear, ver operationType en
// mapScanResultToPrefill.
// initialSquadTypes: usado exclusivamente por el registro de Plantilla Inicial del asistente de
// bienvenida (OnboardingWizard, tanto al crear como al editar desde el Resumen) — sustituye el
// selector de Tipo de Adquisición habitual (Cantera/Cedido/Comprado) por 3 ESTADOS DE
// SITUACIÓN que nunca implican una compra real: "En Propiedad" (type Comprado, sin precio ni
// club de procedencia — un jugador que ya estaba en el club antes de usar la app), "Cedido en
// Nuestro Club" (type Cedido, idéntico al ya existente) y "Cedido a Otro Club" (type Comprado +
// transferStatus 'CedidoFuera' + outboundLoan, mismo formato que una cesión saliente real). La
// opción "Comprado" como transferencia real queda deliberadamente fuera de este selector:
// registrar aquí una "compra" alteraría el historial de traspasos de una partida que, en
// realidad, ya estaba en marcha antes de escanear/rellenar la plantilla.
export default function PlayerForm({ editingPlayer, prefill, sourceTargetId, onClose, initialStep = 1, initialEditField = null, lockedType = null, restrictTypes = null, hidePurchasePrice = false, hideSourceClub = false, skipInitialTransaction = false, postScanReview = false, initialSquadTypes = false }) {
  const { addOrUpdatePlayer, deleteTarget } = useClubData();
  useAutoHideChrome();

  const [form, setForm] = useState(() => toFormState(editingPlayer || prefill || null));
  const initialFormRef = useRef(form);
  const [step, setStep] = useState(initialStep);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showFootMenu, setShowFootMenu] = useState(false);
  const [footMenuRect, setFootMenuRect] = useState(null);
  const [editField, setEditField] = useState(initialEditField);
  const fileInputRef = useRef(null);
  const reviewFileInputRef = useRef(null);
  const footMenuRef = useRef(null);
  const footBtnRef = useRef(null);
  const footDropdownRef = useRef(null);
  const wageRowRef = useRef(null);
  const backdropRef = usePreventBackdropTouch(true);
  const discardBackdropRef = usePreventBackdropTouch(showDiscardConfirm);

  // Desplaza la vista hasta el campo del sueldo cuando se llega con initialEditField="wage"
  // (acceso directo desde el Desglose de Sueldos): solo una vez, al montar, con el Paso 4 ya
  // presente en el DOM.
  useEffect(() => {
    if (initialEditField === 'wage') wageRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Evita quedarse "atascado" en modo edición de un campo del resumen si el usuario sale
  // del Paso 4 y vuelve a entrar más tarde. skipFirstResetRef evita que este mismo efecto
  // borre, nada más montar, el initialEditField recién inyectado (useEffect también se
  // dispara tras el render inicial, no solo en cambios posteriores de "step").
  const skipFirstResetRef = useRef(true);
  useEffect(() => {
    if (skipFirstResetRef.current) { skipFirstResetRef.current = false; return; }
    setEditField(null);
  }, [step]);

  // El desplegable de Pierna se pinta con un portal (fuera de la tarjeta, que tiene
  // overflow-hidden para mantener cabecera/pie estáticos) para que nunca quede recortado
  // ni tapado por el pie de página, sea cual sea la posición del campo dentro del paso.
  // Por eso el "click fuera" necesita comprobar dos refs (el botón Y el propio portal).
  useEffect(() => {
    if (!showFootMenu) return;
    const handler = (e) => {
      if (footMenuRef.current?.contains(e.target)) return;
      if (footDropdownRef.current?.contains(e.target)) return;
      setShowFootMenu(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showFootMenu]);

  const toggleFootMenu = () => {
    if (showFootMenu) { setShowFootMenu(false); return; }
    const rect = footBtnRef.current?.getBoundingClientRect();
    if (rect) setFootMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setShowFootMenu(true);
  };
  const selectFoot = (value) => {
    set({ preferredFoot: value });
    setShowFootMenu(false);
  };
  const setOutboundDuration = (value) => set({ outboundLoan: { ...(form.outboundLoan || {}), duration: value } });
  const setOutboundDestinationClub = (value) => set({ outboundLoan: { ...(form.outboundLoan || {}), destinationClub: value } });

  // Situación en el Club (ver initialSquadTypes más arriba): deriva el estado de los 3 botones a
  // partir de type/transferStatus reales, y selectInitialAcquisition() es quien los fija juntos
  // en cada cambio — nunca se editan por separado, para no dejar una combinación imposible
  // (p. ej. type Cedido con transferStatus CedidoFuera a la vez).
  const acquisitionKind = form.type === 'Cedido' ? 'loan_in' : form.transferStatus === 'CedidoFuera' ? 'loan_out' : 'owned';
  const INITIAL_ACQUISITION_OPTIONS = [
    { key: 'owned', label: 'En Propiedad', activeClass: 'bg-blue-600 text-white' },
    { key: 'loan_in', label: 'Cedido en Nuestro Club', activeClass: 'bg-yellow-600 text-white' },
    { key: 'loan_out', label: 'Cedido a Otro Club', activeClass: 'bg-purple-600 text-white' },
  ];
  const selectInitialAcquisition = (kind) => {
    if (kind === 'owned') set({ type: 'Comprado', contractYears: '', transferStatus: 'Activo', outboundLoan: null });
    else if (kind === 'loan_in') set({ type: 'Cedido', contractYears: '', transferStatus: 'Activo', outboundLoan: null });
    else if (kind === 'loan_out') set({ type: 'Comprado', contractYears: '', transferStatus: 'CedidoFuera', outboundLoan: form.outboundLoan || { destinationClub: '', duration: '1 Temporada' } });
  };

  // Un jugador cedido a nuestro club (type 'Cedido') no nos pertenece: si el usuario cambia
  // el tipo de adquisición a 'Cedido' se limpia cualquier estado de mercado previo (no puede
  // quedar marcado como Transferible/Cedible/CedidoFuera de un club que no es el suyo).
  const selectAcquisitionType = (t) => {
    if (lockedType) return;
    const patch = { type: t, contractYears: '' };
    if (t === 'Cedido') { patch.transferStatus = 'Activo'; patch.outboundLoan = null; }
    // La Cantera no maneja términos económicos: se limpian para no arrastrar en silencio un
    // valor de mercado/sueldo de un tipo anterior (p. ej. si se edita un "Comprado" y se
    // cambia a "Cantera") a un campo que ya no es visible ni editable.
    if (t === 'Cantera') { patch.marketValue = ''; patch.wage = ''; patch.releaseClause = ''; }
    set(patch);
  };

  // Detección automática de la nacionalidad mientras se escribe (sin desplegable): compara
  // el texto contra un mapa de variantes/sinónimos y códigos habituales (ver countries.js).
  const selectedCountry = detectCountry(form.nationality);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // --- Selección de posiciones: onClick directo, sin interceptar el evento. ---
  const selectPrimary = (pos) => {
    set({ primaryPosition: pos, secondaryPositions: pos === 'POR' ? [] : form.secondaryPositions.filter((p) => p !== 'POR' && p !== pos) });
  };
  const toggleSecondary = (pos) => {
    if (pos === form.primaryPosition || pos === 'POR' || form.primaryPosition === 'POR') return;
    set({ secondaryPositions: form.secondaryPositions.includes(pos) ? form.secondaryPositions.filter((p) => p !== pos) : [...form.secondaryPositions, pos] });
  };

  // Potencial admite un número único ("88") o un rango de texto ("64-88"): se limpia todo lo
  // que no sea dígito y, en cuanto hay 2 dígitos escritos, se inserta automáticamente el guion
  // ("64-") para poder seguir tecleando del tirón los 2 dígitos superiores. Máximo 4 dígitos
  // (2+2), es decir 5 caracteres con el guion incluido.
  const onPotentialChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length >= 3 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits.length === 2 ? `${digits}-` : digits;
    set({ potential: formatted });
  };

  // Backspace sobre el guion recién autoinsertado: sin este manejo, borrar la última posición
  // de "64-" elimina solo el guion y onPotentialChange lo vuelve a añadir al instante (los 2
  // dígitos siguen ahí), dejando el campo "atascado" sin poder borrar más. Al detectar que el
  // cursor está justo tras un guion final, se borra también el dígito anterior en el mismo
  // golpe de tecla ("64-" -> "6").
  const onPotentialKeyDown = (e) => {
    blockEnterKey(e);
    if (e.key !== 'Backspace') return;
    const { value, selectionStart, selectionEnd } = e.target;
    if (selectionStart !== selectionEnd) return;
    if (selectionStart === value.length && value.endsWith('-')) {
      e.preventDefault();
      set({ potential: value.slice(0, -2) });
    }
  };

  // Si el campo se abandona con el guion autoinsertado pero sin el segundo número (p. ej. solo
  // se escribieron "64" y no se completó el rango), se quita ese guion suelto al perder el
  // foco para no dejar guardado un valor a medias como "64-".
  const onPotentialBlur = (e) => {
    if (e.target.value.endsWith('-')) set({ potential: e.target.value.slice(0, -1) });
  };

  // Formatea los campos monetarios (puntos de miles) sin que el cursor salte al final
  // del texto al editar un dígito en medio del número.
  const formatMoneyField = (field) => (e) => {
    const input = e.target;
    const raw = input.value;
    const cursorPos = input.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/\D/g, '').length;
    const formatted = formatValueInput(raw);
    set({ [field]: formatted });
    requestAnimationFrame(() => {
      if (!input.isConnected) return;
      let seen = 0; let pos = formatted.length;
      if (digitsBeforeCursor === 0) { pos = 0; }
      else {
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) seen++;
          if (seen === digitsBeforeCursor) { pos = i + 1; break; }
        }
      }
      try { input.setSelectionRange(pos, pos); } catch (err) { /* input puede haber perdido el foco */ }
    });
  };

  const handlePhotoChange = async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200, 0.8);
      set({ photo: dataUrl });
    } catch (err) {
      console.error(err);
      setFormError('No se pudo procesar la foto. Inténtalo con otra imagen.');
    } finally {
      setIsUploadingPhoto(false);
      // Permite volver a elegir el mismo archivo más tarde si el usuario lo desea.
      input.value = '';
    }
  };

  // Devuelve { message, field } cuando el paso tiene un campo inválido, o null si está todo
  // correcto. "field" es la misma clave de editField que usan las ReviewRow del Paso 4, para
  // poder abrir directamente el campo afectado al editar un jugador ya existente (ver
  // handleConfirm) sin tener que saltar a los pasos 1-3 del asistente.
  const validateStep = (s) => {
    if (s === 1) {
      if (!form.firstName.trim()) return { message: 'El nombre es obligatorio.', field: 'name' };
    }
    if (s === 2) {
      if (!form.primaryPosition) return { message: 'Selecciona la posición principal.', field: 'position' };
      if (!form.rating || isNaN(form.rating) || form.rating < 1 || form.rating > 99) return { message: 'Media entre 1 y 99.', field: 'rating' };
      if (!form.age || isNaN(form.age) || form.age < 15 || form.age > 50) return { message: 'Edad entre 15 y 50.', field: 'age' };
      if (form.type === 'Cantera' && form.potential && !isValidPotentialInput(form.potential)) return { message: 'Potencial entre 1 y 99, o un rango como 64-88.', field: 'potential' };
    }
    if (s === 3) {
      if (form.type !== 'Cantera' && (!form.marketValue || parseValue(form.marketValue) <= 0)) return { message: 'Valor de mercado obligatorio.', field: 'marketValue' };
      if (form.type !== 'Cantera' && (!form.wage || parseValue(form.wage) <= 0)) return { message: 'El sueldo semanal es obligatorio.', field: 'wage' };
      if (form.type === 'Comprado' && !hidePurchasePrice && (!form.value || parseValue(form.value) <= 0)) return { message: 'Precio de compra obligatorio.', field: 'value' };
      if (form.type === 'Comprado' && !form.contractYears) return { message: 'Selecciona los años de contrato.', field: 'contractYears' };
      if (form.type === 'Cedido' && !form.originClub.trim()) return { message: 'Club de origen obligatorio.', field: 'originClub' };
      if (form.type === 'Cedido' && form.hasBuyOption && (!form.buyOption || parseValue(form.buyOption) <= 0)) return { message: 'Introduce el precio de la opción de compra.', field: 'buyOption' };
      if (form.transferStatus === 'CedidoFuera' && !(form.outboundLoan?.destinationClub || '').trim()) return { message: 'Club de destino obligatorio.', field: 'outboundClub' };
    }
    return null;
  };

  // La Cantera no tiene sección de Economía (sin sueldo, cláusula ni costes): cuando el tipo
  // viene bloqueado en 'Cantera' (asistente de bienvenida) el Paso 3 no tiene ya ningún campo
  // que mostrar — el selector de Tipo también está oculto por lockedType — así que se salta
  // directo del Paso 2 (Atributos) al Paso 4 (Revisión) en vez de dejar una pantalla vacía.
  const skipEconomyStep = lockedType === 'Cantera';

  // Únicamente tras un escaneo con IA: club de procedencia (Comprado y Cedido), precio de
  // compra (Comprado) y club de origen (Cedido) nunca aparecen en la propia tarjeta del
  // jugador (no son datos visibles en ella, a diferencia de la media, la posición o el
  // sueldo), así que se marcan como pendientes de rellenar a mano hasta que el usuario los
  // complete — momento en el que dejan de estar "missing" al instante, sin necesidad de un
  // estado aparte, porque se derivan directamente de form.
  const scanSourceClubMissing = postScanReview && form.type !== 'Cantera' && !hideSourceClub && !form.sourceClub.trim();
  const scanPurchasePriceMissing = postScanReview && form.type === 'Comprado' && !hidePurchasePrice && (!form.value || parseValue(form.value) <= 0);
  const scanOriginClubMissing = postScanReview && form.type === 'Cedido' && !form.originClub.trim();
  const hasScanMissingFields = scanSourceClubMissing || scanPurchasePriceMissing || scanOriginClubMissing;

  // --- Navegación: exclusivamente por los botones Anterior/Siguiente del pie. ---
  const goNext = () => {
    const err = validateStep(step);
    if (err) { setFormError(err.message); return; }
    setFormError('');
    let next = step + 1;
    if (next === 3 && skipEconomyStep) next = 4;
    setStep(Math.min(TOTAL_STEPS, next));
  };
  const goPrev = () => {
    setFormError('');
    let prev = step - 1;
    if (prev === 3 && skipEconomyStep) prev = 2;
    setStep(Math.max(1, prev));
  };

  const handleConfirm = async () => {
    if (isSubmitting || hasScanMissingFields) return;
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) {
        setFormError(err.message);
        // Al editar un jugador ya existente, la vista unificada (Paso 4) es la única pantalla:
        // nunca se salta a los pasos 1-3 del asistente (eso abría de facto un wizard "fantasma"
        // con su propio botón "Siguiente"). En su lugar, se abre directamente el campo
        // afectado dentro de la propia revisión para corregirlo ahí mismo.
        if (editingPlayer) setEditField(err.field);
        else setStep(s);
        return;
      }
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const fullName = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}`;
      await addOrUpdatePlayer({
        name: fullName,
        positions: [form.primaryPosition, ...form.secondaryPositions],
        rating: parseInt(form.rating), age: parseInt(form.age),
        preferredFoot: form.preferredFoot || 'Diestro',
        photo: form.photo || null,
        nationality: form.nationality.trim() || null,
        // La Cantera no tiene valor de mercado ni sueldo (campos ocultos en el asistente):
        // se guardan a 0 en vez de arrastrar lo que hubiera en el estado del formulario.
        marketValue: form.type === 'Cantera' ? 0 : parseValue(form.marketValue), type: form.type,
        value: form.type === 'Comprado' ? parseValue(form.value) : 0,
        loanDuration: form.type === 'Cedido' ? form.loanDuration : null,
        originClub: form.type === 'Cedido' ? form.originClub.trim() : null,
        // Club de Procedencia y Relevancia: aplican a Comprado y Cedido por igual, nunca a
        // Cantera (ver guard del propio campo en el Paso 3/Revisión).
        sourceClub: form.type !== 'Cantera' && form.sourceClub.trim() ? form.sourceClub.trim() : null,
        agreedRole: form.type !== 'Cantera' && form.agreedRole ? form.agreedRole : null,
        buyOption: form.type === 'Cedido' && form.hasBuyOption ? (parseValue(form.buyOption) || null) : null,
        wagePercentage: form.type === 'Cedido' && form.wagePercentage ? parseInt(form.wagePercentage) : null,
        // Conserva el estado de mercado real del jugador (Activo/Cedible/Transferible/
        // CedidoFuera): antes se pisaba siempre con 'Activo', lo que sacaba en silencio a un
        // jugador cedido fuera de esa lista con solo editarlo desde el Paso 4.
        transferStatus: form.transferStatus,
        // wagePercentage/hasBuyOption/buyOption son los mismos campos compartidos que rellena
        // el bloque "% Salario Pagado"/"¿Con Opción de Compra?" de arriba (ver comentario ahí):
        // para una cesión SALIENTE viven dentro de outboundLoan (mismo esquema que cedePlayer),
        // nunca en los campos de nivel superior — esos son exclusivos de la cesión ENTRANTE.
        outboundLoan: form.transferStatus === 'CedidoFuera' ? {
          ...(form.outboundLoan || {}),
          wagePercentage: form.wagePercentage ? parseInt(form.wagePercentage) : 0,
          buyOption: form.hasBuyOption ? (parseValue(form.buyOption) || null) : null,
        } : null,
        // Al EDITAR se conserva tal cual (form.isInitialSquad, cargado por toFormState desde el
        // jugador ya guardado) — este asistente no ofrece forma de cambiarlo después de creado.
        // Al CREAR (sin editingPlayer) se deriva de hidePurchasePrice && hideSourceClub: hoy la
        // única combinación que activa ambos a la vez es "Plantilla Inicial" (ver PlayerList) y
        // el "Empieza desde Cero" de OnboardingWizard — exactamente los dos casos de un jugador
        // ya en el club sin una compra real que registrar.
        isInitialSquad: editingPlayer ? form.isInitialSquad : (hidePurchasePrice && hideSourceClub),
        wage: form.type === 'Cantera' ? 0 : parseValue(form.wage),
        // Años de contrato y cláusula de rescisión son exclusivos de "Comprado": Cantera nunca
        // los tuvo y Cedido los pierde a partir de ahora (sustituidos por duración de cesión,
        // % de salario asumido y opción de compra).
        releaseClause: form.type === 'Comprado' ? (parseValue(form.releaseClause) || null) : null,
        contractYears: form.type === 'Comprado' && form.contractYears ? parseInt(form.contractYears) : null,
        // Vive en Atributos Deportivos (Paso 2), no en Economía, pero sigue siendo exclusivo
        // de la Cantera: un jugador del primer equipo no tiene rango de potencial. Se guarda
        // como texto (no parseInt) para conservar rangos como "64-88" tal cual;
        // parsePotentialRange() normaliza este campo donde haga falta un número (listas,
        // filtros, barra de progreso).
        potential: form.type === 'Cantera' && form.potential ? form.potential.trim() : null,
      }, editingPlayer?.id, { skipFinancialEffects: skipInitialTransaction });
      if (!editingPlayer && sourceTargetId) {
        try { await deleteTarget(sourceTargetId); } catch (err) { console.error(err); }
      }
      onClose();
    } catch (err) {
      setFormError('Error de base de datos.');
      setIsSubmitting(false);
    }
  };

  // --- Cierre: única y exclusivamente disparado por el botón X. ---
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  const handleCloseClick = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };

  const fullNamePreview = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}` || 'Nuevo Jugador';
  const positionsPreview = [form.primaryPosition, ...form.secondaryPositions].filter(Boolean).join(' · ') || '—';

  // Años de Contrato es exclusivo de "Comprado" (Cedido usa su propia Duración de Cesión).
  const contractYearOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Año${n > 1 ? 's' : ''}` }));

  return (
    <>
      {/* Backdrop: no tiene su propio scroll (no es contenido scrolleable), así que un
          touchmove que empiece aquí se bloquea (usePreventBackdropTouch) para que no arrastre
          la página de la plantilla que sigue debajo — sin tocar document.body en ningún
          momento, para no desajustar las coordenadas táctiles en Safari iOS. */}
      <div ref={backdropRef} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overscroll-contain">
        {/* Tarjeta compacta: flex-col + overflow-hidden en el propio contenedor, para que
            cabecera y pie queden completamente estáticos y solo el cuerpo central (flex-1
            overflow-y-auto) haga scroll, incluso si el teclado se despliega en móvil. */}
        <div className="bg-surface border border-border rounded-[32px] w-full max-w-sm shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
            <h3 className="font-black italic text-green-500 text-sm uppercase">{editingPlayer ? 'Editar Jugador' : 'Fichar Jugador'}</h3>
            <button type="button" onClick={handleCloseClick} className="p-1 text-fg-faint hover:text-fg transition-colors touch-manipulation">
              <X size={18} />
            </button>
          </div>

          <div onScroll={() => setShowFootMenu(false)} className="px-5 pt-4 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
            {/* Barra de progreso y "Paso X de Y": solo tiene sentido en el asistente de alta
                (Fichar Jugador). Editar un jugador ya existente entra directo a la vista
                unificada (Paso 4, con todos los campos accesibles) sin rastro del wizard. */}
            {!editingPlayer && !postScanReview && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                    <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${n <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
                  ))}
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-fg-muted text-center mt-2">Paso {step} de {TOTAL_STEPS} · {STEP_TITLES[step - 1]}</p>
              </div>
            )}

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse">
                <ShieldAlert size={14} className="shrink-0" /><span>{formError}</span>
              </div>
            )}

            {/* Solo se monta en el DOM el paso activo: nada oculto por CSS. */}
            <div key={step} className="space-y-4 pb-4 animate-in fade-in slide-in-from-right-4 duration-300">
              {step === 1 && (
                <>
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="relative group cursor-pointer" onClick={() => { if (!isUploadingPhoto) fileInputRef.current?.click(); }}>
                      {form.photo ? (
                        <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full border-2 border-border object-cover shadow-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-well border-2 border-dashed border-border flex flex-col items-center justify-center text-fg-muted hover:border-green-500 hover:text-green-500 transition-all">
                          <User size={26} />
                        </div>
                      )}
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
                      <button type="button" disabled={isUploadingPhoto} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation">
                        {isUploadingPhoto ? <RefreshCcw size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
                      </button>
                    </div>
                    <span className="text-[9px] text-fg-faint font-black uppercase tracking-widest">Foto / Avatar (opcional)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label>
                      <input type="text" required autoComplete="off" placeholder="Erling" onKeyDown={blockEnterKey} className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Apellido</label>
                      <input type="text" autoComplete="off" placeholder="Haaland" onKeyDown={blockEnterKey} className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-fg-muted ml-1">Nacionalidad</label>
                    <div className="relative">
                      {selectedCountry ? (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none">{flagEmoji(selectedCountry.code)}</span>
                      ) : (
                        <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" size={16} />
                      )}
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Ej: Noruega"
                        onKeyDown={blockEnterKey}
                        className="w-full bg-well p-4 pl-11 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm"
                        value={form.nationality}
                        onChange={(e) => set({ nationality: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-fg-muted ml-1">Posición Principal *</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                      {ALL_POSITIONS.map((pos) => (
                        <button key={pos} type="button" onClick={() => selectPrimary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.primaryPosition === pos ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.primaryPosition && form.primaryPosition !== 'POR' && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones Secundarias</label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                        {ALL_POSITIONS.filter((pos) => pos !== 'POR' && pos !== form.primaryPosition).map((pos) => (
                          <button key={pos} type="button" onClick={() => toggleSecondary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.secondaryPositions.includes(pos) ? 'bg-green-500/80 text-black shadow-lg shadow-green-500/20' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Orden fijo: Pierna (izquierda) · Media (centro) · Edad (derecha), mismo
                      tamaño y alineación para las tres columnas. */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 relative" ref={footMenuRef}>
                      <label className="text-[9px] font-black text-fg-muted ml-1">Pierna</label>
                      <button ref={footBtnRef} type="button" onClick={toggleFootMenu} className="w-full h-[52px] bg-well p-2 rounded-xl outline-none border border-border-subtle flex flex-col items-center justify-center gap-0.5 font-black text-fg touch-manipulation">
                        {FOOT_OPTIONS.find((f) => f.value === form.preferredFoot)?.closedIcon}
                        <span className="text-[8px] uppercase tracking-wide">{form.preferredFoot}</span>
                      </button>
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Media *</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" required placeholder="90" min="1" max="99" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.rating} onChange={(e) => set({ rating: e.target.value })} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Edad *</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" required placeholder="23" min="15" max="50" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.age} onChange={(e) => set({ age: e.target.value })} />
                    </div>
                  </div>
                  {/* Potencial: perfil deportivo, no económico — vive aquí junto a Media/Edad,
                      pero exclusivo de la Cantera. Un jugador del primer equipo (Comprado o
                      Cedido) no tiene rango de potencial. */}
                  {form.type === 'Cantera' && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Potencial (opcional, 1-99 o rango, ej: 64-88)</label>
                      <input type="text" inputMode="numeric" placeholder="Ej: 88 o 64-88" onKeyDown={onPotentialKeyDown} onBlur={onPotentialBlur} className={FIELD_CLASS} value={form.potential} onChange={onPotentialChange} />
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  {/* lockedType (usado por el asistente de bienvenida para canteranos y
                      jugadores base): oculta el selector por completo, el tipo ya viene fijado
                      desde "prefill". restrictTypes limita qué botones se muestran sin bloquear
                      la elección (p. ej. solo Comprado/Cedido al registrar una plantilla ya
                      existente, sin la opción Cantera). */}
                  {!lockedType && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">{initialSquadTypes ? 'Situación en el Club' : 'Tipo de Adquisición'}</label>
                      <div className="flex gap-2">
                        {initialSquadTypes ? INITIAL_ACQUISITION_OPTIONS.map((opt) => (
                          <button key={opt.key} type="button" onClick={() => selectInitialAcquisition(opt.key)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all touch-manipulation ${acquisitionKind === opt.key ? opt.activeClass : 'bg-well text-fg-muted hover:bg-well-strong'}`}>{opt.label}</button>
                        )) : (restrictTypes || ['Cantera', 'Cedido', 'Comprado']).map((t) => {
                          const activeClass = t === 'Cantera' ? 'bg-emerald-600 text-white' : t === 'Cedido' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white';
                          return (
                            <button key={t} type="button" onClick={() => selectAcquisitionType(t)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${form.type === t ? activeClass : 'bg-well text-fg-muted hover:bg-well-strong'}`}>{t}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Club de Procedencia y Relevancia: aplican a cualquier incorporación al
                      primer equipo (Comprado o Cedido), nunca a Cantera. Club de Procedencia
                      se oculta por completo si hideSourceClub (partida "Empieza desde Cero"):
                      Relevancia ocupa entonces la fila completa, sin dejar hueco vacío. */}
                  {form.type !== 'Cantera' && (
                    <div className={hideSourceClub ? '' : 'grid grid-cols-2 gap-3'}>
                      {!hideSourceClub && (
                        <div className="space-y-1 relative">
                          <label className="text-[9px] font-black text-fg-muted ml-1">Club de Procedencia</label>
                          <input type="text" placeholder="Ej: Sporting Gijón" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.sourceClub} onChange={(e) => set({ sourceClub: e.target.value })} />
                        </div>
                      )}
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Relevancia</label>
                        <Dropdown value={form.agreedRole} options={AGREED_ROLE_OPTIONS} onChange={(v) => set({ agreedRole: v })} placeholder="Seleccionar" labelClassName="text-xs" />
                      </div>
                    </div>
                  )}
                  {form.type === 'Comprado' && !hidePurchasePrice && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra (€) *</label>
                      <input type="text" inputMode="numeric" required placeholder="Ej: 50.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.value} onChange={formatMoneyField('value')} />
                    </div>
                  )}

                  {/* "Cedido a Otro Club" (initialSquadTypes): el jugador sigue siendo nuestro,
                      pero necesita club de destino + duración — mismo par de campos que el resto
                      de cesiones, solo que aquí alimentan outboundLoan en vez de originClub. */}
                  {form.transferStatus === 'CedidoFuera' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Club de Destino *</label>
                        <input type="text" required placeholder="Ej: Almería" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.outboundLoan?.destinationClub || ''} onChange={(e) => setOutboundDestinationClub(e.target.value)} />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Duración Cesión</label>
                        <input type="text" placeholder="Ej: 11 Meses" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.outboundLoan?.duration || ''} onChange={(e) => setOutboundDuration(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {form.type === 'Cedido' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Duración Cesión</label>
                        <input type="text" placeholder="Ej: 11 Meses" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.loanDuration} onChange={(e) => set({ loanDuration: e.target.value })} />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Club de Origen *</label>
                        <input type="text" required placeholder="Ej: Real Madrid" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.originClub} onChange={(e) => set({ originClub: e.target.value })} />
                      </div>
                    </div>
                  )}

                  {/* Valor de Mercado y Sueldo: ocultos por completo para Cantera (sin
                      términos económicos todavía). El sueldo, en Cedido, es el total del
                      jugador — el % que asume nuestro club se define justo debajo. */}
                  {form.type !== 'Cantera' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Valor de Mercado (€) *</label>
                        <input type="text" inputMode="numeric" required placeholder="Ej: 80.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.marketValue} onChange={formatMoneyField('marketValue')} />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">{form.type === 'Cedido' ? 'Sueldo Semanal Total (€) *' : 'Sueldo Semanal (€) *'}</label>
                        <input type="text" inputMode="numeric" required placeholder="Ej: 500.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.wage} onChange={formatMoneyField('wage')} />
                      </div>
                    </div>
                  )}

                  {/* % de reparto de salario: aplica tanto a la cesión ENTRANTE (Cedido, lo
                      que paga nuestro club de un jugador ajeno) como a la SALIENTE
                      (transferStatus CedidoFuera, lo que paga nuestro club de un jugador
                      propio mientras está fuera) — nunca coinciden a la vez, así que reutilizar
                      el mismo par de campos (wagePercentage/hasBuyOption/buyOption) para ambas
                      direcciones es seguro y evita duplicar el formulario entero. */}
                  {(form.type === 'Cedido' || form.transferStatus === 'CedidoFuera') && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">% Salario Pagado por Nuestro Club</label>
                      <div className="flex items-center gap-3 bg-well p-3 rounded-xl border border-border-subtle">
                        <input type="range" min="0" max="100" step="5" className="flex-1 accent-green-500" value={form.wagePercentage || 0} onChange={(e) => set({ wagePercentage: e.target.value })} />
                        <span className="w-12 text-center font-black text-fg bg-well-strong rounded-lg py-1.5 text-xs shrink-0">{form.wagePercentage || 0}%</span>
                      </div>
                      <p className="text-[9px] text-fg-faint font-bold ml-1">Tu club paga: {formatCurrency(parseValue(form.wage) * (Number(form.wagePercentage) || 0) / 100)} / sem ({formatCurrency(parseValue(form.wage) * (Number(form.wagePercentage) || 0) / 100 * 52)} / año)</p>
                    </div>
                  )}

                  {(form.type === 'Cedido' || form.transferStatus === 'CedidoFuera') && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">¿Con Opción de Compra?</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => set({ hasBuyOption: true })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${form.hasBuyOption ? 'bg-green-500 text-black' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Sí</button>
                        <button type="button" onClick={() => set({ hasBuyOption: false, buyOption: '' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${!form.hasBuyOption ? 'bg-well-strong text-fg' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>No</button>
                      </div>
                      {form.hasBuyOption && (
                        <input type="text" inputMode="numeric" placeholder="Ej: 40.000.000" onKeyDown={blockEnterKey} className={`${FIELD_CLASS} mt-2`} value={form.buyOption} onChange={formatMoneyField('buyOption')} />
                      )}
                    </div>
                  )}

                  {/* Años de Contrato y Cláusula de Rescisión: exclusivos de "Comprado". */}
                  {form.type === 'Comprado' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Años Contrato *</label>
                        <Dropdown value={form.contractYears} options={contractYearOptions} onChange={(v) => set({ contractYears: v })} placeholder="Seleccionar" labelClassName="text-xs" />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Cláusula de Rescisión (€)</label>
                        <input type="text" inputMode="numeric" placeholder="Ej: 150.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.releaseClause} onChange={formatMoneyField('releaseClause')} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <div className="flex flex-col items-center">
                  {/* Carta = vista previa en vivo de los mismos datos de "form", sin controles
                      propios: toda la edición ocurre en la lista de abajo, así que la carta
                      se actualiza sola en cuanto se cambia cualquier campo. */}
                  <div className={`relative w-52 rounded-[28px] p-5 shadow-2xl border-2 border-black/10 ${getCardStyle(parseInt(form.rating) || 0)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-4xl font-black">{form.rating}</span>
                        <span className="text-[10px] font-black uppercase mt-1 tracking-wider">{form.primaryPosition}</span>
                      </div>
                      {form.nationality && (
                        <span className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-sm leading-none shrink-0 overflow-hidden">{selectedCountry ? flagEmoji(selectedCountry.code) : '🌍'}</span>
                      )}
                    </div>
                    <div className="flex justify-center my-3">
                      {form.photo ? (
                        <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full object-cover border-4 border-black/10 shadow-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-black/10 flex items-center justify-center border-4 border-black/10"><User size={30} /></div>
                      )}
                    </div>
                    <div className="text-center font-black uppercase italic text-sm tracking-tight border-t border-black/10 pt-2 truncate">{fullNamePreview}</div>
                    {form.secondaryPositions.length > 0 && <div className="text-center text-[9px] font-bold uppercase opacity-70 mt-0.5 truncate">{form.secondaryPositions.join(' · ')}</div>}
                  </div>

                  <div className="w-full mx-auto text-center mt-4 mb-1 px-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-fg-faint">Toca un dato para editarlo</span>
                  </div>

                  {/* Constancia visual explícita de "Ya en el Club" (ver isInitialSquad) antes
                      de confirmar: la fila "Adquisición" del Paso Economía queda oculta cuando
                      lockedType está fijado (como aquí), así que sin este aviso no quedaría
                      rastro alguno en la Revisión Final de que el jugador no tuvo una compra
                      real que registrar. */}
                  {form.isInitialSquad && (
                    <div className="w-full mt-2 mb-1 px-1">
                      <div className="flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 rounded-lg py-2 px-3">
                        <Shirt size={12} className="shrink-0" /> Estado: Ya en el Club desde el Inicio
                      </div>
                    </div>
                  )}

                  <SectionHeader emoji="👤" title="Datos Personales" />
                  <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    <div className="px-4 py-2.5 flex justify-between items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-fg-muted">Foto</span>
                      <button type="button" onClick={() => { if (!isUploadingPhoto) reviewFileInputRef.current?.click(); }} disabled={isUploadingPhoto} className="flex items-center gap-1.5 touch-manipulation">
                        <span className="text-xs font-black text-fg">{isUploadingPhoto ? 'Subiendo...' : form.photo ? 'Cambiar' : 'Añadir'}</span>
                        <Pencil size={10} className="text-fg-faint shrink-0" />
                      </button>
                      <input type="file" accept="image/*" ref={reviewFileInputRef} className="hidden" onChange={handlePhotoChange} />
                    </div>

                    <ReviewRow label="Nombre" active={editField === 'name'} onOpen={() => setEditField('name')} display={fullNamePreview}>
                      <div className="grid grid-cols-2 gap-2">
                        <input autoFocus type="text" placeholder="Nombre" onKeyDown={blockEnterKey} className={REVIEW_INPUT_CLASS} value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                        <input type="text" placeholder="Apellido" onKeyDown={blockEnterKey} className={REVIEW_INPUT_CLASS} value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                      </div>
                      <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                    </ReviewRow>

                    <ReviewRow label="Nacionalidad" active={editField === 'nationality'} onOpen={() => setEditField('nationality')} display={form.nationality || 'Sin definir'}>
                      <div className="relative">
                        {selectedCountry ? (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm leading-none pointer-events-none">{flagEmoji(selectedCountry.code)}</span>
                        ) : (
                          <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" size={14} />
                        )}
                        <input autoFocus type="text" placeholder="Ej: Noruega" onKeyDown={blockEnterKey} className={`${REVIEW_INPUT_CLASS} pl-8`} value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} />
                      </div>
                      <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                    </ReviewRow>

                    <ReviewRow label="Edad" active={editField === 'age'} onOpen={() => setEditField('age')} display={form.age ? `${form.age} Años` : '—'}>
                      <input autoFocus type="number" inputMode="numeric" min="15" max="50" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.age} onChange={(e) => set({ age: e.target.value })} />
                    </ReviewRow>
                  </div>

                  <SectionHeader emoji="⚽" title="Atributos Deportivos" />
                  <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    <ReviewRow label="Media (OVR)" active={editField === 'rating'} onOpen={() => setEditField('rating')} display={form.rating || '—'}>
                      <input autoFocus type="number" inputMode="numeric" min="1" max="99" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.rating} onChange={(e) => set({ rating: e.target.value })} />
                    </ReviewRow>

                    <ReviewRow label="Pierna" active={editField === 'foot'} onOpen={() => setEditField('foot')} display={form.preferredFoot}>
                      <Dropdown value={form.preferredFoot} options={FOOT_OPTIONS} onChange={(v) => { set({ preferredFoot: v }); setEditField(null); }} />
                    </ReviewRow>

                    {/* Edición de posiciones: principal y secundarias, ambas modificables desde
                        la propia revisión final. */}
                    <ReviewRow label="Posiciones" active={editField === 'position'} onOpen={() => setEditField('position')} display={positionsPreview}>
                      <div className="space-y-2">
                        <div>
                          <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Principal</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {ALL_POSITIONS.map((pos) => (
                              <button key={pos} type="button" onClick={() => selectPrimary(pos)} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.primaryPosition === pos ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>
                            ))}
                          </div>
                        </div>
                        {form.primaryPosition && form.primaryPosition !== 'POR' && (
                          <div>
                            <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Secundarias</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {ALL_POSITIONS.filter((pos) => pos !== 'POR' && pos !== form.primaryPosition).map((pos) => (
                                <button key={pos} type="button" onClick={() => toggleSecondary(pos)} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.secondaryPositions.includes(pos) ? 'bg-green-500/80 text-black' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                    </ReviewRow>

                    {/* Potencial: perfil deportivo, no económico — igual que en el Paso 2,
                        exclusivo de la Cantera. */}
                    {form.type === 'Cantera' && (
                    <ReviewRow label="Potencial" active={editField === 'potential'} onOpen={() => setEditField('potential')} display={form.potential || 'Sin definir'}>
                      <input autoFocus type="text" inputMode="numeric" placeholder="Ej: 88 o 64-88" onKeyDown={onPotentialKeyDown} onBlur={(e) => { onPotentialBlur(e); setEditField(null); }} className={`${FIELD_CLASS} h-11`} value={form.potential} onChange={onPotentialChange} />
                    </ReviewRow>
                    )}
                  </div>

                  {/* La Cantera bloqueada no tiene sección de Economía (sin sueldo, cláusula
                      ni costes): se omite por completo en vez de mostrarla vacía. */}
                  {!skipEconomyStep && (
                  <>
                  <SectionHeader emoji="💰" title="Economía" />
                  <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    {!lockedType && (
                      <ReviewRow label={initialSquadTypes ? 'Situación en el Club' : 'Adquisición'} active={editField === 'type'} onOpen={() => setEditField('type')} display={initialSquadTypes ? (INITIAL_ACQUISITION_OPTIONS.find((o) => o.key === acquisitionKind)?.label || acquisitionKind) : form.type}>
                        <div className="flex gap-2">
                          {initialSquadTypes ? INITIAL_ACQUISITION_OPTIONS.map((opt) => (
                            <button key={opt.key} type="button" onClick={() => selectInitialAcquisition(opt.key)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${acquisitionKind === opt.key ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>{opt.label}</button>
                          )) : (restrictTypes || ['Cantera', 'Cedido', 'Comprado']).map((t) => (
                            <button key={t} type="button" onClick={() => selectAcquisitionType(t)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${form.type === t ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>{t}</button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                      </ReviewRow>
                    )}

                    {form.type !== 'Cantera' && (
                      <>
                        {!hideSourceClub && (
                          <ReviewRow label="Club de Procedencia" active={editField === 'sourceClub'} onOpen={() => setEditField('sourceClub')} display={form.sourceClub || 'Sin definir'} missing={scanSourceClubMissing}>
                            <input autoFocus type="text" placeholder="Ej: Sporting Gijón" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={scanSourceClubMissing ? REVIEW_INPUT_ERROR_CLASS : REVIEW_INPUT_CLASS} value={form.sourceClub} onChange={(e) => set({ sourceClub: e.target.value })} />
                          </ReviewRow>
                        )}
                        <ReviewRow label="Relevancia" active={editField === 'agreedRole'} onOpen={() => setEditField('agreedRole')} display={form.agreedRole || 'Sin definir'}>
                          <Dropdown value={form.agreedRole} options={AGREED_ROLE_OPTIONS} onChange={(v) => { set({ agreedRole: v }); setEditField(null); }} placeholder="Seleccionar" />
                        </ReviewRow>
                      </>
                    )}

                    {/* Valor de Mercado: oculto para Cantera, igual que en el Paso 3. */}
                    {form.type !== 'Cantera' && (
                      <ReviewRow label="Valor de Mercado (€)" active={editField === 'marketValue'} onOpen={() => setEditField('marketValue')} display={`${form.marketValue || '0'} €`}>
                        <input autoFocus type="text" inputMode="numeric" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.marketValue} onChange={formatMoneyField('marketValue')} />
                      </ReviewRow>
                    )}

                    {/* Campos dinámicos: cambian según el Tipo de Adquisición elegido arriba. */}
                    {form.type === 'Comprado' && (
                      <>
                        {!hidePurchasePrice && (
                          <ReviewRow label="Precio de Compra (€)" active={editField === 'value'} onOpen={() => setEditField('value')} display={form.value ? `${form.value} €` : 'Sin definir'} missing={scanPurchasePriceMissing}>
                            <input autoFocus type="text" inputMode="numeric" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={scanPurchasePriceMissing ? FIELD_CLASS_ERROR : `${FIELD_CLASS} h-11`} value={form.value} onChange={formatMoneyField('value')} />
                          </ReviewRow>
                        )}
                        <div ref={wageRowRef}>
                          <ReviewRow label="Sueldo Semanal (€)" active={editField === 'wage'} onOpen={() => setEditField('wage')} display={`${form.wage || '0'} €`}>
                            <input autoFocus type="text" inputMode="numeric" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.wage} onChange={formatMoneyField('wage')} />
                          </ReviewRow>
                        </div>
                        <ReviewRow label="Años Contrato" active={editField === 'contractYears'} onOpen={() => setEditField('contractYears')} display={form.contractYears ? `${form.contractYears} Años` : 'Sin definir'}>
                          <Dropdown value={form.contractYears} options={contractYearOptions} onChange={(v) => { set({ contractYears: v }); setEditField(null); }} placeholder="Seleccionar" />
                        </ReviewRow>
                        <ReviewRow label="Cláusula de Rescisión (€)" active={editField === 'releaseClause'} onOpen={() => setEditField('releaseClause')} display={`${form.releaseClause || '0'} €`}>
                          <input autoFocus type="text" inputMode="numeric" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.releaseClause} onChange={formatMoneyField('releaseClause')} />
                        </ReviewRow>
                        {/* Reparto de salario y opción de compra de la cesión SALIENTE (ver el
                            mismo bloque del Paso 3): "Comprado" cubre tanto un jugador en
                            propiedad normal como uno cedido a otro club (transferStatus
                            CedidoFuera), que sí necesita estos dos campos aunque siga siendo
                            nuestro. */}
                        {form.transferStatus === 'CedidoFuera' && (
                          <>
                            <ReviewRow label="% Salario Pagado por Nuestro Club" active={editField === 'wagePercentage'} onOpen={() => setEditField('wagePercentage')} display={`${form.wagePercentage || 0}%`}>
                              <div className="flex items-center gap-3">
                                <input type="range" min="0" max="100" step="5" className="flex-1 accent-green-500" value={form.wagePercentage || 0} onChange={(e) => set({ wagePercentage: e.target.value })} />
                                <span className="w-12 text-center font-black text-fg bg-well-strong rounded-lg py-1.5 text-xs shrink-0">{form.wagePercentage || 0}%</span>
                              </div>
                              <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                            </ReviewRow>
                            <ReviewRow label="¿Opción de Compra?" active={editField === 'buyOption'} onOpen={() => setEditField('buyOption')} display={form.hasBuyOption ? `Sí · ${form.buyOption || '0'} €` : 'No'}>
                              <div className="flex gap-2 mb-2">
                                <button type="button" onClick={() => set({ hasBuyOption: true })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${form.hasBuyOption ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>Sí</button>
                                <button type="button" onClick={() => set({ hasBuyOption: false, buyOption: '' })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${!form.hasBuyOption ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>No</button>
                              </div>
                              {form.hasBuyOption && (
                                <input autoFocus type="text" inputMode="numeric" placeholder="Ej: 40.000.000" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.buyOption} onChange={formatMoneyField('buyOption')} />
                              )}
                              {!form.hasBuyOption && <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>}
                            </ReviewRow>
                          </>
                        )}
                      </>
                    )}

                    {form.type === 'Cedido' && (
                      <>
                        <ReviewRow label="Club de Origen" active={editField === 'originClub'} onOpen={() => setEditField('originClub')} display={form.originClub || 'Sin definir'} missing={scanOriginClubMissing}>
                          <input autoFocus type="text" placeholder="Ej: Real Madrid" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={scanOriginClubMissing ? REVIEW_INPUT_ERROR_CLASS : REVIEW_INPUT_CLASS} value={form.originClub} onChange={(e) => set({ originClub: e.target.value })} />
                        </ReviewRow>
                        <ReviewRow label="Duración Cesión" active={editField === 'loanDuration'} onOpen={() => setEditField('loanDuration')} display={form.loanDuration}>
                          <input autoFocus type="text" placeholder="Ej: 11 Meses" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={REVIEW_INPUT_CLASS} value={form.loanDuration} onChange={(e) => set({ loanDuration: e.target.value })} />
                        </ReviewRow>
                        <div ref={wageRowRef}>
                          <ReviewRow label="Sueldo Semanal Total (€)" active={editField === 'wage'} onOpen={() => setEditField('wage')} display={`${form.wage || '0'} €`}>
                            <input autoFocus type="text" inputMode="numeric" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.wage} onChange={formatMoneyField('wage')} />
                          </ReviewRow>
                        </div>
                        <ReviewRow label="% Salario Pagado" active={editField === 'wagePercentage'} onOpen={() => setEditField('wagePercentage')} display={`${form.wagePercentage || 0}%`}>
                          <div className="flex items-center gap-3">
                            <input type="range" min="0" max="100" step="5" className="flex-1 accent-green-500" value={form.wagePercentage || 0} onChange={(e) => set({ wagePercentage: e.target.value })} />
                            <span className="w-12 text-center font-black text-fg bg-well-strong rounded-lg py-1.5 text-xs shrink-0">{form.wagePercentage || 0}%</span>
                          </div>
                          <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>
                        </ReviewRow>
                        <ReviewRow label="¿Opción de Compra?" active={editField === 'buyOption'} onOpen={() => setEditField('buyOption')} display={form.hasBuyOption ? `Sí · ${form.buyOption || '0'} €` : 'No'}>
                          <div className="flex gap-2 mb-2">
                            <button type="button" onClick={() => set({ hasBuyOption: true })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${form.hasBuyOption ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>Sí</button>
                            <button type="button" onClick={() => set({ hasBuyOption: false, buyOption: '' })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase touch-manipulation ${!form.hasBuyOption ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted'}`}>No</button>
                          </div>
                          {form.hasBuyOption && (
                            <input autoFocus type="text" inputMode="numeric" placeholder="Ej: 40.000.000" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={`${FIELD_CLASS} h-11`} value={form.buyOption} onChange={formatMoneyField('buyOption')} />
                          )}
                          {!form.hasBuyOption && <button type="button" onClick={() => setEditField(null)} className={REVIEW_DONE_CLASS}>Listo</button>}
                        </ReviewRow>
                      </>
                    )}

                  </div>
                  </>
                  )}

                  {/* Aparece tanto al editar un jugador ya cedido a otro club (transferStatus
                      'CedidoFuera', ajusta la duración sin ir a la Plantilla) como al crear uno
                      con "Cedido a Otro Club" en initialSquadTypes (aquí es donde se completa
                      el Club de Destino antes de confirmar). Al final de la ficha, como pide
                      el diseño. */}
                  {form.transferStatus === 'CedidoFuera' && (
                    <>
                      <SectionHeader emoji="🔄" title="Cesión" />
                      <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                        <ReviewRow label="Club de Destino" active={editField === 'outboundClub'} onOpen={() => setEditField('outboundClub')} display={form.outboundLoan?.destinationClub || 'Sin definir'}>
                          <input autoFocus type="text" placeholder="Ej: Almería" onKeyDown={blockEnterKey} onBlur={() => setEditField(null)} className={REVIEW_INPUT_CLASS} value={form.outboundLoan?.destinationClub || ''} onChange={(e) => setOutboundDestinationClub(e.target.value)} />
                        </ReviewRow>
                        <ReviewRow label="Duración de la Cesión" active={editField === 'outboundDuration'} onOpen={() => setEditField('outboundDuration')} display={form.outboundLoan?.duration || 'Sin definir'}>
                          <Dropdown value={form.outboundLoan?.duration} options={LOAN_DURATION_OPTIONS} onChange={(v) => { setOutboundDuration(v); setEditField(null); }} placeholder="Seleccionar" />
                        </ReviewRow>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {/* "Anterior" solo existe dentro del asistente de alta manual: editar no debe poder
                navegar hacia atrás a los pasos 1-3 (se queda siempre en la vista unificada), y
                tras un escaneo con IA tampoco tiene sentido (nunca se recorrieron esos pasos en
                esta sesión, ver postScanReview) — la Revisión Final queda como pantalla única. */}
            {step > 1 && !editingPlayer && !postScanReview && (
              <button type="button" onClick={goPrev} className="flex-1 py-4 rounded-xl bg-well-strong text-fg font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:brightness-125 transition-all touch-manipulation">
                <ChevronLeft size={16} /> Anterior
              </button>
            )}
            {step < TOTAL_STEPS && (
              <button type="button" onClick={goNext} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all touch-manipulation">
                Siguiente <ChevronRight size={16} />
              </button>
            )}
            {step === TOTAL_STEPS && (
              <button type="button" disabled={isSubmitting || hasScanMissingFields} onClick={handleConfirm} className="flex-1 w-full py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 text-center hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:bg-green-500 touch-manipulation">
                {isSubmitting ? 'Guardando...' : editingPlayer ? (<><Check size={16} className="shrink-0" /> Guardar Cambios</>) : (<><Check size={16} className="shrink-0" /> <span className="md:hidden">Confirmar</span><span className="hidden md:inline">Confirmar Fichaje</span></>)}
              </button>
            )}
          </footer>
        </div>
      </div>

      {/* Portal: el desplegable de Pierna se pinta fuera de la tarjeta (que tiene
          overflow-hidden) para que nunca quede recortado ni tapado por el pie de página,
          con posición fixed calculada a partir del propio botón. Se cierra automáticamente
          en cuanto se elige una opción, y también si el usuario hace scroll dentro del paso. */}
      {showFootMenu && footMenuRect && createPortal(
        <div
          ref={footDropdownRef}
          style={{ position: 'fixed', top: footMenuRect.top, left: footMenuRect.left, width: footMenuRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {FOOT_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => selectFoot(opt.value)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.preferredFoot === opt.value ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Confirmación de descarte simple, sin bloqueo de scroll del body: su propio backdrop
          usa el mismo guard de touchmove (discardBackdropRef) para no arrastrar la página
          de fondo mientras está abierta. */}
      {showDiscardConfirm && (
        <div ref={discardBackdropRef} className="fixed inset-0 bg-black/90 z-[250] flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-fg">¿Deseas salir?</h3>
            <p className="text-[10px] text-fg-muted mb-6 font-bold uppercase tracking-widest">Se perderán los datos introducidos del jugador.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all touch-manipulation">Cancelar</button>
              <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all touch-manipulation">Salir y Descartar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { emptyPlayer, playerToFormState };
