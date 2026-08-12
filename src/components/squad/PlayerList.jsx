import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Edit2, Trash2, Shirt, Armchair, ArrowRightLeft, Tag, ShieldAlert, ArrowUpDown, Star, DollarSign, Calendar, ArrowDownAZ, MoreHorizontal, Handshake, GraduationCap, Undo2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue, formatLoanDuration } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import PlayerForm from './PlayerForm';
import ConfirmModal from '../common/ConfirmModal';
import SellPlayerModal from '../economy/SellPlayerModal';
import LoanOutModal from '../economy/LoanOutModal';

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
  const { players, lineup, bench, playerToDelete, setPlayerToDelete, confirmDeletePlayer, setPlayerTransferStatus } = useClubData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('rating-desc');
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [formPrefill, setFormPrefill] = useState(null);
  const [formSourceScoutId, setFormSourceScoutId] = useState(null);
  const [formInitialStep, setFormInitialStep] = useState(1);
  const [sellingPlayer, setSellingPlayer] = useState(null);
  const [loaningPlayer, setLoaningPlayer] = useState(null);
  const [endingLoanPlayer, setEndingLoanPlayer] = useState(null);
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
          <input type="text" placeholder="Buscar jugador..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint max-md:placeholder:text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
          <PlayerRow
            key={p.id} p={p} lineup={lineup} bench={bench}
            onEdit={openEditForm} onDelete={setPlayerToDelete}
            onMarkTransferible={() => setPlayerTransferStatus(p.id, 'Transferible')}
            onMarkCedible={() => setPlayerTransferStatus(p.id, 'Cedible')}
            onSell={() => setSellingPlayer(p)}
            onLoan={() => setLoaningPlayer(p)}
            onEndLoan={() => { setEndingLoanPlayer(p); setPlayerToDelete(p.id); }}
          />
        ))}
      </div>

      {loanedOutPlayers.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border space-y-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300">
          <div className="px-2 flex items-center gap-2 text-zinc-400"><ArrowRightLeft size={14} /><h3 className="text-xs font-black uppercase tracking-widest italic">Jugadores Cedidos a otros Clubes</h3></div>
          <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
            {loanedOutPlayers.map((p) => (
              <LoanedPlayerRow
                key={p.id} p={p}
                onEdit={() => openEditForm(p)} onDelete={() => setPlayerToDelete(p.id)}
                onRecall={() => setPlayerTransferStatus(p.id, 'Activo')}
              />
            ))}
          </div>
        </div>
      )}

      {showForm && <PlayerForm editingPlayer={editingPlayer} prefill={formPrefill} sourceScoutId={formSourceScoutId} initialStep={formInitialStep} onClose={() => setShowForm(false)} />}
      {sellingPlayer && <SellPlayerModal player={sellingPlayer} onClose={() => setSellingPlayer(null)} />}
      {loaningPlayer && <LoanOutModal player={loaningPlayer} onClose={() => setLoaningPlayer(null)} />}

      {playerToDelete && !endingLoanPlayer && (
        <ConfirmModal
          icon={ShieldAlert}
          title="Eliminar Jugador"
          message="¿Estás seguro de que deseas eliminar este jugador?"
          confirmLabel="Eliminar"
          onCancel={() => setPlayerToDelete(null)}
          onConfirm={confirmDeletePlayer}
        />
      )}

      {/* "Finalizar Cesión" reutiliza el mismo borrado que confirmDeletePlayer (el jugador
          cedido entrante no es propiedad del club, así que "eliminarlo" de la plantilla es
          exactamente devolverlo a su club de origen), con su propio mensaje de confirmación
          para que quede claro que no se trata de un borrado normal. */}
      {endingLoanPlayer && (
        <ConfirmModal
          icon={Undo2}
          iconClassName="text-yellow-500"
          title="Finalizar Cesión"
          message={`${endingLoanPlayer.name} volverá a su club de origen y saldrá de la plantilla. ¿Confirmas la finalización de la cesión?`}
          confirmLabel="Finalizar Cesión"
          confirmClassName="bg-yellow-500 text-black shadow-yellow-500/20 hover:bg-yellow-400"
          onCancel={() => { setEndingLoanPlayer(null); setPlayerToDelete(null); }}
          onConfirm={async () => { await confirmDeletePlayer(); setEndingLoanPlayer(null); }}
        />
      )}
    </div>
  );
}

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
function useSwipeReveal(onFullSwipe, actionWidth = 128) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pastThreshold, setPastThreshold] = useState(false);
  const rowRef = useRef(null);
  const offsetRef = useRef(0);
  const onFullSwipeRef = useRef(onFullSwipe);
  onFullSwipeRef.current = onFullSwipe;
  const actionWidthRef = useRef(actionWidth);
  actionWidthRef.current = actionWidth;

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
        } else if (final < -actionWidthRef.current / 2) {
          offsetRef.current = -actionWidthRef.current; setOffset(-actionWidthRef.current);
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

const ROW_ACTION_WIDTH = 192; // 3 botones de 64px (w-16) cada uno

function PlayerRow({ p, lineup, bench, onEdit, onDelete, onMarkTransferible, onMarkCedible, onSell, onLoan, onEndLoan }) {
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(() => onDelete(p.id), ROW_ACTION_WIDTH);
  const [showMore, setShowMore] = useState(false);
  const [moreRect, setMoreRect] = useState(null);
  // En móvil, Editar/Eliminar ya se hacen con el swipe, así que el menú "..." solo suma las
  // 4 acciones de mercado; en escritorio (sin swipe) el menú "..." es la única vía y por eso
  // agrupa las 6, en el orden pedido. "moreContext" recuerda qué botón abrió el menú para
  // decidir cuál de las dos listas mostrar.
  const [moreContext, setMoreContext] = useState('desktop');
  // Dos botones "..." en el DOM (el del panel de swipe en móvil y el inline de escritorio,
  // ver más abajo): solo uno es visible/clicable según el ancho de pantalla, pero ambos
  // existen a la vez (ocultos por CSS, no por render condicional), así que hacen falta dos
  // refs para que el "click fuera" no confunda el botón que abrió el menú con un clic externo.
  const moreBtnMobileRef = useRef(null);
  const moreBtnDesktopRef = useRef(null);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => {
      if (moreBtnMobileRef.current?.contains(e.target)) return;
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

  const toggleMore = (e, context) => {
    if (showMore) { setShowMore(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 200 });
    setMoreContext(context);
    setShowMore(true);
  };

  // Un jugador cedido a nuestro club (type 'Cedido') no es propiedad del club: no puede
  // marcarse como transferible/cedible ni venderse/re-cederse. Esas 4 opciones se muestran
  // igualmente mas deshabilitadas (para dejar claro que no aplican), precedidas por
  // "Finalizar Cesión", que sí es una acción válida y propia de este tipo de jugador.
  const isIncomingLoan = p.type === 'Cedido';
  const MARKET_ACTIONS = [
    { key: 'transferible', icon: Tag, label: 'Añadir a Transferibles', onClick: onMarkTransferible, disabled: isIncomingLoan },
    { key: 'cedible', icon: ArrowRightLeft, label: 'Añadir a Cedibles', onClick: onMarkCedible, disabled: isIncomingLoan },
    { key: 'sell', icon: DollarSign, label: 'Vender Jugador', onClick: onSell, disabled: isIncomingLoan },
    { key: 'loan', icon: Handshake, label: 'Ceder Jugador', onClick: onLoan, disabled: isIncomingLoan },
  ];
  const endLoanAction = { key: 'endLoan', icon: Undo2, label: 'Finalizar Cesión', onClick: () => onEndLoan(p) };
  const marketWithEndLoan = isIncomingLoan ? [endLoanAction, ...MARKET_ACTIONS] : MARKET_ACTIONS;
  // Móvil: solo las acciones de mercado (Editar/Eliminar van por swipe).
  // Escritorio: las mismas más Editar y Borrar al final, único punto de acceso a esas dos.
  const MORE_ACTIONS = moreContext === 'mobile'
    ? marketWithEndLoan
    : [...marketWithEndLoan, { key: 'edit', icon: Edit2, label: 'Editar Jugador', onClick: () => onEdit(p) }, { key: 'delete', icon: Trash2, label: 'Borrar Jugador', onClick: () => onDelete(p.id) }];

  return (
    <div className="relative overflow-hidden">
      {/* Panel de swipe: solo en móvil (sm:hidden). Orden en el flex: Borrar primero, Editar
          en el centro y "..." al final. El panel está anclado a la derecha, así que el
          ÚLTIMO hijo del flex queda más pegado al borde del contenido y por tanto es el
          primero en asomar al deslizar — de ahí que "..." se revele antes que Editar, y
          este antes que Borrar (de izquierda a derecha ya desplegado: Borrar · Editar · "..."). */}
      <div className="absolute inset-y-0 right-0 flex sm:hidden">
        <button type="button" onClick={() => { onDelete(p.id); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:bg-red-400 touch-manipulation">
          <Trash2 size={18} />
          <span className="text-[8px] font-black uppercase">Borrar</span>
        </button>
        <button type="button" onClick={() => { onEdit(p); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-well text-fg-muted active:bg-well-strong touch-manipulation">
          <Edit2 size={18} />
          <span className="text-[8px] font-black uppercase">Editar</span>
        </button>
        <button ref={moreBtnMobileRef} type="button" onClick={(e) => toggleMore(e, 'mobile')} className="w-16 flex flex-col items-center justify-center gap-1 bg-well-strong text-fg-muted active:bg-well touch-manipulation">
          <MoreHorizontal size={18} />
          <span className="text-[8px] font-black uppercase">Más</span>
        </button>
      </div>
      <div
        ref={rowRef}
        onClick={() => { if (offset < 0) close(); }}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        className="relative bg-surface p-3 md:p-4 flex items-center justify-between hover:bg-well/50 transition-colors gap-4 touch-pan-y group"
      >
        {/* Badges circulares e integrados en las esquinas, solo en móvil: sustituyen a los
            recuadros rectangulares de Titular/Banquillo/Cantera para una tarjeta más compacta.
            En escritorio se mantienen los recuadros de la columna de estado (más abajo). */}
        {Object.values(lineup).includes(p.id) ? (
          <span title="Titular" className="sm:hidden absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-green-500/20 text-green-400 rounded-full border border-green-500/30"><Shirt size={12} /></span>
        ) : Object.values(bench).includes(p.id) ? (
          <span title="Banquillo" className="sm:hidden absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30"><Armchair size={12} /></span>
        ) : null}
        {p.type === 'Cantera' && (
          <span title="Cantera" className="sm:hidden absolute bottom-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30"><GraduationCap size={12} /></span>
        )}

        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0] || p.pos}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
          <div className="flex-1 min-w-0">
            <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight flex items-center gap-2 text-black dark:text-white">{p.name}</div>
            <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest mb-1">{p.positions?.join(' · ') || p.pos}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{p.age} Años</span>
              {p.marketValue && (<span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(p.marketValue)}</span>)}
              {p.type === 'Cedido' && p.loanDuration && (<span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded">Ced. {formatLoanDuration(p.loanDuration)}</span>)}
            </div>
          </div>
        </div>

        {/* Ancho mínimo homogéneo (min-w-[104px] + justify-center) en la etiqueta de estado
            (Cedible/Venta) y en el badge de Cantera, para que ocupen siempre el mismo espacio
            y la columna quede simétrica. En móvil, Titular/Banquillo/Cantera se ocultan aquí
            (van como círculo en la esquina de la tarjeta); Cedible/Venta se mantienen visibles. */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {Object.values(lineup).includes(p.id) ? (<span title="Titular" className="hidden sm:flex w-9 h-9 items-center justify-center bg-green-500/20 text-green-400 rounded-lg border border-green-500/20"><Shirt size={16} /></span>) : Object.values(bench).includes(p.id) ? (<span title="Banquillo" className="hidden sm:flex w-9 h-9 items-center justify-center bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20"><Armchair size={16} /></span>) : p.type !== 'Cedido' && p.transferStatus === 'Cedible' ? (<span className="text-[8px] md:text-[9px] flex items-center justify-center gap-1.5 min-w-[104px] text-center bg-yellow-500/20 text-yellow-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-yellow-500/20"><ArrowRightLeft size={12} className="shrink-0" /> Cedible</span>) : p.type !== 'Cedido' && p.transferStatus === 'Transferible' ? (<span className="text-[8px] md:text-[9px] flex items-center justify-center gap-1.5 min-w-[104px] text-center bg-red-500/20 text-red-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-red-500/20"><Tag size={12} className="shrink-0" /> Venta</span>) : null}
          {p.type === 'Cantera' && (
            <span className="hidden sm:flex text-[8px] md:text-[9px] items-center justify-center gap-1.5 min-w-[104px] text-center px-2 md:px-3 py-1 rounded-lg font-black uppercase tracking-widest border bg-emerald-500/20 text-emerald-400 border-emerald-500/20">
              <GraduationCap size={12} className="shrink-0" /> Cantera
            </span>
          )}
        </div>

        {/* Escritorio: nada de swipe (no hay touch), así que todas las acciones (Editar,
            Eliminar, Transferibles, Cedibles, Vender, Ceder) se agrupan en el único botón
            "...", ahorrando espacio horizontal en la fila. Solo se hace visible al pasar el
            cursor por encima de la fila. */}
        <div className="hidden sm:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button ref={moreBtnDesktopRef} type="button" onClick={(e) => toggleMore(e, 'desktop')} title="Más opciones" className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-well-strong transition-colors touch-manipulation">
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Umbral de borrado continuo (solo móvil): al superar la mitad de la fila, toda la
            franja se tiñe de rojo en tiempo real para anticipar que soltar aquí borra al
            jugador. En escritorio "offset" nunca se mueve (no hay gesto táctil), así que esto
            nunca se activa igualmente, pero se oculta por CSS para no dejarlo ambiguo. */}
        {pastThreshold && (
          <div className="absolute inset-0 z-10 bg-red-500 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden">
            <Trash2 size={18} /> Borrar
          </div>
        )}
      </div>

      {/* Menú contextual del botón "...": mismo patrón de portal que el resto de la app
          (fuera de cualquier overflow-hidden, posición fixed calculada desde el propio
          botón), para que nunca quede recortado por la lista. */}
      {showMore && moreRect && createPortal(
        <div
          ref={moreMenuRef}
          style={{ position: 'fixed', top: moreRect.top, right: moreRect.right, width: moreRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {MORE_ACTIONS.map(({ key, icon: Icon, label, onClick, disabled }) => (
            <button key={key} type="button" disabled={disabled} onClick={() => { if (disabled) return; onClick(); setShowMore(false); close(); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all touch-manipulation ${disabled ? 'text-fg-faint opacity-40 pointer-events-none' : 'text-fg-secondary hover:bg-well'}`}>
              <Icon size={14} className="shrink-0" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// Misma mecánica de deslizar que PlayerRow, aplicada también a los jugadores cedidos a otros
// clubes: "Editar" abre directamente el Paso 4 del formulario, igual que en la lista de
// activos, con el mismo orden de botones y el mismo aviso rojo de borrado continuo. En
// escritorio, en vez de dos botones sueltos, se agrupan en un único "..." con las acciones
// propias de un jugador cedido fuera (Recuperar, Editar, Borrar).
function LoanedPlayerRow({ p, onEdit, onDelete, onRecall }) {
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(onDelete);
  const [showMore, setShowMore] = useState(false);
  const [moreRect, setMoreRect] = useState(null);
  const moreBtnRef = useRef(null);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => {
      if (moreBtnRef.current?.contains(e.target)) return;
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
    { key: 'recall', icon: ArrowRightLeft, label: 'Recuperar al Club', onClick: onRecall },
    { key: 'edit', icon: Edit2, label: 'Editar Jugador', onClick: () => onEdit() },
    { key: 'delete', icon: Trash2, label: 'Borrar Jugador', onClick: () => onDelete() },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex sm:hidden">
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
        className="relative bg-surface p-3 md:p-4 flex items-center justify-between gap-4 touch-pan-y group"
      >
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
          <div className="flex-1 min-w-0"><div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div><div className="text-[8px] md:text-[9px] text-zinc-500 font-black uppercase tracking-widest">{p.positions?.join(' · ')}</div></div>
        </div>

        {/* Texto claro y completo de la duración, a la derecha del todo de la casilla —
            sustituye el formato comprimido anterior (icono + "6M"). La duración real de la
            cesión saliente vive en outboundLoan.duration (así la guarda cedePlayer); se
            conserva "loanDuration" como respaldo por compatibilidad con datos antiguos.
            En móvil se apila en dos líneas ("Cedido" arriba, duración abajo); en escritorio
            (md:) se une en una sola línea, con más espacio horizontal disponible. */}
        <div className="shrink-0 text-right flex flex-col md:flex-row md:items-center md:gap-1 mr-3 md:mr-4">
          <span className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-wide whitespace-nowrap">Cedido</span>
          {(p.outboundLoan?.duration || p.loanDuration) && (
            <span className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-wide whitespace-nowrap">
              {(p.outboundLoan?.duration || p.loanDuration).toLowerCase()}
            </span>
          )}
        </div>

        <div className="hidden sm:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button ref={moreBtnRef} type="button" onClick={toggleMore} title="Más opciones" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-fg hover:bg-well transition-colors touch-manipulation">
            <MoreHorizontal size={14} />
          </button>
        </div>

        {pastThreshold && (
          <div className="absolute inset-0 z-10 bg-red-500 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden">
            <Trash2 size={18} /> Borrar
          </div>
        )}
      </div>

      {showMore && moreRect && createPortal(
        <div
          ref={moreMenuRef}
          style={{ position: 'fixed', top: moreRect.top, right: moreRect.right, width: moreRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {MORE_ACTIONS.map(({ key, icon: Icon, label, onClick, disabled }) => (
            <button key={key} type="button" disabled={disabled} onClick={() => { if (disabled) return; onClick(); setShowMore(false); close(); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all touch-manipulation ${disabled ? 'text-fg-faint opacity-40 pointer-events-none' : 'text-fg-secondary hover:bg-well'}`}>
              <Icon size={14} className="shrink-0" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
