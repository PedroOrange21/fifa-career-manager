import { X, Edit2, RefreshCcw, Trash2, Tag, Armchair, Shirt, ArrowRightLeft, GraduationCap, ArrowDownToLine, MoreHorizontal, Undo2, User, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue, formatLoanDuration, formatCurrency } from '../../utils/format';
import { isUncalledZone } from '../../utils/slots';
import { flagEmoji, detectCountry } from '../../constants/countries';
import { FORMATIONS } from '../../constants/formations';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import ConfirmModal from '../common/ConfirmModal';
import SellPlayerModal from '../economy/SellPlayerModal';
import LoanOutModal from '../economy/LoanOutModal';
import PlayerStatsScanModal from './PlayerStatsScanModal';
import AIGlowButton from '../common/AIGlowButton';

const ACTION_STYLES = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 shadow-lg shadow-blue-500/10',
  red: 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 shadow-lg shadow-red-500/10',
  yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20 shadow-lg shadow-yellow-500/10',
  neutral: 'bg-well-strong text-fg border-transparent hover:brightness-125',
};

// Cabecera de sección y fila de detalle: réplica exacta de SectionHeader/ReviewRow del Paso 4
// de PlayerForm.jsx (misma estructura, mismas clases), salvo que DetailRow no lleva lápiz ni
// onClick — es puramente de lectura, la edición ocurre siempre desde el único lápiz superior.
function SectionHeader({ emoji, title }) {
  return (
    <div className="w-full flex items-center gap-2 mt-5 mb-1 px-1 first:mt-0">
      <span className="text-sm leading-none">{emoji}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-fg-secondary">{title}</span>
    </div>
  );
}
function DetailRow({ label, value }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[9px] font-black uppercase text-fg-muted shrink-0">{label}</span>
        <span className="text-xs font-black text-fg truncate">{value}</span>
      </div>
    </div>
  );
}
// Variante de DetailRow para el sueldo: semanal (cifra que realmente se guarda) como dato
// principal y anual, más sutil, justo debajo — mismo patrón de dos filas superpuestas que el
// resto de la app (p. ej. Ficha Salarial Pactada en Estadísticas).
function WageDetailRow({ label, weekly }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] font-black uppercase text-fg-muted shrink-0 pt-px">{label}</span>
        <span className="text-right leading-tight shrink-0">
          <span className="block text-xs font-black text-fg">{formatCurrency(weekly)}/sem</span>
          <span className="block text-[10px] font-bold text-fg-faint mt-0.5">{formatCurrency((weekly || 0) * 52)}/año</span>
        </span>
      </div>
    </div>
  );
}

// Media/goles/asistencias/porterías imbatidas/tarjetas: mismos nombres de campo que ya usa
// seasonStats en toda la app (ver ClubDataContext), así que un jugador recién creado (sin
// ningún partido ni escaneo todavía) simplemente no tiene el campo — de ahí el "?? 0" en cada
// lectura, para no mostrar "undefined" en la tabla.
const SEASON_STAT_FIELDS = [
  ['matchesPlayed', 'PJ'], ['goals', 'G'], ['assists', 'A'],
  ['cleanSheets', 'PI'], ['yellowCards', 'TA'], ['redCards', 'TR'],
];

