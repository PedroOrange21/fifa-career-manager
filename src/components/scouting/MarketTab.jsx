import { useState } from 'react';
import { Plus, Edit2, Trash2, UserPlus, ShieldAlert, BookUser } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { formatValueInput, abbreviateValue } from '../../utils/format';
import ScoutForm from './ScoutForm';
import ConfirmModal from '../common/ConfirmModal';

const PRIORITY_RANK = { Alta: 0, Media: 1, Baja: 2 };
const PRIORITY_STYLE = {
  Alta: 'bg-red-500/20 text-red-400 border-red-500/20',
  Media: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Baja: 'bg-well-strong text-fg-muted border-border',
};

export default function MarketTab({ onSignScout }) {
  const { shortlist, scoutToDelete, setScoutToDelete, confirmDeleteScout } = useClubData();
  const [showForm, setShowForm] = useState(false);
  const [editingScout, setEditingScout] = useState(null);

  const sorted = [...shortlist].sort((a, b) => {
    const rank = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    if (rank !== 0) return rank;
    return (b.rating || 0) - (a.rating || 0);
  });

  const openNewForm = () => { setEditingScout(null); setShowForm(true); };
  const openEditForm = (s) => { setEditingScout(s); setShowForm(true); };

  const signScout = (s) => {
    onSignScout({
      name: s.name,
      positions: s.positions || (s.position ? [s.position] : []),
      age: s.age ? String(s.age) : '',
      rating: s.rating ? String(s.rating) : '',
      marketValue: formatValueInput(String(s.estimatedValue || '')),
      type: 'Comprado',
      value: '',
      originClub: s.originClub || '',
    }, s.id);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest flex items-center gap-2"><BookUser size={14} /> {shortlist.length} Jugadores Ojeados</span>
      </div>

      <button onClick={openNewForm} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
        <Plus size={16} /> Añadir Jugador Ojeado
      </button>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sorted.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Libreta Vacía</div>)}
        {sorted.map((s) => (
          <div key={s.id} className="p-3 md:p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{s.name}</div>
                <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest mb-1">{(s.positions || (s.position ? [s.position] : [])).join(' · ')}{s.originClub ? ` · ${s.originClub}` : ''}</div>
              </div>
              <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider border shrink-0 ${PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.Media}`}>{s.priority || 'Media'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {s.age ? <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{s.age} Años</span> : null}
              {s.rating ? <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">Media {s.rating}</span> : null}
              {s.potential ? <span className="text-[8px] md:text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Potencial {s.potential}</span> : null}
              {s.estimatedValue > 0 && <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(s.estimatedValue)}</span>}
            </div>
            {s.notes && <p className="text-xs text-fg-secondary italic">{s.notes}</p>}
            <div className="flex gap-2">
              <button onClick={() => signScout(s)} className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-500 font-black uppercase text-[10px] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 border border-green-500/20"><UserPlus size={14} /> Fichar</button>
              <button onClick={() => openEditForm(s)} className="p-2.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-xl"><Edit2 size={14} /></button>
              <button onClick={() => setScoutToDelete(s.id)} className="p-2.5 text-fg-faint hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && <ScoutForm editingScout={editingScout} onClose={() => setShowForm(false)} />}

      {scoutToDelete && (
        <ConfirmModal
          icon={ShieldAlert}
          title="¿Borrar Ojeado?"
          message="Se eliminará esta ficha de la libreta de ojeadores."
          onCancel={() => setScoutToDelete(null)}
          onConfirm={confirmDeleteScout}
        />
      )}
    </div>
  );
}
