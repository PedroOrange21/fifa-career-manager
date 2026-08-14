import { useState } from 'react';
import { Plus, Edit2, Trash2, UserPlus, User, ShieldAlert, Target } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { formatValueInput, abbreviateValue } from '../../utils/format';
import TargetForm from './TargetForm';
import ConfirmModal from '../common/ConfirmModal';

const STATUS_RANK = { 'Prioridad Alta': 0, Negociando: 1, Seguimiento: 2 };
const STATUS_STYLE = {
  Seguimiento: 'bg-well-strong text-fg-muted border-border',
  Negociando: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  'Prioridad Alta': 'bg-red-500/20 text-red-400 border-red-500/20',
};

// Lista de Seguimiento / Objetivos de Mercado (antes "Operaciones"): jugadores externos a
// seguir, con acción directa de "Fichar" que abre el modal de fichaje normal (efectos
// económicos completos: descuenta presupuesto y registra transacción, sin skipInitialTransaction
// — solo el asistente de configuración inicial del club omite esos efectos).
export default function OperationsTab({ onSignTarget }) {
  const { targets, targetToDelete, setTargetToDelete, confirmDeleteTarget } = useClubData();
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);

  const sorted = [...targets].sort((a, b) => {
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
      positions: t.positions || (t.position ? [t.position] : []),
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
      <div className="flex justify-between items-center px-2">
        <span className="text-[10px] text-fg-muted font-black uppercase tracking-widest flex items-center gap-2"><Target size={14} /> {targets.length} Objetivos en Seguimiento</span>
      </div>

      <button onClick={openNewForm} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
        <Plus size={16} /> Añadir Objetivo
      </button>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
        {sorted.length === 0 && (<div className="p-16 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin Objetivos Todavía</div>)}
        {sorted.map((t) => (
          <div key={t.id} className="p-3 md:p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {t.photo ? (
                <img src={t.photo} alt={t.name} className="w-11 h-11 rounded-full object-cover border border-border-subtle shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-well flex items-center justify-center border border-border-subtle shrink-0"><User size={18} className="text-fg-faint" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight text-black dark:text-white">{t.name}</div>
                <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest truncate">{(t.positions || (t.position ? [t.position] : [])).join(' · ')}{t.originClub ? ` · ${t.originClub}` : ''}</div>
              </div>
              <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider border shrink-0 ${STATUS_STYLE[t.status] || STATUS_STYLE.Seguimiento}`}>{t.status || 'Seguimiento'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {t.age ? <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{t.age} Años</span> : null}
              {t.rating ? <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">Media {t.rating}</span> : null}
              {t.estimatedValue > 0 && <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(t.estimatedValue)}</span>}
              {t.wage > 0 && <span className="text-[8px] md:text-[9px] text-fg-muted font-black uppercase tracking-widest bg-well px-2 py-0.5 rounded">{abbreviateValue(t.wage)}/mes</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => signTarget(t)} className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-500 font-black uppercase text-[10px] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 border border-green-500/20"><UserPlus size={14} /> Fichar</button>
              <button onClick={() => openEditForm(t)} className="p-2.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-xl"><Edit2 size={14} /></button>
              <button onClick={() => setTargetToDelete(t.id)} className="p-2.5 text-fg-faint hover:text-red-500 transition-colors bg-well rounded-xl"><Trash2 size={14} /></button>
            </div>
          </div>
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
