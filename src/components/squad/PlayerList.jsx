import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Edit2, Trash2, Shirt, Armchair, ArrowRightLeft, Tag, ShieldAlert, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Star, DollarSign, Calendar, ArrowDownAZ, MoreHorizontal, Handshake, GraduationCap, Undo2, LayoutGrid } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { ALL_POSITIONS } from '../../constants/positions';
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

// Media/Valor/Edad se agrupan en una fila compacta por criterio (etiqueta + dos botones
// mayor/menor), en vez de 2 filas sueltas cada uno como antes.
const SORT_GROUPS = [
  { label: 'Media', descId: 'rating-desc', ascId: 'rating-asc', icon: Star },
  { label: 'Valor', descId: 'value-desc', ascId: 'value-asc', icon: DollarSign },
  { label: 'Edad', descId: 'age-desc', ascId: 'age-asc', icon: Calendar },
];

const SORT_OPTIONS = [
  { id: 'name-asc', label: 'Nombre (A-Z)', icon: ArrowDownAZ },
  { id: 'status-role', label: 'Rol en Equipo', icon: Shirt },
  { id: 'ownership', label: 'Propiedad del Club', icon: ShieldCheck },
  { id: 'position', label: 'Posición en el Campo', icon: LayoutGrid },
];

// Orden táctico natural en el terreno de juego (Portero → Defensas → Centrocampistas →
// Delanteros), reutilizando el mismo orden ya definido en ALL_POSITIONS.
const getPositionOrder = (p) => {
  const idx = ALL_POSITIONS.indexOf(p.positions?.[0]);
  return idx === -1 ? ALL_POSITIONS.length : idx;
};

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
  if (filterType === 'ownership') {
    // Comprados y canteranos son propiedad directa del club; los cedidos entrantes
    // (type 'Cedido') pertenecen a otro equipo, así que van al final.
    const getOwnershipScore = (p) => (p.type === 'Cedido' ? 2 : 1);
    filteredPlayers.sort((a, b) => {
      const scoreA = getOwnershipScore(a); const scoreB = getOwnershipScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB; return b.rating - a.rating;
    });
  }
  if (filterType === 'position') {
    filteredPlayers.sort((a, b) => {
      const posA = getPositionOrder(a); const posB = getPositionOrder(b);
      if (posA !== posB) return posA - posB; return b.rating - a.rating;
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
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5">
              {SORT_GROUPS.map(({ label, descId, ascId, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl">
                  <span className="flex items-center gap-2 text-xs font-bold text-fg-secondary"><Icon size={14} className="shrink-0" /> {label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => { setFilterType(descId); setShowSortMenu(false); }} title="Mayor a menor" className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${filterType === descId ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => { setFilterType(ascId); setShowSortMenu(false); }} title="Menor a mayor" className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${filterType === ascId ? 'bg-green-500/10 text-green-500' : 'text-fg-faint hover:bg-well hover:text-fg-secondary'}`}>
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="h-px bg-border-subtle my-1 mx-1" />
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

  // Badges circulares (Titular/Banquillo arriba, Cantera abajo) expandibles al tocarlos en
  // móvil: se despliegan en una píldora con texto explicativo y se repliegan al tocar fuera.
  const [statusBadgeExpanded, setStatusBadgeExpanded] = useState(false);
  const [canteraBadgeExpanded, setCanteraBadgeExpanded] = useState(false);
  const statusBadgeRef = useRef(null);
  const canteraBadgeRef = useRef(null);
  useOnClickOutside(statusBadgeRef, () => setStatusBadgeExpanded(false), statusBadgeExpanded);
  useOnClickOutside(canteraBadgeRef, () => setCanteraBadgeExpanded(false), canteraBadgeExpanded);

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
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 240 });
    setMoreContext(context);
    setShowMore(true);
  };

  // Un jugador cedido a nuestro club (type 'Cedido') no es propiedad del club: no puede
  // marcarse como transferible/cedible ni venderse/re-cederse. Esas 4 opciones se muestran
  // igualmente mas deshabilitadas (para dejar claro que no aplican), precedidas por
  // "Finalizar Cesión", que sí es una acción válida y propia de este tipo de jugador.
  const isIncomingLoan = p.type === 'Cedido';
  const isCalledUp = Object.values(lineup).includes(p.id) || Object.values(bench).includes(p.id);
  // Un canterano que todavía no ha subido al primer equipo no participa del mercado: no puede
  // marcarse transferible/cedible ni venderse/cederse hasta que esté promocionado (convocado
  // al 11 o al banquillo). Una vez promocionado, se gestiona como cualquier otro jugador.
  const isUnpromotedCantera = p.type === 'Cantera' && !isCalledUp;
  const MARKET_ACTIONS = [
    { key: 'transferible', icon: Tag, label: 'Añadir a Transferibles', onClick: onMarkTransferible, disabled: isIncomingLoan || isUnpromotedCantera },
    { key: 'cedible', icon: ArrowRightLeft, label: 'Añadir a Cedibles', onClick: onMarkCedible, disabled: isIncomingLoan || isUnpromotedCantera },
    { key: 'sell', icon: DollarSign, label: 'Vender Jugador', onClick: onSell, disabled: isIncomingLoan || isUnpromotedCantera },
    { key: 'loan', icon: Handshake, label: 'Ceder Jugador', onClick: onLoan, disabled: isIncomingLoan || isUnpromotedCantera },
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
        {/* Badges circulares e integrados en las esquinas — MÓVIL (absolutos, tap para
            desplegar texto, con useOnClickOutside para replegar; ocultos desde md:). */}
        {Object.values(lineup).includes(p.id) ? (
          <button type="button" ref={statusBadgeRef} onClick={(e) => { e.stopPropagation(); setStatusBadgeExpanded((v) => !v); }} title="Titular" className="group/badge md:hidden absolute top-2 right-2 z-20 flex items-center h-6 pl-1.5 pr-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 transition-all duration-300 ease-in-out touch-manipulation">
            <Shirt size={12} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out ${statusBadgeExpanded ? 'max-w-[160px] ml-1.5' : 'max-w-0 ml-0'}`}>Jugador en el once</span>
          </button>
        ) : Object.values(bench).includes(p.id) ? (
          <button type="button" ref={statusBadgeRef} onClick={(e) => { e.stopPropagation(); setStatusBadgeExpanded((v) => !v); }} title="Banquillo" className="group/badge md:hidden absolute top-2 right-2 z-20 flex items-center h-6 pl-1.5 pr-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all duration-300 ease-in-out touch-manipulation">
            <Armchair size={12} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out ${statusBadgeExpanded ? 'max-w-[160px] ml-1.5' : 'max-w-0 ml-0'}`}>Jugador en el banquillo</span>
          </button>
        ) : null}
        {/* Canterano NO convocado: no hay badge de Titular/Banquillo disputando la esquina
            superior, así que el birrete sube ahí. Convocado: ese badge ya ocupa la esquina
            superior, así que el birrete baja a la inferior. */}
        {p.type === 'Cantera' && (
          <button type="button" ref={canteraBadgeRef} onClick={(e) => { e.stopPropagation(); setCanteraBadgeExpanded((v) => !v); }} title="Cantera" className={`group/badge md:hidden absolute right-2 z-20 flex items-center h-6 pl-1.5 pr-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all duration-300 ease-in-out touch-manipulation ${isCalledUp ? 'bottom-2' : 'top-2'}`}>
            <GraduationCap size={12} className="shrink-0" />
            <span className={`overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out ${canteraBadgeExpanded ? 'max-w-[160px] ml-1.5' : 'max-w-0 ml-0'}`}>Canterano del club</span>
          </button>
        )}

        {/* Cuerpo de la tarjeta (badges de escritorio, avatar, info y badge de Cedible): en
            escritorio TODO este bloque se desplaza junto hacia la DERECHA al hacer hover
            (group-hover, mismo "group" del rowRef), badges incluidos, para que nunca queden
            "flotando" respecto al contenido — es "relative" para que los badges (absolute)
            se posicionen respecto a él y no respecto al borde rígido de la fila. Al viajar
            hacia la derecha, deja al descubierto el botón "..." fijo en la esquina superior
            izquierda (ver más abajo), que quedaba oculto detrás de este bloque en reposo. */}
        <div className="relative flex items-center justify-between flex-1 min-w-0 gap-4 md:transition-transform md:duration-300 md:ease-in-out md:group-hover:translate-x-11">
          {/* Solo 2 posiciones de badge en escritorio (absolutos dentro de este contenedor
              desplazable, hover puro vía "group/badge", ocultos hasta md:). Esquina superior:
              estado deportivo, o Cantera si no está convocado. Esquina inferior: Cantera
              cuando SÍ está convocado. */}
          {Object.values(lineup).includes(p.id) ? (
            <button type="button" title="Titular" className="group/badge hidden md:flex absolute top-0 right-0 z-20 items-center h-6 pl-1.5 pr-1.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 transition-all duration-300 ease-in-out">
              <Shirt size={12} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out max-w-0 ml-0 group-hover/badge:max-w-[160px] group-hover/badge:ml-1.5">Jugador en el once</span>
            </button>
          ) : Object.values(bench).includes(p.id) ? (
            <button type="button" title="Banquillo" className="group/badge hidden md:flex absolute top-0 right-0 z-20 items-center h-6 pl-1.5 pr-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all duration-300 ease-in-out">
              <Armchair size={12} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out max-w-0 ml-0 group-hover/badge:max-w-[160px] group-hover/badge:ml-1.5">Jugador en el banquillo</span>
            </button>
          ) : p.type === 'Cantera' ? (
            <button type="button" title="Cantera" className="group/badge hidden md:flex absolute top-0 right-0 z-20 items-center h-6 pl-1.5 pr-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all duration-300 ease-in-out">
              <GraduationCap size={12} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out max-w-0 ml-0 group-hover/badge:max-w-[160px] group-hover/badge:ml-1.5">Canterano del club</span>
            </button>
          ) : null}
          {p.type === 'Cantera' && isCalledUp && (
            <button type="button" title="Cantera" className="group/badge hidden md:flex absolute bottom-0 right-0 z-20 items-center h-6 pl-1.5 pr-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all duration-300 ease-in-out">
              <GraduationCap size={12} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all duration-300 ease-in-out max-w-0 ml-0 group-hover/badge:max-w-[160px] group-hover/badge:ml-1.5">Canterano del club</span>
            </button>
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

          {/* La tarjeta roja de "Venta"/Transferible se elimina por completo (móvil y
              escritorio); solo queda la etiqueta de Cedible. */}
          {p.type !== 'Cedido' && p.transferStatus === 'Cedible' && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[8px] md:text-[9px] flex items-center justify-center gap-1.5 min-w-[104px] text-center bg-yellow-500/20 text-yellow-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-yellow-500/20"><ArrowRightLeft size={12} className="shrink-0" /> Cedible</span>
            </div>
          )}
        </div>

        {/* Botón "..." de escritorio: capa fija (absolute left-3, centrado verticalmente con
            top-1/2 -translate-y-1/2) que NO forma parte del contenedor desplazable, así que
            nunca se mueve. Oculto por defecto (opacity-0) y revelado junto con el
            desplazamiento del cuerpo de la tarjeta al hacer hover: al desplazarse todo el
            bloque (badges incluidos) hacia la derecha, este botón queda perfectamente al
            descubierto y centrado en el espacio liberado a la izquierda. */}
        <button ref={moreBtnDesktopRef} type="button" onClick={(e) => toggleMore(e, 'desktop')} title="Más opciones" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-well-strong opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out md:group-hover:opacity-100 md:group-hover:pointer-events-auto touch-manipulation">
          <MoreHorizontal size={13} />
        </button>

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
            <button key={key} type="button" disabled={disabled} onClick={() => { if (disabled) return; onClick(); setShowMore(false); close(); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all touch-manipulation ${disabled ? 'text-fg-faint opacity-40 pointer-events-none' : 'text-fg-secondary hover:bg-well'}`}>
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
  const { rowRef, offset, dragging, pastThreshold, close } = useSwipeReveal(onDelete, ROW_ACTION_WIDTH);
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
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 240 });
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
        <button type="button" onClick={() => { onRecall(); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-well-strong text-fg-muted active:bg-well touch-manipulation">
          <ArrowRightLeft size={18} />
          <span className="text-[8px] font-black uppercase leading-tight text-center">Recuperar</span>
        </button>
      </div>
      <div
        ref={rowRef}
        onClick={() => { if (offset < 0) close(); }}
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
        className="relative bg-surface p-3 md:p-4 flex items-center justify-between gap-4 touch-pan-y group"
      >
        {/* Cuerpo de la tarjeta (avatar, info y duración): en escritorio se desplaza junto
            hacia la DERECHA al hacer hover (mismo patrón que PlayerRow), dejando al
            descubierto el botón "..." fijo en la esquina/lado izquierdo, oculto detrás en
            reposo. */}
        <div className="flex items-center justify-between flex-1 min-w-0 gap-4 md:transition-transform md:duration-300 md:ease-in-out md:group-hover:translate-x-11">
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
        </div>

        {/* Botón "..." de escritorio: capa fija (left-3, centrado verticalmente) que NO forma
            parte del contenedor desplazable. Oculto por defecto (opacity-0) y revelado junto
            con el desplazamiento del cuerpo hacia la derecha, igual que en las tarjetas de
            jugadores activos de la Plantilla. */}
        <button ref={moreBtnRef} type="button" onClick={toggleMore} title="Más opciones" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-lg text-zinc-500 hover:text-fg hover:bg-well-strong opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out md:group-hover:opacity-100 md:group-hover:pointer-events-auto touch-manipulation">
          <MoreHorizontal size={13} />
        </button>

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
            <button key={key} type="button" disabled={disabled} onClick={() => { if (disabled) return; onClick(); setShowMore(false); close(); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all touch-manipulation ${disabled ? 'text-fg-faint opacity-40 pointer-events-none' : 'text-fg-secondary hover:bg-well'}`}>
              <Icon size={14} className="shrink-0" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
