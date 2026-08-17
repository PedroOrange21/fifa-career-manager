import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, Calendar, ArrowUpDown, ArrowUp, ArrowDown, ArrowUpCircle, Edit2, Trash2, MoreHorizontal, ShieldAlert, Star, ArrowDownAZ, LayoutGrid, Plus, Search, Info, X } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { useSwipeReveal } from '../../hooks/useSwipeReveal';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { getCardStyle } from '../../utils/cardStyle';
import { parsePotentialRange } from '../../utils/format';
import { ALL_POSITIONS } from '../../constants/positions';
import PlayerForm from '../squad/PlayerForm';
import PlayerInfoModal from '../squad/PlayerInfoModal';
import ConfirmModal from '../common/ConfirmModal';
import UpdateRatingModal from './UpdateRatingModal';
import PromoteToFirstTeamModal from './PromoteToFirstTeamModal';

// Escritorio (ratón real): el texto se revela con :hover y un solo clic abre el formulario.
// Táctil: el primer toque despliega el texto (sin abrir) y el segundo lo confirma — mismo
// patrón que el botón "Fichar Jugador" de la Plantilla.
const HAS_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Grupo superior con botones mayor/menor: Potencial, Media, Valor y Edad.
// Grupo inferior sin dirección (opción única en lista): Nombre y Posición.
const SORT_GROUPS = [
  { label: 'Potencial', descId: 'potential-desc', ascId: 'potential-asc', icon: TrendingUp },
  { label: 'Media', descId: 'rating-desc', ascId: 'rating-asc', icon: Star },
  { label: 'Edad', descId: 'age-desc', ascId: 'age-asc', icon: Calendar },
];

const SORT_OPTIONS = [
  { id: 'position-asc', label: 'Posición en el Campo', icon: LayoutGrid },
];

// Código de color de la badge de potencial, estilo EA FC: clasifica al canterano según el
// techo máximo de su rango de proyección (p. ej. "82-90" -> 90; con un valor único, ese mismo
// número), la misma cifra que ya usa PotentialBar para la barra de progreso. PROJECTION_STYLES
// es la única fuente de verdad de los 4 estilos — tanto la badge real de cada tarjeta como la
// tabla del modal "Más info" (ver POTENTIAL_INFO_TIERS) leen de aquí, así que no pueden
// desincronizarse entre sí.
const PROJECTION_STYLES = {
  gold: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  blue: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  gray: 'text-fg-muted bg-well-strong border-border-subtle',
};
function getPotentialTier(maxPotential) {
  if (maxPotential == null) return 'gray';
  if (maxPotential >= 90) return 'gold';
  if (maxPotential >= 85) return 'blue';
  if (maxPotential >= 80) return 'yellow';
  return 'gray';
}
function getProjectionTier(p) {
  const parsed = parsePotentialRange(p.potential);
  return getPotentialTier(parsed?.max ?? null);
}

// Orden táctico natural en el terreno de juego (Portero → Defensas → Centrocampistas →
// Delanteros), mismo criterio que ALL_POSITIONS ya usa en la Plantilla.
const getPositionOrder = (p) => {
  const idx = ALL_POSITIONS.indexOf(p.positions?.[0]);
  return idx === -1 ? ALL_POSITIONS.length : idx;
};

// Ancho del panel de swipe con solo 2 botones (Borrar/Editar, sin "Más"): 2×64px.
const ROW_ACTION_WIDTH = 128;

