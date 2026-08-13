import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, TrendingDown, Calendar, ArrowUpDown, ArrowUpCircle, Edit2, Trash2, MoreHorizontal, ShieldAlert } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useUiChrome } from '../../context/UiChromeContext';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { useSwipeReveal } from '../../hooks/useSwipeReveal';
import { getCardStyle } from '../../utils/cardStyle';
import { parsePotentialRange } from '../../utils/format';
import PlayerForm from '../squad/PlayerForm';
import ConfirmModal from '../common/ConfirmModal';
import UpdateRatingModal from './UpdateRatingModal';
import PromoteToFirstTeamModal from './PromoteToFirstTeamModal';

const SORT_OPTIONS = [
  { id: 'potential-desc', label: 'Mayor Potencial', icon: TrendingUp },
  { id: 'potential-asc', label: 'Menor Potencial', icon: TrendingDown },
  { id: 'age-desc', label: 'Mayor Edad', icon: Calendar },
  { id: 'age-asc', label: 'Menor Edad', icon: Calendar },
];

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

function EvolutionTimeline({ history }) {
  if (!history || history.length === 0) return null;
  const ordered = [...history].sort((a, b) => b.date - a.date);
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {ordered.map((h, i) => (
        <span key={i} className="text-[8px] text-fg-faint font-black bg-well px-2 py-0.5 rounded">{new Date(h.date).toLocaleDateString('es-ES')}: {h.rating}</span>
      ))}
    </div>
  );
}

// Mismo gesto de deslizar y menú "..." que las filas de la Plantilla (PlayerList.jsx), pero
// simplificado: un canterano no participa del mercado, así que aquí solo hay Editar y Borrar
// (sin transferible/cedible/vender/ceder ni la opción "Más" intermedia en móvil).
function YouthPlayerRow({ p, onUpdate, onPromote, onEdit, onDelete }) {
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(() => onDelete(p.id), ROW_ACTION_WIDTH);
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
            <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div>
              <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest">{p.positions?.join(' · ')}</div>
              <PotentialBar rating={p.rating} potential={p.potential} />
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[8px] text-fg-faint font-black uppercase tracking-widest">{p.age} Años</span>
              {p.potential ? <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">Pot. {p.potential}</span> : null}
            </div>
          </div>

          <button ref={moreBtnDesktopRef} type="button" onClick={toggleMore} title="Más opciones" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-well-strong opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out md:group-hover:opacity-100 md:group-hover:pointer-events-auto touch-manipulation">
            <MoreHorizontal size={13} />
          </button>
        </div>

        <EvolutionTimeline history={p.evolutionHistory} />
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={() => onUpdate(p)} className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-black uppercase text-[10px] hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 border border-emerald-500/20 touch-manipulation"><TrendingUp size={14} /> Actualizar Media</button>
          <button type="button" onClick={() => onPromote(p)} className="flex-1 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 font-black uppercase text-[10px] hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 border border-blue-500/20 touch-manipulation"><ArrowUpCircle size={14} /> Subir al Primer Equipo</button>
        </div>

        {/* Umbral de borrado continuo (solo móvil), igual que en la Plantilla. */}
        {pastThreshold && (
          <div className="absolute inset-0 z-10 bg-red-500 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden">
            <Trash2 size={18} /> Borrar
          </div>
        )}
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
  const { hide: hideChrome, show: showChrome } = useUiChrome();
  const [updatingPlayer, setUpdatingPlayer] = useState(null);
  const [promotingPlayer, setPromotingPlayer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [sortOrder, setSortOrder] = useState('potential-desc');
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);
  useOnClickOutside(sortRef, () => setShowSort(false), showSort);

  // Pantalla limpia mientras cualquiera de los modales está abierto: oculta cabecera y
  // barra de navegación inferior, igual que hace PlayerForm en su wizard.
  useEffect(() => {
    if (!promotingPlayer) return;
    hideChrome();
    return () => showChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotingPlayer]);

  useEffect(() => {
    if (!updatingPlayer) return;
    hideChrome();
    return () => showChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatingPlayer]);

  // Para ordenar por Potencial se usa la media del rango (p.ej. "64-88" → 76) cuando el
  // canterano tiene un rango en vez de un número único, para no romper la ordenación.
  const getPotentialSortValue = (p) => parsePotentialRange(p.potential)?.sortValue ?? p.rating;

  const sortPlayers = (list) => {
    const sorted = [...list];
    if (sortOrder === 'potential-desc') sorted.sort((a, b) => getPotentialSortValue(b) - getPotentialSortValue(a));
    else if (sortOrder === 'potential-asc') sorted.sort((a, b) => getPotentialSortValue(a) - getPotentialSortValue(b));
    else if (sortOrder === 'age-desc') sorted.sort((a, b) => b.age - a.age);
    else if (sortOrder === 'age-asc') sorted.sort((a, b) => a.age - b.age);
    return sorted;
  };

  // Al promover con contrato (PromoteToFirstTeamModal), el jugador pasa a tipo "Comprado" y
  // deja de ser de Cantera, así que ya no hace falta distinguir aquí entre canteranos
  // convocados o no: la Academia es, simplemente, todo jugador de tipo "Cantera".
  const allYouth = players.filter((p) => p.type === 'Cantera');
  const sortedYouth = sortPlayers(allYouth);

  // Editar desde la Academia abre directamente el Paso 4, igual que desde la Plantilla.
  const openEditForm = (p) => { setEditingPlayer(p); setShowForm(true); };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center px-2 gap-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest min-w-0"><span className="truncate">{allYouth.length} Jugadores en la Academia</span></span>
        <div className="relative shrink-0" ref={sortRef}>
          <button type="button" onClick={() => setShowSort((o) => !o)} className={`h-8 w-8 flex items-center justify-center rounded-xl border transition-all ${showSort ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:text-fg'}`} title="Ordenar">
            <ArrowUpDown size={14} />
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setSortOrder(id); setShowSort(false); }} className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${sortOrder === id ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sortedYouth.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin jugadores en la academia</div>)}
        {sortedYouth.map((p) => (
          <YouthPlayerRow
            key={p.id} p={p}
            onUpdate={setUpdatingPlayer} onPromote={setPromotingPlayer}
            onEdit={openEditForm} onDelete={setPlayerToDelete}
          />
        ))}
      </div>

      {updatingPlayer && <UpdateRatingModal player={updatingPlayer} onClose={() => setUpdatingPlayer(null)} />}
      {promotingPlayer && <PromoteToFirstTeamModal player={promotingPlayer} onClose={() => setPromotingPlayer(null)} />}
      {showForm && <PlayerForm editingPlayer={editingPlayer} initialStep={4} onClose={() => setShowForm(false)} />}

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
