import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Shirt, Users, ArrowRightLeft, Tag, ShieldAlert, ArrowUpDown, Star, DollarSign, Calendar, ArrowDownAZ } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue, formatLoanDuration } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import PlayerForm from './PlayerForm';
import ConfirmModal from '../common/ConfirmModal';

// Escritorio (ratón real): el texto se revela con :hover y un solo clic abre el formulario.
// Táctil: el primer toque despliega el texto (sin abrir) y el segundo lo confirma, igual que
// los botones "Vaciar" de la pizarra táctica.
const HAS_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const SORT_OPTIONS = [
  { id: 'rating-desc', label: 'Mayor Media', icon: Star },
  { id: 'rating-asc', label: 'Menor Media', icon: Star },
  { id: 'value-desc', label: 'Mayor Valor', icon: DollarSign },
  { id: 'value-asc', label: 'Menor Valor', icon: DollarSign },
  { id: 'age-desc', label: 'Mayor Edad', icon: Calendar },
  { id: 'age-asc', label: 'Menor Edad', icon: Calendar },
  { id: 'name-asc', label: 'Nombre (A-Z)', icon: ArrowDownAZ },
  { id: 'status-role', label: 'Rol en Equipo', icon: Shirt },
];

export default function PlayerList({ pendingEditPlayer, onConsumePendingEdit, pendingPrefill, onConsumePendingPrefill }) {
  const { players, lineup, bench, playerToDelete, setPlayerToDelete, confirmDeletePlayer } = useClubData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('rating-desc');
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [formPrefill, setFormPrefill] = useState(null);
  const [formSourceScoutId, setFormSourceScoutId] = useState(null);
  const [formInitialStep, setFormInitialStep] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);
  useOnClickOutside(sortMenuRef, () => setShowSortMenu(false), showSortMenu);
  const [ficharConfirming, setFicharConfirming] = useState(false);
  const ficharRef = useRef(null);
  useOnClickOutside(ficharRef, () => setFicharConfirming(false), ficharConfirming);

  useEffect(() => {
    if (pendingEditPlayer) {
      setEditingPlayer(pendingEditPlayer);
      setFormPrefill(null);
      setFormSourceScoutId(null);
      setFormInitialStep(4);
      setShowForm(true);
      onConsumePendingEdit();
    }
  }, [pendingEditPlayer, onConsumePendingEdit]);

  useEffect(() => {
    if (pendingPrefill) {
      const { __scoutId, ...rest } = pendingPrefill;
      setEditingPlayer(null);
      setFormPrefill(rest);
      setFormSourceScoutId(__scoutId || null);
      setFormInitialStep(1);
      setShowForm(true);
      onConsumePendingPrefill();
    }
  }, [pendingPrefill, onConsumePendingPrefill]);

  let filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  if (filterType === 'rating-desc') filteredPlayers.sort((a, b) => b.rating - a.rating);
  if (filterType === 'rating-asc') filteredPlayers.sort((a, b) => a.rating - b.rating);
  if (filterType === 'value-desc') filteredPlayers.sort((a, b) => (b.marketValue || b.value || 0) - (a.marketValue || a.value || 0));
  if (filterType === 'value-asc') filteredPlayers.sort((a, b) => (a.marketValue || a.value || 0) - (b.marketValue || b.value || 0));
  if (filterType === 'age-desc') filteredPlayers.sort((a, b) => b.age - a.age);
  if (filterType === 'age-asc') filteredPlayers.sort((a, b) => a.age - b.age);
  if (filterType === 'name-asc') filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
  if (filterType === 'status-role') {
    const getRoleScore = (p) => {
      if (Object.values(lineup).includes(p.id)) return 1; // Titular
      if (Object.values(bench).includes(p.id)) return 2; // Banquillo
      if (p.transferStatus === 'Cedible') return 4; // Cedible
      if (p.transferStatus === 'Transferible') return 5; // Venta
      return 3; // No convocados / Reserva
    };
    filteredPlayers.sort((a, b) => {
      const scoreA = getRoleScore(a); const scoreB = getRoleScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB; return b.rating - a.rating;
    });
  }

  const activePlayers = filteredPlayers.filter((p) => p.transferStatus !== 'CedidoFuera');
  const loanedOutPlayers = filteredPlayers.filter((p) => p.transferStatus === 'CedidoFuera');

  const openNewForm = () => { setEditingPlayer(null); setFormPrefill(null); setFormSourceScoutId(null); setFormInitialStep(1); setShowForm(true); };
  // Editar desde la lista (activos o cedidos) abre directamente el Paso 4 con los datos
  // precargados, sin pasar por el asistente paso a paso.
  const openEditForm = (p) => { setEditingPlayer(p); setFormPrefill(null); setFormSourceScoutId(null); setFormInitialStep(4); setShowForm(true); };

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
          <input type="text" placeholder="Buscar jugador..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div ref={ficharRef} className="group/fichar shrink-0">
          <button type="button" onClick={handleFicharClick} title="Fichar Jugador" className={`flex items-center h-9 pl-3 pr-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-500/20 transition-colors duration-300 active:scale-95 ${ficharConfirming ? 'bg-green-400 text-black' : 'bg-green-500 text-black hover:bg-green-400'}`}>
            <Plus size={14} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${ficharConfirming ? 'max-w-[120px] ml-1.5' : 'max-w-0 ml-0 group-hover/fichar:max-w-[120px] group-hover/fichar:ml-1.5'}`}>
              Fichar Jugador
            </span>
          </button>
        </div>
        <div className="relative shrink-0" ref={sortMenuRef}>
          <button onClick={() => setShowSortMenu((o) => !o)} className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all ${showSortMenu ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:text-fg'}`} title="Ordenar">
            <ArrowUpDown size={16} />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setFilterType(id); setShowSortMenu(false); }} className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all ${filterType === id ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest">{activePlayers.length} Jugadores Activos</span>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {activePlayers.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">{searchQuery ? 'No se encontraron jugadores' : 'Plantilla Vacía'}</div>)}
        {activePlayers.map((p) => (
          <PlayerRow key={p.id} p={p} lineup={lineup} bench={bench} onEdit={openEditForm} onDelete={setPlayerToDelete} />
        ))}
      </div>

      {loanedOutPlayers.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border space-y-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300">
          <div className="px-2 flex items-center gap-2 text-zinc-400"><ArrowRightLeft size={14} /><h3 className="text-xs font-black uppercase tracking-widest italic">Jugadores Cedidos a otros Clubes</h3></div>
          <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
            {loanedOutPlayers.map((p) => (
              <LoanedPlayerRow key={p.id} p={p} onEdit={() => openEditForm(p)} onDelete={() => setPlayerToDelete(p.id)} />
            ))}
          </div>
        </div>
      )}

      {showForm && <PlayerForm editingPlayer={editingPlayer} prefill={formPrefill} sourceScoutId={formSourceScoutId} initialStep={formInitialStep} onClose={() => setShowForm(false)} />}

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

