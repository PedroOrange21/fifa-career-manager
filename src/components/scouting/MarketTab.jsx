import { useEffect, useRef, useState } from 'react';
import { Plus, Edit2, UserPlus, ShieldAlert, Target, Search, SlidersHorizontal, X, MapPin, ChevronDown, ChevronUp, Check, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useClubs } from '../../context/ClubsContext';
import { ALL_POSITIONS } from '../../constants/positions';
import { getCardStyle } from '../../utils/cardStyle';
import { formatValueInput, abbreviateValue, formatCurrency } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import SwipeableRow from '../common/SwipeableRow';
import TargetForm, { STATUS_OPTIONS, STATUS_LABELS, STATUS_STYLE } from './TargetForm';
import ConfirmModal from '../common/ConfirmModal';

const STATUS_RANK = { Prioritario: 0, Negociando: 1, Seguimiento: 2, Descartado: 3 };
// Franja de color a la izquierda de la tarjeta: mismo código de color que STATUS_STYLE, para
// distinguir de un vistazo la prioridad sin necesitar un badge propio en la cabecera.
const STATUS_BORDER = {
  Seguimiento: 'border-l-border',
  Negociando: 'border-l-yellow-500',
  Prioritario: 'border-l-red-500',
  Descartado: 'border-l-border-subtle',
};

// Escritorio (ratón real): el texto se revela con :hover y un solo clic abre el formulario.
// Táctil: el primer toque despliega el texto (sin abrir) y el segundo lo confirma — mismo
// patrón que "Fichar Jugador" en la Plantilla (PlayerList.jsx).
const HAS_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const emptyFilters = { position: '', status: '', ageMin: '', ageMax: '', ratingMin: '', ratingMax: '' };

const positionsOf = (t) => t.positions || (t.primaryPosition ? [t.primaryPosition, ...(t.secondaryPositions || [])] : []);

// Idéntico a FinanceTab.jsx/FinanceStatsTab.jsx (duplicado a propósito, mismo patrón ya usado
// en el resto de la app): sueldo mensual que realmente carga al club, salvo cedidos fuera,
// donde solo pesa el % que asumimos.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return (p.wage || 0) * (pct / 100);
  }
  return p.wage || 0;
};

