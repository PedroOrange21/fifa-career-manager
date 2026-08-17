import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, Plus, ArrowRightLeft, Trash2, Edit2, MoreHorizontal, RotateCcw, DollarSign, ShieldAlert } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue } from '../../utils/format';
import SwipeableRow from '../common/SwipeableRow';
import PlayerInfoModal from '../squad/PlayerInfoModal';
import SellPlayerModal from '../economy/SellPlayerModal';
import LoanOutModal from '../economy/LoanOutModal';
import AddOperationPlayerModal from './AddOperationPlayerModal';
import ConfirmModal from '../common/ConfirmModal';

// Mismo gestor de deslizamiento (SwipeableRow) que Plantilla y Academia: en vez de esconder
// las acciones propias de cada lista (Recuperar, Ejecutar Opción de Compra, Quitar de
// Transferibles/Cedibles) detrás de un botón "Más" intermedio, el panel de swipe las muestra
// todas directamente junto a Borrar/Editar — el ancho del panel se adapta solo según cuántas
// acciones tenga cada fila. En escritorio se mantiene el "..." con el mismo listado, para no
// competir por espacio con el contenido de la derecha.
function OperationRow({ player, chipClassName, chipTextClassName, onClick, onDelete, onEdit, moreActions, children }) {
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
    e.stopPropagation();
    if (showMore) { setShowMore(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 230 });
    setShowMore(true);
  };

  // Borrar va el último del array (más pegado al borde, primero en asomar al deslizar) para
  // que el rótulo rojo de borrado se adelante desde el primer instante del gesto. "shortLabel"
  // (si existe) sustituye al texto largo del desplegable de escritorio para que quepa sin
  // desbordar el botón de 64px del panel de swipe (ver "Ejecutar Opción de Compra").
  const swipeButtons = [
    ...moreActions.map(({ key, icon, label, shortLabel, onClick: onAction }) => ({ key, icon, label: shortLabel || label, onClick: onAction })),
    { key: 'edit', icon: Edit2, label: 'Editar', onClick: onEdit },
    { key: 'delete', icon: Trash2, label: 'Borrar', onClick: onDelete, danger: true },
  ];

  return (
    <SwipeableRow onFullSwipe={onDelete} buttons={swipeButtons} rounded>
      {({ rowRef, offset, dragging, close }) => (
        <div
          ref={rowRef}
          onClick={(e) => { if (offset < 0) { close(); return; } onClick?.(e); }}
          style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 200ms ease-out' }}
          className="relative rounded-xl cursor-pointer touch-pan-y group"
        >
          {/* chipClassName (ej. "bg-red-500/5 border-red-500/10") es semitransparente a
              propósito para el tinte de color de cada lista — pero eso significa que, sin una
              base opaca detrás, el panel de swipe se transparentaba por debajo de la fila
              incluso en reposo, "solapándose" visualmente con el texto. Se arregla con una
              capa base 100% opaca (bg-surface) y el tinte encima, en vez de aplicar
              chipClassName directamente sobre el contenido. */}
          <div className="absolute inset-0 bg-surface rounded-xl" />
          <div className={`absolute inset-0 rounded-xl border ${chipClassName}`} />
          <div className="relative flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-3 min-w-0 flex-1 md:transition-transform md:duration-300 md:ease-in-out md:group-hover:translate-x-9">
              <div className={`w-8 h-8 rounded-lg flex shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(player.rating)}`}>{player.rating}</div>
              <div className="flex flex-col min-w-0"><span className="text-[10px] font-bold uppercase italic text-black dark:text-white truncate">{player.name}</span><span className={`text-[8px] font-black uppercase tracking-widest truncate ${chipTextClassName}`}>{player.positions?.join(' · ')}</span></div>
            </div>
            {children}

            {/* Escritorio: "..." fijo a la izquierda, oculto hasta hacer hover en la fila (mismo
                patrón que PlayerRow), para no competir por espacio con el contenido de la
                derecha. */}
            <button ref={moreBtnDesktopRef} type="button" onClick={toggleMore} title="Más opciones" className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-well-strong opacity-0 pointer-events-none transition-opacity duration-300 ease-in-out md:group-hover:opacity-100 md:group-hover:pointer-events-auto touch-manipulation">
              <MoreHorizontal size={13} />
            </button>
          </div>

          {showMore && moreRect && createPortal(
            <div
              ref={moreMenuRef}
              style={{ position: 'fixed', top: moreRect.top, right: moreRect.right, width: moreRect.width }}
              className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
              onClick={(e) => e.stopPropagation()}
            >
              {moreActions.map(({ key, icon: Icon, label, onClick: onAction }) => (
                <button key={key} type="button" onClick={() => { onAction(); setShowMore(false); close(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all touch-manipulation text-fg-secondary hover:bg-well">
                  <Icon size={14} className="shrink-0" /> {label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </SwipeableRow>
  );
}

export default function OperationsTab({ onRequestEditPlayer }) {
  const { players, playerToDelete, setPlayerToDelete, confirmDeletePlayer, setPlayerTransferStatus } = useClubData();
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null);
  const [infoSlot, setInfoSlot] = useState(null);
  const [sellingPlayer, setSellingPlayer] = useState(null);
  const [loaningPlayer, setLoaningPlayer] = useState(null);
  const [addingStatus, setAddingStatus] = useState(null);

  const forSale = players.filter((p) => p.transferStatus === 'Transferible' && p.type !== 'Cedido').sort((a, b) => b.rating - a.rating);
  const forLoan = players.filter((p) => p.transferStatus === 'Cedible' && p.type !== 'Cedido').sort((a, b) => b.rating - a.rating);
  const loanedOut = players.filter((p) => p.transferStatus === 'CedidoFuera').sort((a, b) => b.rating - a.rating);

  const openInfo = (player, slot) => { setSelectedPlayerInfo(player); setInfoSlot(slot); };
  const editPlayer = (p) => onRequestEditPlayer(p);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-surface p-4 rounded-[24px] border border-red-500/10 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/60 italic">En Venta (Transferibles)</h3>
          <button onClick={() => setAddingStatus('Transferible')} title="Añadir jugador a la lista" className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Plus size={14} /></button>
        </div>
        <div className="grid gap-2">
          {forSale.map((p) => (
            <OperationRow
              key={p.id} player={p} onClick={() => openInfo(p, 'forSale')}
              chipClassName="bg-red-500/5 border-red-500/10" chipTextClassName="text-red-400"
              onDelete={() => setPlayerToDelete(p.id)} onEdit={() => editPlayer(p)}
              moreActions={[{ key: 'unlist', icon: RotateCcw, label: 'Quitar de Transferibles', onClick: () => setPlayerTransferStatus(p.id, 'Activo') }]}
            >
              <div className="flex items-center gap-2 shrink-0">
                {(p.marketValue || p.value) ? <span className="text-[8px] text-red-400 font-black uppercase">{abbreviateValue(p.marketValue || p.value)}</span> : null}
                <button onClick={(e) => { e.stopPropagation(); setSellingPlayer(p); }} className="bg-red-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm flex items-center gap-1"><Tag size={11} /> Vender</button>
              </div>
            </OperationRow>
          ))}
          {forSale.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Vacío. Añade jugadores con el botón "+".</span>}
        </div>
      </div>

      <div className="bg-surface p-4 rounded-[24px] border border-yellow-500/10 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60 italic">Lista de Cedibles</h3>
          <button onClick={() => setAddingStatus('Cedible')} title="Añadir jugador a la lista" className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-all"><Plus size={14} /></button>
        </div>
        <div className="grid gap-2">
          {forLoan.map((p) => (
            <OperationRow
              key={p.id} player={p} onClick={() => openInfo(p, 'forLoan')}
              chipClassName="bg-yellow-500/5 border-yellow-500/10" chipTextClassName="text-yellow-500"
              onDelete={() => setPlayerToDelete(p.id)} onEdit={() => editPlayer(p)}
              moreActions={[{ key: 'unlist', icon: RotateCcw, label: 'Quitar de Cedibles', onClick: () => setPlayerTransferStatus(p.id, 'Activo') }]}
            >
              <button onClick={(e) => { e.stopPropagation(); setLoaningPlayer(p); }} className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm flex items-center gap-1 shrink-0"><ArrowRightLeft size={11} /> Ceder</button>
            </OperationRow>
          ))}
          {forLoan.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Vacío. Añade jugadores con el botón "+".</span>}
        </div>
      </div>

      <div className="bg-surface p-4 rounded-[24px] border border-border-subtle shadow-2xl opacity-80">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic mb-3">Cedidos a otros Clubes</h3>
        <div className="grid gap-2">
          {loanedOut.map((p) => (
            <OperationRow
              key={p.id} player={p} onClick={() => openInfo(p, 'loanedOut')}
              chipClassName="bg-well border-border-subtle" chipTextClassName="text-fg-faint"
              onDelete={() => setPlayerToDelete(p.id)} onEdit={() => editPlayer(p)}
              moreActions={[
                { key: 'recall', icon: RotateCcw, label: 'Recuperar Jugador', onClick: () => setPlayerTransferStatus(p.id, 'Activo') },
                // Solo si la cesión se pactó con opción de compra: ejecutarla abre el modal de
                // Venta ya preparado con ese importe (ver SellPlayerModal, que da prioridad al
                // buyOption de la cesión sobre el valor de mercado al precargar el precio).
                ...(p.outboundLoan?.buyOption ? [{ key: 'buyoption', icon: DollarSign, label: 'Ejecutar Opción de Compra', shortLabel: 'Ejec. Opc. Compra', onClick: () => setSellingPlayer(p) }] : []),
              ]}
            >
              {p.outboundLoan && (
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-black text-fg-secondary uppercase truncate max-w-[100px]">{p.outboundLoan.destinationClub}</div>
                  <div className="text-[8px] text-fg-faint font-black uppercase">{p.outboundLoan.wagePercentage}% Salario</div>
                </div>
              )}
            </OperationRow>
          ))}
          {loanedOut.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Sin jugadores cedidos fuera.</span>}
        </div>
      </div>

      {/* Misma ficha de detalle de solo lectura que en Plantilla (cabecera FIFA, secciones
          completas y único lápiz para editar) — sin el bloque de Estado de Mercado ni los
          botones de acción, que aquí ya viven en la propia fila (Vender/Ceder, swipe y "Más"). */}
      {selectedPlayerInfo && (
        <PlayerInfoModal
          player={selectedPlayerInfo}
          infoSlot={infoSlot}
          onClose={() => setSelectedPlayerInfo(null)}
          onEdit={(p) => { setSelectedPlayerInfo(null); onRequestEditPlayer(p); }}
          onReplace={() => {}}
          hideTacticsActions
        />
      )}

      {sellingPlayer && <SellPlayerModal player={sellingPlayer} onClose={() => setSellingPlayer(null)} />}
      {loaningPlayer && <LoanOutModal player={loaningPlayer} onClose={() => setLoaningPlayer(null)} />}
      {addingStatus && (
        <AddOperationPlayerModal
          status={addingStatus}
          title={addingStatus === 'Transferible' ? 'Añadir a Transferibles' : 'Añadir a Cedibles'}
          onClose={() => setAddingStatus(null)}
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