const SWIPE_ACTION_WIDTH = 128;

// Gesto de deslizar compartido por las filas de la Plantilla (activas y cedidas). Usa un
// listener nativo de touchmove con { passive: false } porque React registra los onTouchMove
// sintéticos como pasivos por defecto y no deja llamar a preventDefault() desde la prop JSX
// (necesario aquí para bloquear el scroll vertical de la lista mientras se arrastra en
// horizontal). El eje del gesto (horizontal vs vertical) se decide en los primeros píxeles
// de movimiento y ya no cambia durante ese mismo toque.
//
// Deslizamiento corto: deja la fila abierta (revela Editar/Eliminar). Deslizamiento largo
// y continuo — más de la mitad del ancho de la propia fila (equivalente a la mitad de la
// pantalla en esta lista a ancho completo) — tiñe toda la franja de rojo con "Borrar" en
// tiempo real; si se suelta dentro de esa zona, dispara onFullSwipe (que siempre debe abrir
// una confirmación antes de borrar nada).
//
// El efecto se suscribe UNA sola vez (deps []): en la lista de activos, "lineup"/"bench"
// llegan como props nuevas del contexto en casi cada render, así que si "onFullSwipe" (una
// función definida en línea por el padre) formara parte de las dependencias, el efecto se
// desmontaría y volvería a montar los listeners nativos en mitad de un arrastre real,
// cortando el gesto y obligando a soltar y volver a deslizar. Por eso la última versión de
// onFullSwipe se guarda en un ref que el listener siempre lee "en caliente".
function useSwipeReveal(onFullSwipe) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pastThreshold, setPastThreshold] = useState(false);
  const rowRef = useRef(null);
  const offsetRef = useRef(0);
  const onFullSwipeRef = useRef(onFullSwipe);
  onFullSwipeRef.current = onFullSwipe;

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const drag = { startX: 0, startY: 0, active: false, axis: null, startOffset: 0, threshold: -160, maxDrag: -240 };
    const onStart = (e) => {
      const t = e.touches[0];
      drag.startX = t.clientX; drag.startY = t.clientY; drag.active = true; drag.axis = null; drag.startOffset = offsetRef.current;
      const width = el.getBoundingClientRect().width || 320;
      drag.threshold = -(width * 0.5);
      drag.maxDrag = drag.threshold - 80;
    };
    const onMove = (e) => {
      if (!drag.active) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'x') setDragging(true);
      }
      if (drag.axis === 'x') {
        e.preventDefault();
        const next = Math.max(drag.maxDrag, Math.min(0, drag.startOffset + dx));
        offsetRef.current = next;
        setOffset(next);
        setPastThreshold(next <= drag.threshold);
      }
    };
    const onEnd = () => {
      if (drag.axis === 'x') {
        const final = offsetRef.current;
        if (final <= drag.threshold) {
          offsetRef.current = 0; setOffset(0);
          onFullSwipeRef.current();
        } else if (final < -SWIPE_ACTION_WIDTH / 2) {
          offsetRef.current = -SWIPE_ACTION_WIDTH; setOffset(-SWIPE_ACTION_WIDTH);
        } else {
          offsetRef.current = 0; setOffset(0);
        }
      }
      drag.active = false;
      drag.axis = null;
      setDragging(false);
      setPastThreshold(false);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const close = () => { offsetRef.current = 0; setOffset(0); };
  return { rowRef, offset, dragging, pastThreshold, close };
}