// Pestaña "Rendimiento y Estadísticas": tarjeta de la temporada en curso (con desglose por
// competición si el escaneo lo trajo), botón de actualización individual por IA y, debajo, el
// historial de carrera acumulado por endSeason() al cerrar cada temporada — acordeón simple,
// una temporada a la vez, con el crecimiento de OVR resaltado en verde/rojo.
function PlayerStatsTab({ player, onStatsUpdated }) {
  const [showScan, setShowScan] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState(null);
  const stats = player.seasonStats || {};
  const career = player.careerHistory || [];

  return (
    <div className="space-y-1">
      <SectionHeader emoji="📊" title="Temporada Actual" />
      <div className="w-full bg-well rounded-2xl border border-border-subtle p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {SEASON_STAT_FIELDS.map(([key, label]) => (
            <div key={key} className="text-center bg-well-strong rounded-xl py-2.5">
              <div className="text-base font-black text-fg">{stats[key] ?? 0}</div>
              <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Nota Media</span>
          <span className="text-sm font-black text-green-500">{stats.averageRating || '—'}</span>
        </div>
      </div>

      {stats.competitionBreakdown?.length > 0 && (
        <>
          <SectionHeader emoji="🏆" title="Por Competición" />
          <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
            {stats.competitionBreakdown.map((c, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-fg truncate">{c.competition}</span>
                <span className="text-[9px] font-bold text-fg-faint uppercase tracking-wide shrink-0">PJ {c.matchesPlayed} · G {c.goals} · A {c.assists}{c.averageRating ? ` · ${c.averageRating}` : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="pt-3">
        <AIGlowButton onClick={() => setShowScan(true)}>
          Escanear Estadísticas de Este Jugador
        </AIGlowButton>
      </div>

      {career.length > 0 && (
        <>
          <SectionHeader emoji="📈" title="Historial de Carrera" />
          <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
            {[...career].reverse().map((c) => (
              <button key={c.seasonId} type="button" onClick={() => setExpandedSeason((s) => (s === c.seasonId ? null : c.seasonId))} className="w-full px-4 py-2.5 text-left touch-manipulation">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-fg uppercase">Temporada {c.seasonNumber}</span>
                  <span className={`flex items-center gap-1 text-[10px] font-black shrink-0 ${c.ovrGrowth > 0 ? 'text-green-500' : c.ovrGrowth < 0 ? 'text-red-400' : 'text-fg-faint'}`}>
                    {c.initialOvr} → {c.finalOvr}
                    {c.ovrGrowth !== 0 && (c.ovrGrowth > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
                  </span>
                </div>
                {expandedSeason === c.seasonId && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] font-bold text-fg-faint uppercase tracking-wide animate-in fade-in duration-150">
                    <span>PJ {c.matchesPlayed}</span><span>Goles {c.goals}</span>
                    <span>Asistencias {c.assists}</span><span>Nota {c.averageRating || '—'}</span>
                    <span className="col-span-2">Valor al Cierre: {abbreviateValue(c.marketValueEnd)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {showScan && (
        <PlayerStatsScanModal player={player} onClose={() => setShowScan(false)} onApplied={onStatsUpdated} />
      )}
    </div>
  );
}

export default function PlayerInfoModal({ player, infoSlot, onClose, onEdit, onReplace, onOpenFullDetail, hideMarketStatus = false, hideTacticsActions = false }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { lineup, bench, formation, assignPlayerToSlot, setPlayerTransferStatus, setPlayerToDelete, confirmDeletePlayer } = useClubData();
  const [current, setCurrent] = useState(player);
  // Pestaña activa de la ficha completa (Plantilla/"Ver ficha completa" desde Táctica, ver
  // hideMarketStatus más abajo — la modal de acción rápida de Táctica no llega a mostrar
  // pestañas, se queda con su tarjeta resumida de siempre).
  const [activeTab, setActiveTab] = useState('perfil'); // 'perfil' | 'stats'
  const [showSellModal, setShowSellModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [moreRect, setMoreRect] = useState(null);
  const [showEndLoanConfirm, setShowEndLoanConfirm] = useState(false);
  const moreBtnRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Bandera del país: misma detección por texto libre que usa PlayerForm para la tarjeta de
  // vista previa (sin desplegable, solo lectura aquí).
  const selectedCountry = detectCountry(current.nationality);

  const changeStatus = async (status) => {
    await setPlayerTransferStatus(current.id, status);
    setCurrent({ ...current, transferStatus: status });
  };

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
    setMoreRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right, width: 220 });
    setShowMore(true);
  };

  // "Finalizar Cesión" reutiliza el mismo borrado que confirmDeletePlayer (el jugador cedido
  // entrante no es propiedad del club, así que "eliminarlo" de la plantilla es exactamente
  // devolverlo a su club de origen) — mismo patrón que en la Plantilla.
  const requestEndLoan = () => { setPlayerToDelete(current.id); setShowEndLoanConfirm(true); };
  const cancelEndLoan = () => { setPlayerToDelete(null); setShowEndLoanConfirm(false); };
  const confirmEndLoan = async () => { await confirmDeletePlayer(); setShowEndLoanConfirm(false); onClose(); };

  const emptyBenchIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !bench[i]);
  const canSendToBench = current.transferStatus !== 'CedidoFuera' && !isUncalledZone(infoSlot) && !String(infoSlot).startsWith('bench-') && emptyBenchIdx !== undefined;

  // Contexto Táctica, jugador ya en el banquillo: el botón izquierdo pasa de "Banquillo" a
  // "Titular", buscando el primer hueco libre en el once inicial de la formación actual (mismo
  // criterio de "primer hueco disponible" que ya usa Banquillo, sin exigir coincidencia de
  // posición).
  const isBenchSlot = String(infoSlot).startsWith('bench-');
  const totalLineupSlots = FORMATIONS[formation]?.length || 11;
  const emptyLineupIdx = isBenchSlot ? Array.from({ length: totalLineupSlots }, (_, i) => i).find((i) => !lineup[i]) : undefined;
  const canPromoteToLineup = isBenchSlot && emptyLineupIdx !== undefined;

  // Un jugador cedido a nuestro club (type 'Cedido') no es propiedad del club: nunca puede
  // venderse, cederse ni marcarse como transferible/cedible.
  const isIncomingLoan = current.type === 'Cedido';
  // Un canterano que aún no ha subido al primer equipo (ni en el 11 ni en el banquillo) no
  // participa del mercado — misma regla que en PlayerList.jsx.
  const isCalledUp = Object.values(lineup).includes(current.id) || Object.values(bench).includes(current.id);
  const isUnpromotedCantera = current.type === 'Cantera' && !isCalledUp;

  // Contexto genérico (Plantilla / Mercado): un único grid con todas las acciones. La edición
  // ahora se hace desde el lápiz superior de la cabecera, no como una acción más aquí.
  const actions = [];
  if (current.transferStatus !== 'CedidoFuera' && !isIncomingLoan && !isUnpromotedCantera) actions.push({ key: 'sell', icon: Tag, label: 'Vender', onClick: () => setShowSellModal(true), color: 'red' });
  if (canSendToBench) actions.push({ key: 'bench', icon: Armchair, label: 'Al Banquillo', onClick: () => { assignPlayerToSlot(`bench-${emptyBenchIdx}`, current.id); onClose(); }, color: 'yellow' });
  if (!hideTacticsActions && !isUncalledZone(infoSlot)) {
    actions.push({ key: 'replace', icon: RefreshCcw, label: 'Reemplazar', onClick: () => onReplace(infoSlot), color: 'neutral' });
    actions.push({ key: 'uncalled', icon: Trash2, label: 'No Convocado', onClick: () => { assignPlayerToSlot(infoSlot, null); onClose(); }, color: 'red' });
  }

  // Contexto Táctica: botón principal "Reemplazar" a todo lo ancho, seguido de una fila de 3
  // (Banquillo / No Convocado / "..."). El menú de tres puntos agrupa transferible, cedible,
  // venta y cesión — o, si el jugador está cedido en nuestro club, "Finalizar Cesión" primero
  // y esas 4 opciones deshabilitadas — con exactamente la misma lógica condicional que en la
  // Plantilla (ver PlayerList.jsx: isIncomingLoan = type === 'Cedido').
  const marketMoreActions = [
    { key: 'transferible', icon: Tag, label: 'Mandar a Transferibles', onClick: () => changeStatus('Transferible'), disabled: isIncomingLoan || isUnpromotedCantera },
    { key: 'cedible', icon: ArrowRightLeft, label: 'Mandar a Cedibles', onClick: () => changeStatus('Cedible'), disabled: isIncomingLoan || isUnpromotedCantera },
    { key: 'sell', icon: Tag, label: 'Vender Jugador', onClick: () => setShowSellModal(true), disabled: current.transferStatus === 'CedidoFuera' || isIncomingLoan || isUnpromotedCantera },
    { key: 'loan', icon: ArrowRightLeft, label: 'Ceder Jugador', onClick: () => setShowLoanModal(true), disabled: current.transferStatus === 'CedidoFuera' || isIncomingLoan || isUnpromotedCantera },
  ];
  const moreMenuItems = isIncomingLoan
    ? [{ key: 'endLoan', icon: Undo2, label: 'Finalizar Cesión', onClick: requestEndLoan }, ...marketMoreActions]
    : marketMoreActions;

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative max-h-[88dvh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* En Táctica (acción rápida) el botón de cerrar es más pequeño y sutil, con margen
            extra respecto a la tarjeta (ver "pt-8" del contenedor con scroll más abajo) para
            que nunca se solape con ella; fuera de Táctica mantiene su tamaño habitual. */}
        {hideTacticsActions ? (
          /* Plantilla: "X" y lápiz apilados en una única columna vertical (flex-col), ambos
             dentro del mismo contenedor absoluto — así el lápiz queda garantizado estrictamente
             debajo de la "X", sin depender de calcular offsets "top" por separado. */
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center gap-2">
            <button onClick={onClose} className="p-2 bg-well rounded-full hover:bg-well-strong text-fg-muted hover:text-fg transition-colors"><X size={18} /></button>
            <button onClick={() => onEdit(current)} title="Editar Jugador" className="p-2 rounded-full bg-well text-fg-faint hover:text-blue-500 hover:bg-well-strong transition-colors"><Edit2 size={16} /></button>
          </div>
        ) : (
          <>
            <button onClick={onClose} className={`absolute z-10 bg-well rounded-full hover:bg-well-strong text-fg-muted hover:text-fg transition-colors ${hideMarketStatus ? 'top-3 right-3 p-1.5' : 'top-4 right-4 p-2'}`}><X size={hideMarketStatus ? 14 : 18} /></button>
            {/* Operaciones: único lápiz junto a la "X" en la cabecera del marco exterior. */}
            {!hideMarketStatus && (
              <button onClick={() => onEdit(current)} title="Editar Jugador" className="absolute top-4 right-16 p-2 rounded-full bg-well text-fg-faint hover:text-blue-500 hover:bg-well-strong transition-colors z-10"><Edit2 size={16} /></button>
            )}
          </>
        )}
        {/* Cuerpo con scroll propio: la ficha en modo lectura ahora replica todas las
            secciones del Paso 4 de PlayerForm y puede superar la altura del modal, sobre todo
            en jugadores Cedido. El botón de cerrar (y en Plantilla, también el lápiz) quedan
            fuera de este contenedor, flotando en la esquina superior derecha sin ocupar espacio
            en el flujo — por eso el contenido empieza arriba del todo (pt-1), igual que antes;
            en Plantilla la tarjeta FIFA es más estrecha que la columna de botones y queda
            centrada, así que no hay solape real con ellos. */}
        <div className={`overflow-y-auto no-scrollbar flex-1 min-h-0 ${hideMarketStatus ? 'pt-8' : 'pt-1'}`}>
        {/* Plantilla (hideTacticsActions): cabecera con la misma tarjeta FIFA de vista previa
            que encabeza la pantalla de "Editar Jugador" (Paso 4 de PlayerForm) — media, posición
            principal, bandera, foto, nombre y posiciones secundarias — en modo puramente
            visual/lectura, sin ningún control interactivo. */}
        {hideTacticsActions && (
          <div className="flex flex-col items-center mb-2">
            <div className={`relative w-52 rounded-[28px] p-5 shadow-2xl border-2 border-black/10 ${getCardStyle(current.rating)}`}>
              <div className="flex items-start justify-between">
                <div className="flex flex-col items-center leading-none">
                  <span className="text-4xl font-black">{current.rating}</span>
                  <span className="text-[10px] font-black uppercase mt-1 tracking-wider">{current.positions?.[0]}</span>
                </div>
                {current.nationality && (
                  <span className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-sm leading-none shrink-0 overflow-hidden">{selectedCountry ? flagEmoji(selectedCountry.code) : '🌍'}</span>
                )}
              </div>
              <div className="flex justify-center my-3">
                {current.photo ? (
                  <img src={current.photo} alt="Foto" className="w-20 h-20 rounded-full object-cover border-4 border-black/10 shadow-lg" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-black/10 flex items-center justify-center border-4 border-black/10"><User size={30} /></div>
                )}
              </div>
              <div className="text-center font-black uppercase italic text-sm tracking-tight border-t border-black/10 pt-2 truncate">{current.name}</div>
              {current.positions?.length > 1 && <div className="text-center text-[9px] font-bold uppercase opacity-70 mt-0.5 truncate">{current.positions.slice(1).join(' · ')}</div>}
            </div>
          </div>
        )}
        {/* Tarjeta resumida (badge + nombre + pills): solo en Táctica y Operaciones. En
            Plantilla (hideTacticsActions) se usa en su lugar la tarjeta FIFA de arriba. */}
        {!hideTacticsActions && (
        <div className={`p-4 bg-well rounded-[24px] border border-border-subtle flex flex-col gap-4 relative ${hideMarketStatus ? 'pb-9' : ''}`}>
          {/* En Táctica (acción rápida): el lápiz vive dentro de la propia tarjeta del
              jugador, en su esquina inferior derecha (mismo tamaño compacto que la "X" de
              cerrar), y se desplaza con ella en vez de quedar fijo en el marco exterior. */}
          {hideMarketStatus && (
            <button onClick={() => onEdit(current)} title="Editar Jugador" className="absolute bottom-3 right-3 p-1.5 rounded-full bg-well-strong text-fg-faint hover:text-blue-500 transition-colors z-10"><Edit2 size={14} /></button>
          )}
          <div className="flex items-center gap-4">
            {onOpenFullDetail ? (
              <button
                type="button"
                onClick={() => onOpenFullDetail(current)}
                title="Ver ficha completa"
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black leading-none shadow-lg flex-shrink-0 touch-manipulation active:scale-95 transition-transform ${getCardStyle(current.rating)}`}
              >
                <span className="text-[8px] opacity-70 font-bold mb-0.5">{current.positions?.[0]}</span><span className="text-xl">{current.rating}</span>
              </button>
            ) : (
              <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black leading-none shadow-lg flex-shrink-0 ${getCardStyle(current.rating)}`}><span className="text-[8px] opacity-70 font-bold mb-0.5">{current.positions?.[0]}</span><span className="text-xl">{current.rating}</span></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-black uppercase italic text-lg truncate tracking-tighter leading-tight text-black dark:text-white">{current.name}</div>
              <div className="text-[10px] text-green-500/80 font-black uppercase tracking-widest mb-1 mt-0.5 truncate">{current.positions?.join(' · ')}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1"><span className="text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well-strong px-2 py-0.5 rounded">{current.age} Años</span>{!hideMarketStatus && <span className="text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well-strong px-2 py-0.5 rounded">{current.preferredFoot || 'Diestro'}</span>}{(current.marketValue || current.value) ? <span className="text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well-strong px-2 py-0.5 rounded">{abbreviateValue(current.marketValue || current.value)}</span> : null}{current.type === 'Cedido' ? (<span className="text-[8px] flex items-center gap-1 text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20"><ArrowDownToLine size={10} className="shrink-0" /> Cedido ({formatLoanDuration(current.loanDuration)})</span>) : current.isInitialSquad && !hideMarketStatus ? (<span className="text-[8px] flex items-center gap-1 text-zinc-400 font-black uppercase tracking-wider bg-zinc-500/20 px-2 py-0.5 rounded border border-zinc-500/20"><Shirt size={10} className="shrink-0" /> Ya en el Club</span>) : current.type && !(hideMarketStatus && current.type === 'Comprado') ? (<span className={`text-[8px] flex items-center gap-1 px-2 py-0.5 rounded font-black uppercase tracking-wider ${current.type === 'Cantera' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>{current.type === 'Cantera' && <GraduationCap size={10} className="shrink-0" />} {current.type}</span>) : null}</div>
            </div>
          </div>
        </div>
        )}

        {/* Selector de pestañas: solo fuera de Táctica (hideMarketStatus), donde la ficha
            completa se divide en Perfil/Contrato (lo existente) y Rendimiento/Estadísticas
            (nuevo). La tarjeta resumida de arriba y el modo compacto de Táctica no cambian. */}
        {!hideMarketStatus && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-well rounded-2xl border border-border-subtle">
            <button
              type="button"
              onClick={() => setActiveTab('perfil')}
              className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'perfil' ? 'bg-well-strong text-fg shadow' : 'text-fg-faint hover:text-fg-muted'}`}
            >
              📋 Perfil y Contrato
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stats' ? 'bg-well-strong text-fg shadow' : 'text-fg-faint hover:text-fg-muted'}`}
            >
              📊 Rendimiento
            </button>
          </div>
        )}

        {!hideMarketStatus && activeTab === 'stats' && (
          <PlayerStatsTab
            player={current}
            onStatsUpdated={(patch) => setCurrent((c) => ({ ...c, seasonStats: { ...c.seasonStats, ...patch }, rating: patch.rating ?? c.rating }))}
          />
        )}

        {/* Detalle completo en modo lectura: réplica exacta de la estructura, secciones y
            campos del Paso 4 de PlayerForm.jsx (edición unificada), pero sin lápices
            individuales — la edición se hace siempre desde el único lápiz de la cabecera.
            Solo aplica fuera de Táctica (hideMarketStatus): ahí la ficha se reduce a la
            tarjeta resumida de arriba, sin estos bloques extensos. */}
        {!hideMarketStatus && activeTab === 'perfil' && (
          <>
            <SectionHeader emoji="👤" title="Datos Personales" />
            <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              <DetailRow label="Nombre" value={current.name} />
              <DetailRow label="Nacionalidad" value={current.nationality || 'Sin definir'} />
              <DetailRow label="Edad" value={current.age ? `${current.age} Años` : '—'} />
            </div>

            <SectionHeader emoji="⚽" title="Atributos Deportivos" />
            <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              <DetailRow label="Media (OVR)" value={current.rating || '—'} />
              <DetailRow label="Pierna" value={current.preferredFoot || 'Diestro'} />
              <DetailRow label="Posiciones" value={current.positions?.join(' · ') || '—'} />
              {current.type === 'Cantera' && <DetailRow label="Potencial" value={current.potential || 'Sin definir'} />}
            </div>

            {current.type !== 'Cantera' && (
              <>
                <SectionHeader emoji="💰" title="Economía" />
                <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                  <DetailRow label="Adquisición" value={current.isInitialSquad ? 'Ya en el Club' : current.type} />
                  <DetailRow label="Club de Procedencia" value={current.isInitialSquad ? 'En el Club desde el Inicio' : (current.sourceClub || 'Sin definir')} />
                  <DetailRow label="Relevancia" value={current.agreedRole || 'Sin definir'} />
                  <DetailRow label="Valor de Mercado (€)" value={formatCurrency(current.marketValue || current.value)} />
                  {current.type === 'Comprado' && (
                    <>
                      <DetailRow label="Precio de Compra (€)" value={current.isInitialSquad ? 'No Aplica (Ya en el Club)' : formatCurrency(current.value)} />
                      <WageDetailRow label="Sueldo Semanal (€)" weekly={current.wage} />
                      <DetailRow label="Años Contrato" value={current.contractYears ? `${current.contractYears} Años` : 'Sin definir'} />
                      <DetailRow label="Cláusula de Rescisión (€)" value={formatCurrency(current.releaseClause)} />
                    </>
                  )}
                  {current.type === 'Cedido' && (
                    <>
                      <DetailRow label="Club de Origen" value={current.originClub || 'Sin definir'} />
                      <DetailRow label="Duración Cesión" value={current.loanDuration || 'Sin definir'} />
                      <WageDetailRow label="Sueldo Semanal Total (€)" weekly={current.wage} />
                      <DetailRow label="% Salario Pagado" value={`${current.wagePercentage || 0}%`} />
                      <DetailRow label="¿Opción de Compra?" value={current.buyOption ? `Sí · ${formatCurrency(current.buyOption)}` : 'No'} />
                    </>
                  )}
                </div>
              </>
            )}

            {current.transferStatus === 'CedidoFuera' && current.outboundLoan && (
              <>
                <SectionHeader emoji="🔄" title="Cesión" />
                <div className="w-full bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                  <DetailRow label="Duración de la Cesión" value={current.outboundLoan.duration || 'Sin definir'} />
                  {current.outboundLoan.buyOption ? <DetailRow label="Opción de Compra" value={formatCurrency(current.outboundLoan.buyOption)} /> : null}
                </div>
              </>
            )}
          </>
        )}

        {!hideMarketStatus && !hideTacticsActions && (
          <div className="mt-4 p-3 bg-well rounded-xl border border-border-subtle space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted block">Estado de Mercado</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => changeStatus('Activo')} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${current.transferStatus === 'Activo' || !current.transferStatus ? 'bg-green-500 text-black border-green-500' : 'bg-transparent border-border text-fg-secondary hover:border-fg-muted'}`}>Activo</button>
              <button type="button" onClick={() => changeStatus('Cedible')} disabled={isIncomingLoan || isUnpromotedCantera} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${isIncomingLoan || isUnpromotedCantera ? 'opacity-40 pointer-events-none bg-transparent border-border text-fg-faint' : current.transferStatus === 'Cedible' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent border-border text-fg-secondary hover:border-fg-muted'}`}>Cedible</button>
              <button type="button" onClick={() => changeStatus('Transferible')} disabled={isIncomingLoan || isUnpromotedCantera} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${isIncomingLoan || isUnpromotedCantera ? 'opacity-40 pointer-events-none bg-transparent border-border text-fg-faint' : current.transferStatus === 'Transferible' ? 'bg-red-500 text-black border-red-500' : 'bg-transparent border-border text-fg-secondary hover:border-fg-muted'}`}>Venta</button>
              <button type="button" onClick={() => changeStatus('CedidoFuera')} disabled={isIncomingLoan || isUnpromotedCantera} className={`py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${isIncomingLoan || isUnpromotedCantera ? 'opacity-40 pointer-events-none bg-transparent border-border text-fg-faint' : current.transferStatus === 'CedidoFuera' ? 'bg-zinc-600 text-white border-zinc-600' : 'bg-transparent border-border text-fg-secondary hover:border-fg-muted'}`}>Cedido Fuera</button>
            </div>
          </div>
        )}

        {hideMarketStatus ? (
          <>
            {/* Botón principal a todo lo ancho. */}
            <button
              onClick={() => onReplace(infoSlot)}
              disabled={isUncalledZone(infoSlot)}
              className={`w-full mt-3 py-3.5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all duration-150 border ${isUncalledZone(infoSlot) ? 'opacity-40 pointer-events-none bg-well-strong text-fg-faint border-transparent' : `${ACTION_STYLES.neutral} hover:scale-[1.02] active:scale-95`}`}
            >
              <RefreshCcw size={16} /> Reemplazar
            </button>

            {/* Fila inferior: Banquillo/Titular (izquierda) / No Convocado (centro) / "..."
                (derecha). El botón izquierdo alterna a "Titular" cuando el jugador ya está en
                el banquillo, buscando hueco libre en el once inicial. */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {isBenchSlot ? (
                <button
                  onClick={() => { assignPlayerToSlot(emptyLineupIdx, current.id); onClose(); }}
                  disabled={!canPromoteToLineup}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black uppercase text-[8px] leading-tight text-center transition-all duration-150 border ${!canPromoteToLineup ? 'opacity-40 pointer-events-none bg-well-strong text-fg-faint border-transparent' : `${ACTION_STYLES.neutral} hover:scale-105 active:scale-95`}`}
                >
                  <Shirt size={14} /> Titular
                </button>
              ) : (
                <button
                  onClick={() => { assignPlayerToSlot(`bench-${emptyBenchIdx}`, current.id); onClose(); }}
                  disabled={!canSendToBench}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black uppercase text-[8px] leading-tight text-center transition-all duration-150 border ${!canSendToBench ? 'opacity-40 pointer-events-none bg-well-strong text-fg-faint border-transparent' : `${ACTION_STYLES.neutral} hover:scale-105 active:scale-95`}`}
                >
                  <Armchair size={14} /> Banquillo
                </button>
              )}
              <button
                onClick={() => { assignPlayerToSlot(infoSlot, null); onClose(); }}
                disabled={isUncalledZone(infoSlot)}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black uppercase text-[8px] leading-tight text-center transition-all duration-150 border ${isUncalledZone(infoSlot) ? 'opacity-40 pointer-events-none bg-well-strong text-fg-faint border-transparent' : `${ACTION_STYLES.neutral} hover:scale-105 active:scale-95`}`}
              >
                <Trash2 size={14} /> No Convocado
              </button>
              {/* Cedido a nuestro club: el "..." se sustituye por un acceso directo a
                  "Finalizar Cesión" (misma acción que antes vivía dentro del desplegable),
                  sin menú intermedio. El resto de jugadores conserva el "..." con su
                  desplegable habitual. */}
              {isIncomingLoan ? (
                <button
                  type="button"
                  onClick={requestEndLoan}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black uppercase text-[8px] leading-tight text-center transition-all duration-150 border ${ACTION_STYLES.neutral} hover:scale-105 active:scale-95`}
                >
                  <Undo2 size={14} /> Finalizar
                </button>
              ) : (
                <button
                  ref={moreBtnRef}
                  type="button"
                  onClick={toggleMore}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black uppercase text-[8px] leading-tight text-center transition-all duration-150 border ${ACTION_STYLES.neutral} hover:scale-105 active:scale-95`}
                >
                  <MoreHorizontal size={16} /> Más
                </button>
              )}
            </div>
          </>
        ) : !hideTacticsActions ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {actions.map(({ key, icon: Icon, label, onClick, color }) => (
              <button key={key} onClick={onClick} className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-black uppercase text-[9px] transition-all border ${ACTION_STYLES[color]}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        ) : null}
        </div>
      </div>
      {showMore && moreRect && createPortal(
        <div
          ref={moreMenuRef}
          style={{ position: 'fixed', top: moreRect.top, right: moreRect.right, width: moreRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          {moreMenuItems.map(({ key, icon: Icon, label, onClick, disabled }) => (
            <button key={key} type="button" disabled={disabled} onClick={() => { if (disabled) return; onClick(); setShowMore(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${disabled ? 'text-fg-faint opacity-40 pointer-events-none' : 'text-fg-secondary hover:bg-well'}`}>
              <Icon size={14} className="shrink-0" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
      {showSellModal && <SellPlayerModal player={current} onClose={() => { setShowSellModal(false); onClose(); }} />}
      {showLoanModal && <LoanOutModal player={current} onClose={() => { setShowLoanModal(false); onClose(); }} />}
      {showEndLoanConfirm && (
        <ConfirmModal
          icon={Undo2}
          iconClassName="text-yellow-500"
          title="Finalizar Cesión"
          message={`${current.name} volverá a su club de origen y saldrá de la plantilla. ¿Confirmas la finalización de la cesión?`}
          confirmLabel="Finalizar Cesión"
          confirmClassName="bg-yellow-500 text-black shadow-yellow-500/20 hover:bg-yellow-400"
          onCancel={cancelEndLoan}
          onConfirm={confirmEndLoan}
        />
      )}
    </div>
  );
}
