import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Shirt, Users, ArrowRightLeft, Tag, ShieldAlert, ArrowUpDown, Star, DollarSign, Calendar, ArrowDownAZ } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue, formatLoanDuration } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import PlayerForm from './PlayerForm';
import PlayerInfoModal from './PlayerInfoModal';
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
  const [infoPlayer, setInfoPlayer] = useState(null);
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

  const openNewForm = () => { setEditingPlayer(null); setFormPrefill(null); setFormSourceScoutId(null); setShowForm(true); };
  const openEditForm = (p) => { setEditingPlayer(p); setFormPrefill(null); setFormSourceScoutId(null); setShowForm(true); setInfoPlayer(null); };

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
          <div key={p.id} className="p-3 md:p-4 flex items-center justify-between group hover:bg-well/50 transition-all gap-4">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0] || p.pos}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
              <div className="flex-1 min-w-0">
                <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight flex items-center gap-2 text-black dark:text-white">{p.name}</div>
                <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest mb-1">{p.positions?.join(' · ') || p.pos}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{p.age} Años</span>
                  {p.marketValue && (<span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(p.marketValue)}</span>)}
                  {p.type === 'Cedido' ? (<span className="text-[7px] md:text-[8px] text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">Cedido ({formatLoanDuration(p.loanDuration)})</span>) : p.type ? (<span className={`text-[7px] md:text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${p.type === 'Cantera' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>{p.type}</span>) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {Object.values(lineup).includes(p.id) ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-green-500/20 text-green-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-green-500/20"><Shirt size={12} /> <span className="hidden sm:inline">Titular</span><span className="sm:hidden">11</span></span>) : Object.values(bench).includes(p.id) ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-blue-500/20 text-blue-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-blue-500/20"><Users size={12} /> <span className="hidden sm:inline">Banquillo</span><span className="sm:hidden">Banq</span></span>) : p.transferStatus === 'Cedible' ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-yellow-500/20"><ArrowRightLeft size={12} /> Cedible</span>) : p.transferStatus === 'Transferible' ? (<span className="text-[8px] md:text-[9px] flex items-center gap-1.5 bg-red-500/20 text-red-400 px-2 md:px-3 py-1 rounded-lg uppercase font-black tracking-widest border border-red-500/20"><Tag size={12} /> Venta</span>) : null}
              <div className="flex gap-1 mt-1"><button onClick={() => openEditForm(p)} className="p-1.5 md:p-2 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-xl"><Edit2 size={14} /></button><button onClick={() => setPlayerToDelete(p.id)} className="p-1.5 md:p-2 text-fg-faint hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button></div>
            </div>
          </div>
        ))}
      </div>

      {loanedOutPlayers.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border space-y-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300">
          <div className="px-2 flex items-center gap-2 text-zinc-400"><ArrowRightLeft size={14} /><h3 className="text-xs font-black uppercase tracking-widest italic">Jugadores Cedidos a otros Clubes</h3></div>
          <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
            {loanedOutPlayers.map((p) => (
              <div key={p.id} className="p-3 md:p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0]}</span><span className="text-lg md:text-xl">{p.rating}</span></div>
                  <div className="flex-1 min-w-0"><div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{p.name}</div><div className="text-[8px] md:text-[9px] text-zinc-500 font-black uppercase tracking-widest">{p.positions?.join(' · ')}</div><div className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="text-[8px] md:text-[9px] text-zinc-600 font-black bg-well px-2 py-0.5 rounded">Cedido</span>{p.loanDuration && (<span className="text-[8px] md:text-[9px] text-zinc-500 font-black bg-well px-2 py-0.5 rounded">{formatLoanDuration(p.loanDuration)}</span>)}</div></div>
                </div>
                <div className="flex items-center gap-2"><button onClick={() => setInfoPlayer(p)} className="p-1.5 md:p-2 text-zinc-500 hover:text-fg transition-colors bg-well rounded-xl"><Edit2 size={14} /></button><button onClick={() => setPlayerToDelete(p.id)} className="p-1.5 md:p-2 text-zinc-500 hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <PlayerForm editingPlayer={editingPlayer} prefill={formPrefill} sourceScoutId={formSourceScoutId} onClose={() => setShowForm(false)} />}
      {infoPlayer && <PlayerInfoModal player={infoPlayer} infoSlot="uncalled" onClose={() => setInfoPlayer(null)} onEdit={openEditForm} onReplace={() => {}} />}

      {playerToDelete && (
        <ConfirmModal
          icon={ShieldAlert}
          title="¿Borrar Jugador?"
          message="Esta acción es irreversible y se quitará de tus tácticas."
          onCancel={() => setPlayerToDelete(null)}
          onConfirm={confirmDeletePlayer}
        />
      )}
    </div>
  );
}