// Misma línea visual que las tarjetas de Plantilla (PlayerRow): badge de Media/Posición,
// nombre en italic uppercase junto a la bandera de nacionalidad, posición en verde debajo.
// Vista compacta por defecto (badge, identificación, posiciones, club/edad/estado); la
// flecha despliega el resto (economía, notas y acciones).
function TargetRow({ t, onSign, onEdit, onDelete, selected, onToggleSelect }) {
  const [expanded, setExpanded] = useState(false);
  const positions = positionsOf(t);

  // Editar y Borrar ya no viven como botones estáticos en la tarjeta: se accede a ellos
  // exclusivamente deslizando (izquierda = Editar, derecha = Borrar), mismo gestor
  // (SwipeableRow) que Plantilla, Academia y Operaciones.
  const swipeButtons = [
    { key: 'edit', icon: Edit2, label: 'Editar', onClick: () => onEdit(t) },
  ];

  return (
    <SwipeableRow onDelete={() => onDelete(t.id)} buttons={swipeButtons}>
      {({ rowRef, offset, dragging, close }) => (
        <div
          ref={rowRef}
          onClick={() => { if (offset !== 0) close(); }}
          style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
          className={`relative touch-pan-y border-l-4 transition-colors ${STATUS_BORDER[t.status] || STATUS_BORDER.Seguimiento}`}
        >
          {/* El tinte de selección (bg-green-500/5) es semitransparente a propósito, pero sin
              una base opaca detrás los botones de swipe (Editar/Borrar) se transparentaban por
              debajo de la tarjeta incluso en reposo. Se arregla con una capa base 100% opaca
              (bg-surface) y el tinte encima, en vez de aplicar el color directamente sobre el
              contenido — el contenido real también debe ser "relative" (no estático) para que
              pinte por encima de estas dos capas absolutas en vez de quedar detrás. */}
          <div className="absolute inset-0 bg-surface" />
          {selected && <div className="absolute inset-0 bg-green-500/5" />}
          <div className="relative p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-2.5">
            {/* Checkbox pequeño y sutil, como elemento propio de la fila (no superpuesto sobre la
                insignia) para que ambos convivan sin tocarse; el "gap" del contenedor ya separa
                limpiamente checkbox y badge. */}
            <button
              type="button"
              onClick={() => onToggleSelect(t.id)}
              title={selected ? 'Quitar de la selección' : 'Seleccionar para el planificador'}
              className={`mt-1.5 md:mt-2 w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all touch-manipulation ${selected ? 'bg-green-500 border-green-500' : 'border-border-subtle bg-well hover:border-green-500/50'}`}
            >
              {selected && <Check size={9} className="text-black" strokeWidth={3.5} />}
            </button>
            <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(t.rating || 0)}`}>
              <span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{t.primaryPosition || positions[0] || '—'}</span>
              <span className="text-lg md:text-xl">{t.rating || '—'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{t.name}</div>
              <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest truncate">{positions.join(' · ') || '—'}</div>
            </div>
            {/* Esquina superior derecha: Estado de seguimiento arriba, Edad justo debajo. */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${STATUS_STYLE[t.status] || STATUS_STYLE.Seguimiento}`}>{STATUS_LABELS[t.status] || STATUS_LABELS.Seguimiento}</span>
              {t.age ? <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{t.age} Años</span> : null}
            </div>
          </div>

          {/* Línea única y compacta: club actual, valor de mercado y salario. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {t.originClub && (
              <span className="flex items-center gap-1 text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-wide bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg truncate max-w-[140px]"><MapPin size={11} className="shrink-0" /> {t.originClub}</span>
            )}
            <span className="text-[9px] md:text-[10px] font-black text-fg-muted uppercase tracking-widest bg-well px-2 py-1 rounded-lg">{t.estimatedValue > 0 ? abbreviateValue(t.estimatedValue) : 'Sin Valor'}</span>
            <span className="text-[9px] md:text-[10px] font-black text-fg-muted uppercase tracking-widest bg-well px-2 py-1 rounded-lg">{t.wage > 0 ? `${abbreviateValue(t.wage)}/mes` : 'Sin Salario'}</span>
          </div>

          {/* Nota de seguimiento: solo visible al expandir, justo antes de las acciones. */}
          {expanded && (
            <div className="mt-2.5 bg-well/60 rounded-xl px-3 py-2 border border-border-subtle animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="text-[8px] font-black uppercase text-fg-faint tracking-widest mb-1">Nota de Seguimiento</div>
              <p className="text-xs text-fg-secondary italic">{t.notes || 'Sin notas registradas.'}</p>
            </div>
          )}

          <div className="flex gap-2 mt-2.5">
            <button onClick={() => onSign(t)} className="w-full py-2.5 rounded-xl bg-green-500/10 text-green-500 font-black uppercase text-[10px] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 border border-green-500/20"><UserPlus size={14} /> Fichar</button>
          </div>

          {/* Flecha de expandir: siempre al final de la tarjeta, debajo de las acciones. */}
          <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-well transition-colors text-[9px] font-black uppercase tracking-widest touch-manipulation">
            {expanded ? 'Menos Detalle' : 'Más Detalle'} <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
          </div>
        </div>
      )}
    </SwipeableRow>
  );
}