function PotentialBar({ rating, potential }) {
  // Con un rango ("64-88") la barra apunta al techo superior del rango, no a la media: es la
  // lectura más intuitiva de "cuánto le queda por crecer como máximo".
  const ceiling = parsePotentialRange(potential)?.max;
  if (!ceiling || ceiling <= rating) return null;
  const pct = Math.max(0, Math.min(100, ((rating - 40) / (ceiling - 40)) * 100));
  return (
    <div className="w-full h-1.5 bg-well-strong rounded-full overflow-hidden mt-2">
      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Referencia "tier" (clave de PROJECTION_STYLES) explícita en cada fila: la tabla del modal
// pinta cada rango con `PROJECTION_STYLES[tier]`, exactamente el mismo objeto que usa la badge
// real de la tarjeta (getProjectionTier), así que ambas vistas quedan literalmente enlazadas al
// mismo estilo — es imposible que se desincronicen entre sí.
const POTENTIAL_INFO_TIERS = [
  { tier: 'gold', range: '90 - 99', label: 'Oro / Verde Brillante', desc: 'Tiene potencial para ser especial: futura estrella mundial.' },
  { tier: 'blue', range: '85 - 89', label: 'Azul / Verde Azulado', desc: 'Un gran potencial: jugador de primer nivel.' },
  { tier: 'yellow', range: '80 - 84', label: 'Amarillo / Naranja', desc: 'Mostrando gran potencial: buen jugador de rotación o titular.' },
  { tier: 'gray', range: '< 80', label: 'Gris / Neutro', desc: 'En desarrollo, sin rango de potencial destacado.' },
];

// Popover explicativo del criterio de color del potencial: el techo de proyección que da el
// ojeador (rango tipo "64-88" -> 88, o un valor único) sitúa al canterano en una de estas 4
// franjas (ver getPotentialTier más arriba), y esas mismas franjas son las que pinta la badge
// real de cada tarjeta.
function PotentialInfoModal({ onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-border w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] p-5 md:p-6 max-h-[85dvh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-black italic uppercase text-fg flex items-center gap-2 text-sm"><Info size={16} className="text-emerald-500" /> Rangos de Potencial</h3>
          <button type="button" onClick={onClose} className="p-1.5 -mr-1.5 text-fg-faint hover:text-fg transition-colors touch-manipulation"><X size={18} /></button>
        </div>
        <p className="text-[10px] text-fg-muted font-bold leading-relaxed mb-4">El color se determina según el techo máximo del rango de proyección que estima el ojeador para el canterano.</p>
        <div className="space-y-2">
          {POTENTIAL_INFO_TIERS.map((tier) => (
            <div key={tier.range} className="flex items-center gap-3 p-3 rounded-xl bg-well border border-border-subtle">
              <span className={`shrink-0 w-14 text-center text-[10px] font-black py-1.5 rounded-lg border ${PROJECTION_STYLES[tier.tier]}`}>{tier.range}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-fg">{tier.label}</div>
                <div className="text-[10px] text-fg-muted font-bold leading-snug mt-0.5">{tier.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-fg-faint font-bold leading-relaxed mt-4 pt-3 border-t border-border-subtle">Si el canterano todavía no tiene un rango de potencial asignado, o su techo máximo es inferior a 80, la badge se muestra en gris neutro.</p>
      </div>
    </div>
  );
}

// Mismo gesto de deslizar y menú "..." que las filas de la Plantilla (PlayerList.jsx), pero
// simplificado: un canterano no participa del mercado, así que aquí solo hay Editar y Borrar
// (sin transferible/cedible/vender/ceder ni la opción "Más" intermedia en móvil).
function YouthPlayerRow({ p, onUpdate, onPromote, onEdit, onDelete, onViewDetail, onShowPotentialInfo }) {
  const { rowRef, offset, dragging, deleteProgress, close } = useSwipeReveal(() => onDelete(p.id), ROW_ACTION_WIDTH);
  const [showMore, setShowMore] = useState(false);
  const [moreRect, setMoreRect] = useState(null);
  const moreBtnDesktopRef = useRef(null);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => {
      if (moreBtnDesktopRef.current?.contains(e.target)) return;
      if (moreMenuRef.current?.contains(e.target)) return;
      setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showMore]);

  const toggleMore = (e) => {
    if (showMore) { setShowMore(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 200 });
    setShowMore(true);
  };

  const MORE_ACTIONS = [
    { key: 'edit', icon: Edit2, label: 'Editar Jugador', onClick: () => onEdit(p) },
    { key: 'delete', icon: Trash2, label: 'Borrar Jugador', onClick: () => onDelete(p.id) },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Panel de swipe: solo en móvil (sm:hidden), solo Borrar y Editar. */}
      <div className="absolute inset-y-0 right-0 flex sm:hidden">
        <button type="button" onClick={() => { onDelete(p.id); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:bg-red-400 touch-manipulation">
          <Trash2 size={18} />
          <span className="text-[8px] font-black uppercase">Borrar</span>
        </button>
        <button type="button" onClick={() => { onEdit(p); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-well text-fg-muted active:bg-well-strong touch-manipulation">
          <Edit2 size={18} />
          <span className="text-[8px] font-black uppercase">Editar</span>
        </button>
      </div>

      <div
        ref={rowRef}
        onClick={() => { if (offset < 0) close(); }}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        className="relative bg-surface p-3 md:p-4 flex flex-col gap-2 touch-pan-y group"
      >
        {/* Franja de identidad (avatar + info): se desplaza a la derecha al hacer hover en
            escritorio (mismo patrón que PlayerRow) para revelar el "..." fijo a la izquierda,
            oculto detrás en reposo. El resto de la tarjeta (evolución + botones) no se mueve. */}
        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="relative flex items-center gap-3 md:gap-4 flex-1 min-w-0 md:transition-transform md:duration-300 md:ease-in-out md:group-hover:translate-x-11">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (offset < 0) { close(); return; } onViewDetail?.(p); }}
              className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 touch-manipulation active:scale-95 transition-transform ${getCardStyle(p.rating)}`}
            >
              <span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div>
              <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest">{p.positions?.join(' · ')}</div>
              <PotentialBar rating={p.rating} potential={p.potential} />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[8px] text-fg-faint font-black uppercase tracking-widest">{p.age} Años</span>
              {p.potential ? (
                <>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${PROJECTION_STYLES[getProjectionTier(p)]}`}>Pot. {p.potential}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onShowPotentialInfo?.(); }} className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-fg-faint hover:text-fg-secondary transition-colors touch-manipulation">
                    <Info size={8} className="shrink-0" /> Más Info
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <button ref={moreBtnDesktopRef} type="button" onClick={toggleMore} title="Más opciones" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-well-strong opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out md:group-hover:opacity-100 md:group-hover:pointer-events-auto touch-manipulation">
            <MoreHorizontal size={13} />
          </button>
        </div>

        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => onUpdate(p)} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-black uppercase text-[10px] hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 border border-emerald-500/20 touch-manipulation"><TrendingUp size={14} /> Actualizar Media</button>
          <button type="button" onClick={() => onPromote(p)} className="flex-1 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 font-black uppercase text-[10px] hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 border border-blue-500/20 touch-manipulation"><ArrowUpCircle size={14} /> Subir al Primer Equipo</button>
        </div>

        {/* Umbral de borrado continuo (solo móvil), igual que en la Plantilla: el rótulo rojo
            se expande suavemente (deleteProgress) en vez de aparecer de golpe. */}
        <div className="absolute inset-y-0 right-0 z-10 bg-red-500 sm:hidden pointer-events-none" style={{ width: `${deleteProgress * 100}%`, transition: dragging ? 'none' : 'width 200ms ease-out' }} />
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden pointer-events-none" style={{ opacity: deleteProgress, transition: dragging ? 'none' : 'opacity 200ms ease-out' }}>
          <Trash2 size={18} /> Borrar
        </div>
      </div>

      {/* Menú "...": mismo patrón de portal que en la Plantilla, simplificado a solo
          Editar/Borrar (sin acciones de mercado, no aplicables a un canterano). */}
      {showMore && moreRect && createPortal(
        <div
          ref={moreMenuRef}
          style={{ position: 'fixed', top: moreRect.top, right: moreRect.right, width: moreRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {MORE_ACTIONS.map(({ key, icon: Icon, label, onClick }) => (
            <button key={key} type="button" onClick={() => { onClick(); setShowMore(false); close(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all touch-manipulation text-fg-secondary hover:bg-well">
              <Icon size={14} className="shrink-0" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function AcademyTab() {
  const { players, playerToDelete, setPlayerToDelete, confirmDeletePlayer } = useClubData();
  const [updatingPlayer, setUpdatingPlayer] = useState(null);
  const [promotingPlayer, setPromotingPlayer] = useState(null);
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null);
  const [showPotentialInfo, setShowPotentialInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [formPrefill, setFormPrefill] = useState(null);
  const [formInitialStep, setFormInitialStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('potential-desc');
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);
  useOnClickOutside(sortRef, () => setShowSort(false), showSort);
  const [ficharConfirming, setFicharConfirming] = useState(false);
  const ficharRef = useRef(null);
  useOnClickOutside(ficharRef, () => setFicharConfirming(false), ficharConfirming);

  // Cada modal (PromoteToFirstTeamModal, UpdateRatingModal, PlayerForm) oculta la cabecera y
  // la barra de navegación por sí mismo (useAutoHideChrome), así que aquí ya no hace falta
  // gestionarlo desde el padre.

  // Para ordenar por Potencial se usa la media del rango (p.ej. "64-88" → 76) cuando el
  // canterano tiene un rango en vez de un número único, para no romper la ordenación.
  const getPotentialSortValue = (p) => parsePotentialRange(p.potential)?.sortValue ?? p.rating;

  const sortPlayers = (list) => {
    const sorted = [...list];
    if (sortOrder === 'potential-desc') sorted.sort((a, b) => getPotentialSortValue(b) - getPotentialSortValue(a));
    else if (sortOrder === 'potential-asc') sorted.sort((a, b) => getPotentialSortValue(a) - getPotentialSortValue(b));
    else if (sortOrder === 'rating-desc') sorted.sort((a, b) => b.rating - a.rating);
    else if (sortOrder === 'rating-asc') sorted.sort((a, b) => a.rating - b.rating);
    else if (sortOrder === 'age-desc') sorted.sort((a, b) => b.age - a.age);
    else if (sortOrder === 'age-asc') sorted.sort((a, b) => a.age - b.age);
    else if (sortOrder === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === 'name-desc') sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortOrder === 'position-asc') sorted.sort((a, b) => getPositionOrder(a) - getPositionOrder(b));
    return sorted;
  };

  // Al promover con contrato (PromoteToFirstTeamModal), el jugador pasa a tipo "Comprado" y
  // deja de ser de Cantera, así que ya no hace falta distinguir aquí entre canteranos
  // convocados o no: la Academia es, simplemente, todo jugador de tipo "Cantera".
  const allYouth = players.filter((p) => p.type === 'Cantera' && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedYouth = sortPlayers(allYouth);

  // Editar desde la Academia abre directamente el Paso 4, igual que desde la Plantilla.
  const openEditForm = (p) => { setEditingPlayer(p); setFormPrefill(null); setFormInitialStep(4); setShowForm(true); };
  // Fichar nuevo canterano: mismo asistente que "Fichar Jugador" de la Plantilla, pero con el
  // Tipo de Adquisición bloqueado en "Cantera" — un canterano no tiene sección de Economía
  // (ni sueldo, ni cláusula, ni costes), así que el Paso de Términos Económicos se salta por
  // completo, tanto al fichar como al editar.
  const openNewForm = () => { setEditingPlayer(null); setFormPrefill({ type: 'Cantera' }); setFormInitialStep(1); setShowForm(true); };

  const handleFicharClick = () => {
    if (HAS_HOVER) { openNewForm(); return; }
    if (ficharConfirming) { openNewForm(); setFicharConfirming(false); }
    else { setFicharConfirming(true); }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" size={14} />
          <input type="text" placeholder="Buscar canterano..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div ref={ficharRef} className="group/fichar shrink-0">
          <button type="button" onClick={handleFicharClick} title="Fichar Canterano" className={`flex items-center h-9 pl-3 pr-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-500/20 transition-colors duration-300 active:scale-95 ${ficharConfirming ? 'bg-green-400 text-black' : 'bg-green-500 text-black hover:bg-green-400'}`}>
            <Plus size={14} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${ficharConfirming ? 'max-w-[120px] ml-1.5' : 'max-w-0 ml-0 group-hover/fichar:max-w-[120px] group-hover/fichar:ml-1.5'}`}>
              Fichar Canterano
            </span>
          </button>
        </div>
        <div className="relative shrink-0" ref={sortRef}>
          <button onClick={() => setShowSort((o) => !o)} className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all ${showSort ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:text-fg'}`} title="Ordenar">
            <ArrowUpDown size={16} />
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5">
              {SORT_GROUPS.map(({ label, descId, ascId, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl">
                  <span className="flex items-center gap-2 text-xs font-bold text-fg-secondary"><Icon size={14} className="shrink-0" /> {label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => { setSortOrder(descId); setShowSort(false); }} title="Mayor a menor" className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${sortOrder === descId ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => { setSortOrder(ascId); setShowSort(false); }} title="Menor a mayor" className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${sortOrder === ascId ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {/* Fila de Nombre: mismos botones compactos que los grupos mayor/menor de arriba,
                  pero con etiquetas A-Z/Z-A en vez de flechas (más claras para orden alfabético). */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl">
                <span className="flex items-center gap-2 text-xs font-bold text-fg-secondary"><ArrowDownAZ size={14} className="shrink-0" /> Nombre</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => { setSortOrder('name-asc'); setShowSort(false); }} title="A-Z" className={`px-2 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${sortOrder === 'name-asc' ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                    A-Z
                  </button>
                  <button type="button" onClick={() => { setSortOrder('name-desc'); setShowSort(false); }} title="Z-A" className={`px-2 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${sortOrder === 'name-desc' ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                    Z-A
                  </button>
                </div>
              </div>
              <div className="h-px bg-border-subtle my-1 mx-1" />
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setSortOrder(id); setShowSort(false); }} className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all ${sortOrder === id ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest min-w-0"><span className="truncate">{allYouth.length} Jugadores en la Academia</span></span>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sortedYouth.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">{searchQuery ? 'No se encontraron canteranos' : 'Sin jugadores en la academia'}</div>)}
        {sortedYouth.map((p) => (
          <YouthPlayerRow
            key={p.id} p={p}
            onUpdate={setUpdatingPlayer} onPromote={setPromotingPlayer}
            onEdit={openEditForm} onDelete={setPlayerToDelete}
            onViewDetail={setSelectedPlayerInfo}
            onShowPotentialInfo={() => setShowPotentialInfo(true)}
          />
        ))}
      </div>

      {showPotentialInfo && <PotentialInfoModal onClose={() => setShowPotentialInfo(false)} />}
      {updatingPlayer && <UpdateRatingModal player={updatingPlayer} onClose={() => setUpdatingPlayer(null)} />}
      {promotingPlayer && <PromoteToFirstTeamModal player={promotingPlayer} onClose={() => setPromotingPlayer(null)} />}
      {showForm && <PlayerForm editingPlayer={editingPlayer} prefill={formPrefill} initialStep={formInitialStep} lockedType="Cantera" onClose={() => setShowForm(false)} />}
      {selectedPlayerInfo && (
        <PlayerInfoModal
          player={selectedPlayerInfo}
          onClose={() => setSelectedPlayerInfo(null)}
          onEdit={(p) => { setSelectedPlayerInfo(null); openEditForm(p); }}
          hideTacticsActions
        />
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
    </div>
  );
}
