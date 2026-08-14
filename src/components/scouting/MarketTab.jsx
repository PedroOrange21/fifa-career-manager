import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, UserPlus, ShieldAlert, Search, X, MapPin, Radar, Users, Wallet, Flame, Crosshair, Star, Calendar, ArrowUpDown } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { flagEmoji, detectCountry } from '../../constants/countries';
import { getCardStyle } from '../../utils/cardStyle';
import { formatValueInput, abbreviateValue } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import TargetForm, { STATUS_OPTIONS, STATUS_LABELS, STATUS_STYLE } from './TargetForm';
import ConfirmModal from '../common/ConfirmModal';

const STATUS_RANK = { Prioritario: 0, Negociando: 1, Seguimiento: 2, Descartado: 3 };
// Franja de color a la izquierda de la tarjeta: mismo código de color que STATUS_STYLE, para
// distinguir de un vistazo la prioridad sin necesitar leer el badge.
const STATUS_BORDER = {
  Seguimiento: 'border-l-border',
  Negociando: 'border-l-yellow-500',
  Prioritario: 'border-l-red-500',
  Descartado: 'border-l-border-subtle',
};

// Agrupación por línea (POR/DEF/MED/DEL) para el filtro rápido de posición y para calcular
// "posición más buscada" en las estadísticas — más intuitivo que filtrar por cada una de las
// 15 posiciones exactas.
const POSITION_GROUPS = {
  POR: ['POR'],
  DEF: ['DFC', 'LD', 'LI', 'CAD', 'CAI'],
  MED: ['MCD', 'MC', 'MD', 'MI', 'MCO'],
  DEL: ['ED', 'EI', 'SD', 'DC'],
};
const groupOf = (pos) => Object.keys(POSITION_GROUPS).find((g) => POSITION_GROUPS[g].includes(pos)) || null;

const SORT_OPTIONS = [
  { id: 'priority', label: 'Prioridad', icon: Flame },
  { id: 'rating', label: 'Media', icon: Star },
  { id: 'value', label: 'Valor', icon: Wallet },
  { id: 'age', label: 'Edad', icon: Calendar },
];

const positionsOf = (t) => t.positions || (t.primaryPosition ? [t.primaryPosition, ...(t.secondaryPositions || [])] : []);

function StatBlock({ icon: Icon, label, value, accent = 'text-fg' }) {
  return (
    <div className="bg-well/70 rounded-2xl p-3 border border-border-subtle min-w-0">
      <Icon size={14} className={`mb-1.5 ${accent}`} />
      <div className={`text-lg font-black italic truncate ${accent}`}>{value}</div>
      <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint leading-tight mt-0.5">{label}</div>
    </div>
  );
}

