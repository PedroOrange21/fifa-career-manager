import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, UserPlus, ShieldAlert, Target, Search, SlidersHorizontal, X, MapPin, ChevronDown } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { ALL_POSITIONS } from '../../constants/positions';
import { getCardStyle } from '../../utils/cardStyle';
import { formatValueInput, abbreviateValue } from '../../utils/format';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
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

const emptyFilters = { position: '', status: '', ageMin: '', ageMax: '', ratingMin: '', ratingMax: '' };

const positionsOf = (t) => t.positions || (t.primaryPosition ? [t.primaryPosition, ...(t.secondaryPositions || [])] : []);

// Misma línea visual que las tarjetas de Plantilla (PlayerRow): badge de Media/Posición,
// nombre en italic uppercase junto a la bandera de nacionalidad, posición en verde debajo.
// Vista compacta por defecto (badge, identificación, posiciones, club/edad/estado); la
// flecha despliega el resto (economía, notas y acciones).
function TargetRow({ t, onSign, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const positions = positionsOf(t);

  return (
    <div className={`bg-surface p-3 md:p-4 border-l-4 ${STATUS_BORDER[t.status] || STATUS_BORDER.Seguimiento}`}>
      <div className="flex items-start gap-3 md:gap-4">
        <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(t.rating || 0)}`}>
          <span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{t.primaryPosition || positions[0] || '—'}</span>
          <span className="text-lg md:text-xl">{t.rating || '—'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{t.name}</div>
          <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest truncate">{positions.join(' · ') || '—'}</div>
        </div>
        {/* Esquina superior derecha: solo el Estado de seguimiento. */}
        <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider border shrink-0 ${STATUS_STYLE[t.status] || STATUS_STYLE.Seguimiento}`}>{STATUS_LABELS[t.status] || STATUS_LABELS.Seguimiento}</span>
      </div>

      {/* Línea única y compacta: club actual, edad, valor de mercado y salario. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {t.originClub && (
          <span className="flex items-center gap-1 text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-wide bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg truncate max-w-[140px]"><MapPin size={11} className="shrink-0" /> {t.originClub}</span>
        )}
        {t.age ? <span className="text-[9px] md:text-[10px] font-black text-fg-muted uppercase tracking-widest bg-well px-2 py-1 rounded-lg">{t.age} Años</span> : null}
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
        <button onClick={() => onSign(t)} className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-500 font-black uppercase text-[10px] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 border border-green-500/20"><UserPlus size={14} /> Fichar</button>
        <button onClick={() => onEdit(t)} className="p-2.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-xl"><Edit2 size={14} /></button>
        <button onClick={() => onDelete(t.id)} className="p-2.5 text-fg-faint hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button>
      </div>

      {/* Flecha de expandir: siempre al final de la tarjeta, debajo de las acciones. */}
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-well transition-colors text-[9px] font-black uppercase tracking-widest touch-manipulation">
        {expanded ? 'Menos Detalle' : 'Más Detalle'} <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
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
          <input type="text" placeholder="Buscar objetivo..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint max-md:placeholder:text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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

      <button onClick={openNewForm} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
        <Plus size={16} /> Añadir Objetivo
      </button>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sorted.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">{targets.length === 0 ? 'Sin Objetivos Todavía' : 'Sin Resultados'}</div>)}
        {sorted.map((t) => (
          <TargetRow key={t.id} t={t} onSign={signTarget} onEdit={openEditForm} onDelete={setTargetToDelete} />
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