// Planificador de fichajes: calcula sobre la marcha el impacto económico de fichar a los
// objetivos marcados con el checkbox de cada tarjeta. Con 0 seleccionados no tiene sentido
// mostrar un desglose vacío, así que cae automáticamente a la vista "Todos los Objetivos"; en
// cuanto se marca el primero, salta a "Seleccionados" para que el resultado del cálculo sea
// inmediato — pero el usuario puede volver a pulsar "Todos" en cualquier momento para consultar
// el coste total de fichar a toda la lista sin perder su selección.
function BudgetPlannerCard({ targets, selectedIds }) {
  const { activeClub } = useClubs();
  const { players } = useClubData();
  const [view, setView] = useState('all');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hadSelectionRef = useRef(false);
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    if (hasSelection && !hadSelectionRef.current) setView('selected');
    if (!hasSelection) setView('all');
    hadSelectionRef.current = hasSelection;
  }, [hasSelection]);

  const switchView = (id) => {
    if (id === view) return;
    setShowBreakdown(false);
    setView(id);
  };

  const selectedTargets = targets.filter((t) => selectedIds.has(t.id));
  const activeTargets = view === 'selected' ? selectedTargets : targets;
  const totalTransfer = activeTargets.reduce((sum, t) => sum + (t.estimatedValue || 0), 0);
  const totalWageMonthly = activeTargets.reduce((sum, t) => sum + (t.wage || 0), 0);

  // Fondos disponibles del club: presupuesto de traspasos real, y margen salarial disponible
  // real (Presupuesto de Salarios − Masa Salarial Actual), ambos configurados/calculados en
  // Finanzas (ver FinanceTab.jsx). "hasWageBudget" distingue "el club nunca ha fijado un
  // límite salarial" (wageBudget == null) de haberlo fijado explícitamente a 0 — solo en el
  // primer caso se desactiva por completo el chequeo de exceso salarial, para no marcar
  // "Excede el margen salarial" falsamente cuando no hay ningún límite estricto definido.
  const transferBudget = activeClub?.transferBudget || 0;
  const currentWageBill = players.reduce((sum, p) => sum + getEffectiveWage(p), 0);
  const hasWageBudget = activeClub?.wageBudget != null;
  const wageMargin = (activeClub?.wageBudget || 0) - currentWageBill;
  const transferExcess = Math.max(0, totalTransfer - transferBudget);
  const wageExcess = hasWageBudget ? Math.max(0, totalWageMonthly - wageMargin) : 0;
  const isViable = transferExcess === 0 && wageExcess === 0;
  const hasCost = totalTransfer > 0 || totalWageMonthly > 0;

  return (
    <div className="w-full min-w-0 bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-1.5 truncate"><Wallet size={12} className="shrink-0" /> Planificador de Fichajes</span>
        {hasSelection && (
          <div className="flex bg-well p-0.5 rounded-lg border border-border-subtle shrink-0">
            <button type="button" onClick={() => switchView('selected')} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all touch-manipulation ${view === 'selected' ? 'bg-surface text-fg shadow-sm' : 'text-fg-faint hover:text-fg-secondary'}`}>Selec.</button>
            <button type="button" onClick={() => switchView('all')} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all touch-manipulation ${view === 'all' ? 'bg-surface text-fg shadow-sm' : 'text-fg-faint hover:text-fg-secondary'}`}>Todos</button>
          </div>
        )}
      </div>

      {/* Fondos disponibles del club: siempre visible, no depende de si hay selección. */}
      <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-border-subtle">
        <div className="min-w-0">
          <div className="text-xs md:text-sm font-black italic text-green-500 truncate">{formatCurrency(transferBudget)}</div>
          <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Presupuesto Traspasos</div>
        </div>
        <div className="min-w-0">
          {hasWageBudget ? (
            <div className={`text-xs md:text-sm font-black italic truncate ${wageMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(wageMargin)}/mes</div>
          ) : (
            <div className="text-xs md:text-sm font-black italic text-fg-faint truncate">Sin Límite</div>
          )}
          <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Margen Salarial Disp.</div>
        </div>
      </div>

      {targets.length === 0 ? (
        <p className="text-[10px] text-fg-faint font-bold">Sin objetivos todavía.</p>
      ) : !hasSelection && view === 'all' ? (
        <>
          <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mb-1.5">Selecciona objetivos para calcular el presupuesto necesario</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-xs md:text-sm font-black italic text-fg">{formatCurrency(totalTransfer)}</span>
            <span className="text-[9px] font-bold text-fg-muted">Traspasos · {targets.length} Objetivos</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
            <span className="text-[10px] font-black text-fg-secondary">{formatCurrency(totalWageMonthly)}/mes</span>
            <span className="text-[9px] font-bold text-fg-faint">| {formatCurrency(totalWageMonthly * 12)}/año</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mb-1.5">
            {view === 'selected' ? `${selectedTargets.length} Objetivo${selectedTargets.length === 1 ? '' : 's'} Seleccionado${selectedTargets.length === 1 ? '' : 's'}` : `Coste Total de la Lista · ${targets.length} Objetivos`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <div className="text-xs md:text-sm font-black italic text-fg truncate">{formatCurrency(totalTransfer)}</div>
              <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Traspaso Total</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs md:text-sm font-black italic text-fg truncate">{formatCurrency(totalWageMonthly)}/mes</div>
              <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">{formatCurrency(totalWageMonthly * 12)}/año</div>
            </div>
          </div>
        </>
      )}

      {/* Conclusión de viabilidad: compara el coste de la vista activa (seleccionados o
          todos) contra los fondos disponibles mostrados arriba. */}
      {hasCost && (
        <div className={`mt-3 p-2.5 rounded-xl border flex items-start gap-2 ${isViable ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          {isViable ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className={`text-[9px] font-black uppercase tracking-widest ${isViable ? 'text-green-500' : 'text-red-400'}`}>{isViable ? 'Viable' : 'No Viable'}</div>
            {isViable ? (
              <p className="text-[9px] font-bold text-fg-muted mt-0.5">Operación asumible con el presupuesto actual.</p>
            ) : (
              <div className="text-[9px] font-bold text-fg-muted mt-0.5 space-y-0.5">
                {transferExcess > 0 && <p>Excede el presupuesto de traspaso en {formatCurrency(transferExcess)}.</p>}
                {wageExcess > 0 && <p>Excede el margen salarial en {formatCurrency(wageExcess)}/mes.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flecha desplegable, mismo patrón interactivo que el Historial de Transacciones
          (FinanceTab.jsx): despliega/repliega un desglose jugador a jugador de los objetivos
          computados en la vista activa (seleccionados o todos). */}
      {targets.length > 0 && (
        <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="w-full flex items-center justify-between mt-3 pt-2.5 border-t border-border-subtle text-[9px] font-black uppercase tracking-widest text-fg-muted hover:text-fg transition-colors touch-manipulation">
          <span>{activeTargets.length} Jugador{activeTargets.length === 1 ? '' : 'es'} en el Desglose</span>
          {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {showBreakdown && (
        <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {activeTargets.length === 0 ? (
            <div className="py-4 text-center text-[9px] font-bold text-fg-faint uppercase tracking-widest">Sin objetivos en esta vista</div>
          ) : (
            <>
              {activeTargets.map((t) => (
                <div key={t.id} className="p-2.5 bg-well rounded-xl border border-border-subtle">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-fg truncate">{t.name}</span>
                    <span className="text-[8px] font-black text-fg-faint uppercase tracking-widest shrink-0">{t.primaryPosition || positionsOf(t)[0] || '—'} · {t.rating ?? '—'}</span>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 text-[9px]"><span className="font-bold text-fg-muted">Traspaso Estimado</span><span className="font-black text-fg-secondary">{t.estimatedValue > 0 ? formatCurrency(t.estimatedValue) : 'Sin Valor'}</span></div>
                    {/* Dos filas superpuestas (mes arriba, año abajo) en vez de un único valor
                        inline, mismo patrón que el resto de la app (p. ej. Ficha Salarial
                        Pactada en Estadísticas). */}
                    <div className="flex items-start justify-between gap-2 text-[9px]">
                      <span className="font-bold text-fg-muted pt-px">Sueldo Estimado</span>
                      {t.wage > 0 ? (
                        <span className="text-right leading-tight shrink-0">
                          <span className="block font-black text-fg-secondary">{formatCurrency(t.wage)}/mes</span>
                          <span className="block font-bold text-fg-faint text-[8px] mt-0.5">{formatCurrency(t.wage * 12)}/año</span>
                        </span>
                      ) : (
                        <span className="font-black text-fg-secondary">Sin Salario</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* Fila resumen: mismos totales que ya muestra la cabecera de la tarjeta, pero
                  repetidos aquí al cierre del desglose para que quede claro qué representa la
                  suma de todas las filas anteriores. */}
              <div className="p-2.5 bg-well-strong rounded-xl border border-border-subtle">
                <div className="flex items-center justify-between gap-2 text-[9px]"><span className="font-black uppercase tracking-widest text-fg-secondary">Total Traspasos</span><span className="font-black text-fg">{formatCurrency(totalTransfer)}</span></div>
                <div className="flex items-start justify-between gap-2 text-[9px] mt-1">
                  <span className="font-black uppercase tracking-widest text-fg-secondary pt-px">Total Masa Salarial</span>
                  <span className="text-right leading-tight shrink-0">
                    <span className="block font-black text-fg">{formatCurrency(totalWageMonthly)}/mes</span>
                    <span className="block font-bold text-fg-faint text-[8px] mt-0.5">{formatCurrency(totalWageMonthly * 12)}/año</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketTab({ onSignTarget }) {
  const { targets, targetToDelete, setTargetToDelete, confirmDeleteTarget } = useClubData();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const filtersRef = useRef(null);
  useOnClickOutside(filtersRef, () => setShowFilters(false), showFilters);
  const [addConfirming, setAddConfirming] = useState(false);
  const addRef = useRef(null);
  useOnClickOutside(addRef, () => setAddConfirming(false), addConfirming);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filtered = targets
    .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => !filters.position || positionsOf(t).includes(filters.position))
    .filter((t) => !filters.status || (t.status || 'Seguimiento') === filters.status)
    .filter((t) => !filters.ageMin || (t.age || 0) >= Number(filters.ageMin))
    .filter((t) => !filters.ageMax || (t.age || 0) <= Number(filters.ageMax))
    .filter((t) => !filters.ratingMin || (t.rating || 0) >= Number(filters.ratingMin))
    .filter((t) => !filters.ratingMax || (t.rating || 0) <= Number(filters.ratingMax));

  const sorted = [...filtered].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2);
    if (rank !== 0) return rank;
    return (b.rating || 0) - (a.rating || 0);
  });

  const openNewForm = () => { setEditingTarget(null); setShowForm(true); };
  const openEditForm = (t) => { setEditingTarget(t); setShowForm(true); };

  const handleAddClick = () => {
    if (HAS_HOVER) { openNewForm(); return; }
    if (addConfirming) { openNewForm(); setAddConfirming(false); }
    else { setAddConfirming(true); }
  };

  const signTarget = (t) => {
    onSignTarget({
      photo: t.photo || '',
      name: t.name,
      nationality: t.nationality || '',
      positions: positionsOf(t),
      preferredFoot: t.preferredFoot || 'Diestro',
      age: t.age ? String(t.age) : '',
      rating: t.rating ? String(t.rating) : '',
      marketValue: formatValueInput(String(t.estimatedValue || '')),
      wage: formatValueInput(String(t.wage || '')),
      type: 'Comprado',
      value: '',
      originClub: t.originClub || '',
    }, t.id);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" size={14} />
          <input type="text" placeholder="Buscar objetivo..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div ref={addRef} className="group/fichar shrink-0">
          <button type="button" onClick={handleAddClick} title="Añadir Objetivo" className={`flex items-center h-9 pl-3 pr-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-500/20 transition-colors duration-300 active:scale-95 ${addConfirming ? 'bg-green-400 text-black' : 'bg-green-500 text-black hover:bg-green-400'}`}>
            <Plus size={14} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${addConfirming ? 'max-w-[160px] ml-1.5' : 'max-w-0 ml-0 group-hover/fichar:max-w-[160px] group-hover/fichar:ml-1.5'}`}>
              Añadir Nuevo Objetivo
            </span>
          </button>
        </div>
        <div className="relative shrink-0" ref={filtersRef}>
          <button onClick={() => setShowFilters((o) => !o)} className={`h-9 px-3 flex items-center gap-1.5 rounded-xl border transition-all ${activeFilterCount > 0 ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:text-fg'}`} title="Filtros">
            <SlidersHorizontal size={14} /> {activeFilterCount > 0 && <span className="text-[9px] font-black">{activeFilterCount}</span>}
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-fg-faint">Filtros</span>
                {activeFilterCount > 0 && <button onClick={() => setFilters(emptyFilters)} className="text-[9px] font-black uppercase text-red-400 flex items-center gap-1"><X size={11} /> Limpiar</button>}
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Posición</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_POSITIONS.map((pos) => (
                    <button key={pos} onClick={() => setFilters((f) => ({ ...f, position: f.position === pos ? '' : pos }))} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${filters.position === pos ? 'bg-green-500 text-black' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Estado</span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => setFilters((f) => ({ ...f, status: f.status === s ? '' : s }))} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${filters.status === s ? STATUS_STYLE[s] : 'bg-well-strong text-fg-muted border-border-subtle'}`}>{STATUS_LABELS[s]}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Edad</span>
                  <div className="flex items-center gap-1">
                    <input type="number" placeholder="Mín" className="w-full h-8 bg-well-strong rounded-lg text-center text-[10px] font-bold outline-none border border-border-subtle" value={filters.ageMin} onChange={(e) => setFilters((f) => ({ ...f, ageMin: e.target.value }))} />
                    <input type="number" placeholder="Máx" className="w-full h-8 bg-well-strong rounded-lg text-center text-[10px] font-bold outline-none border border-border-subtle" value={filters.ageMax} onChange={(e) => setFilters((f) => ({ ...f, ageMax: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-fg-faint ml-0.5">Media</span>
                  <div className="flex items-center gap-1">
                    <input type="number" placeholder="Mín" className="w-full h-8 bg-well-strong rounded-lg text-center text-[10px] font-bold outline-none border border-border-subtle" value={filters.ratingMin} onChange={(e) => setFilters((f) => ({ ...f, ratingMin: e.target.value }))} />
                    <input type="number" placeholder="Máx" className="w-full h-8 bg-well-strong rounded-lg text-center text-[10px] font-bold outline-none border border-border-subtle" value={filters.ratingMax} onChange={(e) => setFilters((f) => ({ ...f, ratingMax: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest flex items-center gap-2"><Target size={14} /> {sorted.length} Objetivos en Seguimiento</span>
      </div>

      {/* "Añadir Objetivo" ya vive en la barra superior (junto a la búsqueda, animado igual
          que "Fichar Jugador" en Plantilla), así que el planificador ocupa su propia fila
          completa. */}
      <BudgetPlannerCard targets={targets} selectedIds={selectedIds} />

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sorted.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">{targets.length === 0 ? 'Sin Objetivos Todavía' : 'Sin Resultados'}</div>)}
        {sorted.map((t) => (
          <TargetRow key={t.id} t={t} onSign={signTarget} onEdit={openEditForm} onDelete={setTargetToDelete} selected={selectedIds.has(t.id)} onToggleSelect={toggleSelect} />
        ))}
      </div>

      {showForm && <TargetForm editingTarget={editingTarget} onClose={() => setShowForm(false)} />}

      {targetToDelete && (
        <ConfirmModal
          icon={ShieldAlert}
          title="¿Eliminar Objetivo?"
          message="Se eliminará esta ficha de la lista de seguimiento."
          onCancel={() => setTargetToDelete(null)}
          onConfirm={confirmDeleteTarget}
        />
      )}
    </div>
  );
}