// Tarjeta de objetivo — estilo dashboard premium: jerarquía visual clara (badge de media/
// posición con el mismo código de color que Plantilla, franja de prioridad, club destacado,
// economía en bloques con icono, nota de seguimiento integrada si existe) y una botonera de
// acciones directa, sin nada oculto tras un desplegable.
function TargetCard({ t, onSign, onEdit, onDelete }) {
  const positions = positionsOf(t);
  const selectedCountry = detectCountry(t.nationality);

  return (
    <div className={`bg-surface rounded-2xl border border-border-subtle shadow-lg hover:shadow-xl hover:border-green-500/20 transition-all p-3.5 md:p-4 border-l-4 ${STATUS_BORDER[t.status] || STATUS_BORDER.Seguimiento}`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ring-1 ring-black/10 ${getCardStyle(t.rating || 0)}`}>
          <span className="text-[8px] opacity-70 font-bold mb-0.5">{t.primaryPosition || positions[0] || '—'}</span>
          <span className="text-xl">{t.rating || '—'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight flex items-center gap-1.5 text-black dark:text-white">
            <span className="truncate">{t.name}</span>
            {selectedCountry && <span className="text-sm leading-none shrink-0">{flagEmoji(selectedCountry.code)}</span>}
          </div>
          <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest truncate">{positions.join(' · ') || '—'}</div>
        </div>
        <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider border shrink-0 ${STATUS_STYLE[t.status] || STATUS_STYLE.Seguimiento}`}>{STATUS_LABELS[t.status] || STATUS_LABELS.Seguimiento}</span>
      </div>

      {(t.originClub || t.age) && (
        <div className="mt-2.5 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
          {t.originClub && (<><MapPin size={14} className="text-blue-400 shrink-0" /><span className="text-xs font-black text-blue-400 uppercase tracking-wide truncate">{t.originClub}</span></>)}
          {t.age ? <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-blue-300/80">{t.age} Años</span> : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2.5">
        <div className="bg-well rounded-xl px-3 py-2 flex items-center gap-2">
          <Wallet size={13} className="text-fg-faint shrink-0" />
          <div className="min-w-0">
            <div className="text-[7px] font-black uppercase text-fg-faint tracking-widest">Valor</div>
            <div className="text-xs md:text-sm font-black text-fg truncate">{t.estimatedValue > 0 ? abbreviateValue(t.estimatedValue) : 'Sin definir'}</div>
          </div>
        </div>
        <div className="bg-well rounded-xl px-3 py-2 flex items-center gap-2">
          <Wallet size={13} className="text-fg-faint shrink-0" />
          <div className="min-w-0">
            <div className="text-[7px] font-black uppercase text-fg-faint tracking-widest">Salario</div>
            <div className="text-xs md:text-sm font-black text-fg truncate">{t.wage > 0 ? `${abbreviateValue(t.wage)}/mes` : 'Sin definir'}</div>
          </div>
        </div>
      </div>

      {t.notes && (
        <div className="mt-2.5 bg-well/60 rounded-xl px-3 py-2 border border-border-subtle">
          <div className="text-[7px] font-black uppercase text-fg-faint tracking-widest mb-1">Nota de Seguimiento</div>
          <p className="text-xs text-fg-secondary italic line-clamp-3">{t.notes}</p>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button onClick={() => onSign(t)} className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 text-black font-black uppercase text-[10px] shadow-lg shadow-green-500/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2"><UserPlus size={14} /> Fichar</button>
        <button onClick={() => onEdit(t)} className="p-2.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-xl"><Edit2 size={14} /></button>
        <button onClick={() => onDelete(t.id)} className="p-2.5 text-fg-faint hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

export default function MarketTab({ onSignTarget }) {
  const { targets, targetToDelete, setTargetToDelete, confirmDeleteTarget } = useClubData();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionGroup, setPositionGroup] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef(null);
  useOnClickOutside(sortRef, () => setShowSort(false), showSort);

  const filtered = targets
    .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => !positionGroup || positionsOf(t).some((p) => groupOf(p) === positionGroup))
    .filter((t) => !statusFilter || (t.status || 'Seguimiento') === statusFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'value') return (b.estimatedValue || 0) - (a.estimatedValue || 0);
    if (sortBy === 'age') return (a.age || 99) - (b.age || 99);
    const rank = (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2);
    if (rank !== 0) return rank;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Estadísticas rápidas del radar de fichajes: total, presupuesto necesario (objetivos no
  // descartados), posición más repetida y cuántos son prioridad alta.
  const budgetNeeded = targets.filter((t) => t.status !== 'Descartado').reduce((sum, t) => sum + (t.estimatedValue || 0), 0);
  const highPriorityCount = targets.filter((t) => t.status === 'Prioritario').length;
  const topPositionGroup = (() => {
    const counts = {};
    targets.forEach((t) => { const g = groupOf(t.primaryPosition || positionsOf(t)[0]); if (g) counts[g] = (counts[g] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '—';
  })();

  const openNewForm = () => { setEditingTarget(null); setShowForm(true); };
  const openEditForm = (t) => { setEditingTarget(t); setShowForm(true); };

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
      {/* Cabecera de estadísticas rápidas del radar de fichajes. */}
      <div className="bg-gradient-to-br from-surface to-well/40 rounded-[24px] border border-border-subtle shadow-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-muted"><Radar size={15} className="text-green-500" /> Radar de Fichajes</span>
          <button onClick={openNewForm} className="hidden md:flex items-center gap-1.5 bg-green-500 text-black px-3 py-1.5 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-500/20 hover:bg-green-400 active:scale-95 transition-all"><Plus size={14} /> Añadir Objetivo</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatBlock icon={Users} label="Objetivos en Lista" value={targets.length} />
          <StatBlock icon={Wallet} label="Presupuesto Necesario" value={abbreviateValue(budgetNeeded)} accent="text-green-500" />
          <StatBlock icon={Crosshair} label="Posición Más Buscada" value={topPositionGroup} />
          <StatBlock icon={Flame} label="Prioridad Alta" value={highPriorityCount} accent="text-red-400" />
        </div>
      </div>

      {/* Búsqueda, filtros rápidos por línea/estado y ordenación. */}
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" size={14} />
          <input type="text" placeholder="Buscar objetivo por nombre..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint max-md:placeholder:text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button onClick={() => setPositionGroup('')} className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!positionGroup ? 'bg-green-500 text-black' : 'bg-well text-fg-muted border border-border-subtle hover:bg-well-strong'}`}>Todas</button>
          {Object.keys(POSITION_GROUPS).map((g) => (
            <button key={g} onClick={() => setPositionGroup((p) => (p === g ? '' : g))} className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${positionGroup === g ? 'bg-green-500 text-black' : 'bg-well text-fg-muted border border-border-subtle hover:bg-well-strong'}`}>{g}</button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
            <button onClick={() => setStatusFilter('')} className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${!statusFilter ? 'bg-green-500 text-black border-green-500' : 'bg-well text-fg-muted border-border-subtle hover:bg-well-strong'}`}>Todos</button>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => setStatusFilter((f) => (f === s ? '' : s))} className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${statusFilter === s ? STATUS_STYLE[s] : 'bg-well text-fg-muted border-border-subtle hover:bg-well-strong'}`}>{STATUS_LABELS[s]}</button>
            ))}
          </div>
          <div className="relative shrink-0" ref={sortRef}>
            <button onClick={() => setShowSort((o) => !o)} className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border bg-well border-border-subtle text-fg-muted hover:text-fg transition-all" title="Ordenar">
              <ArrowUpDown size={13} />
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5">
                {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => { setSortBy(id); setShowSort(false); }} className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === id ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button onClick={openNewForm} className="md:hidden w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
        <Plus size={16} /> Añadir Objetivo
      </button>

      {sorted.length === 0 ? (
        <div className="bg-surface rounded-[28px] border border-dashed border-border-subtle p-10 md:p-14 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <Radar size={28} className="text-green-500" />
          </div>
          <h3 className="text-base font-black uppercase italic text-fg">{targets.length === 0 ? 'Tu Radar Está Vacío' : 'Sin Resultados'}</h3>
          <p className="text-xs text-fg-muted font-bold max-w-xs">{targets.length === 0 ? 'Empieza a construir tu lista de fichajes soñados: añade el primer futbolista a seguir.' : 'Ajusta la búsqueda o los filtros para encontrar objetivos.'}</p>
          {targets.length === 0 && (
            <button onClick={openNewForm} className="mt-2 bg-green-500 text-black px-5 py-3 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-green-400 active:scale-95 transition-all flex items-center gap-2"><Plus size={16} /> Añadir Primer Objetivo</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((t) => (
            <TargetCard key={t.id} t={t} onSign={signTarget} onEdit={openEditForm} onDelete={setTargetToDelete} />
          ))}
        </div>
      )}

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