function PlayerRow({ p, lineup, bench, onEdit, onDelete }) {
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(() => onDelete(p.id));

  return (
    <div className="relative overflow-hidden">
      {/* Orden en el flex: Borrar primero (se revela último, más lejos) y Editar segundo
          (se revela primero, justo a la derecha inmediata del jugador). El panel está
          anclado a la derecha, así que el SEGUNDO hijo del flex queda más pegado al borde
          del contenido y por tanto es el primero en asomar al deslizar. */}
      <div className="absolute inset-y-0 right-0 flex">
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
        className="relative bg-surface p-3 md:p-4 flex items-center justify-between hover:bg-well/50 transition-colors gap-4 touch-pan-y"
      >
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0] || p.pos}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
          <div className="flex-1 min-w-0">
            <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight flex items-center gap-2 text-black dark:text-white">{p.name}</div>
            <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest mb-1">{p.positions?.join(' · ') || p.pos}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{p.age} Años</span>
              {p.marketValue && (<span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(p.marketValue)}</span>)}
              {p.type === 'Cedido' && p.loanDuration && (<span className="text-[7px] md:text-[8px] text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">{formatLoanDuration(p.loanDuration)}</span>)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {Object.values(lineup).includes(p.id) ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-green-500/20 text-green-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-green-500/20"><Shirt size={12} /> <span className="hidden sm:inline">Titular</span><span className="sm:hidden">11</span></span>) : Object.values(bench).includes(p.id) ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-blue-500/20"><Users size={12} /> <span className="hidden sm:inline">Banquillo</span><span className="sm:hidden">Banq</span></span>) : p.transferStatus === 'Cedible' ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-yellow-500/20"><ArrowRightLeft size={12} /> Cedible</span>) : p.transferStatus === 'Transferible' ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-red-500/20 text-red-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-red-500/20"><Tag size={12} /> Venta</span>) : null}
          {p.type && (
            <span className={`text-[8px] md:text-[9px] px-2 md:px-3 py-1 rounded-lg font-black uppercase tracking-widest border ${p.type === 'Cantera' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : p.type === 'Cedido' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' : 'bg-blue-500/20 text-blue-400 border-blue-500/20'}`}>
              {p.type}
            </span>
          )}
        </div>
        {/* Umbral de borrado continuo: al superar la mitad de la fila, toda la franja se
            tiñe de rojo en tiempo real para anticipar que soltar aquí borra al jugador. */}
        {pastThreshold && (
          <div className="absolute inset-0 z-10 bg-red-500 flex items-center justify-center gap-2 text-white font-black uppercase text-sm">
            <Trash2 size={18} /> Borrar
          </div>
        )}
      </div>
    </div>
  );
}

// Misma mecánica de deslizar que PlayerRow, aplicada también a los jugadores cedidos a otros
// clubes: "Editar" abre directamente el Paso 4 del formulario, igual que en la lista de
// activos, con el mismo orden de botones y el mismo aviso rojo de borrado continuo.
function LoanedPlayerRow({ p, onEdit, onDelete }) {
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(onDelete);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">
        <button type="button" onClick={() => { onDelete(); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:bg-red-400 touch-manipulation">
          <Trash2 size={18} />
          <span className="text-[8px] font-black uppercase">Borrar</span>
        </button>
        <button type="button" onClick={() => { onEdit(); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-well text-fg-muted active:bg-well-strong touch-manipulation">
          <Edit2 size={18} />
          <span className="text-[8px] font-black uppercase">Editar</span>
        </button>
      </div>
      <div
        ref={rowRef}
        onClick={() => { if (offset < 0) close(); }}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        className="relative bg-surface p-3 md:p-4 flex items-center justify-between gap-4 touch-pan-y"
      >
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
          <div className="flex-1 min-w-0"><div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div><div className="text-[8px] md:text-[9px] text-zinc-500 font-black uppercase tracking-widest">{p.positions?.join(' · ')}</div><div className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="text-[8px] md:text-[9px] text-zinc-600 font-black bg-well px-2 py-0.5 rounded">Cedido</span>{p.loanDuration && (<span className="text-[8px] md:text-[9px] text-zinc-500 font-black bg-well px-2 py-0.5 rounded">{formatLoanDuration(p.loanDuration)}</span>)}</div></div>
        </div>
        {pastThreshold && (
          <div className="absolute inset-0 z-10 bg-red-500 flex items-center justify-center gap-2 text-white font-black uppercase text-sm">
            <Trash2 size={18} /> Borrar
          </div>
        )}
      </div>
    </div>
  );
}
