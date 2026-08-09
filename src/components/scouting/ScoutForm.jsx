import { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { formatValueInput, parseValue } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const emptyScout = { name: '', positions: [], age: '', rating: '', potential: '', originClub: '', estimatedValue: '', notes: '', priority: 'Media' };

const scoutToFormState = (s) => ({
  name: s.name, positions: s.positions || (s.position ? [s.position] : []), age: s.age || '', rating: s.rating || '', potential: s.potential || '',
  originClub: s.originClub || '', estimatedValue: formatValueInput(String(s.estimatedValue || '')), notes: s.notes || '', priority: s.priority || 'Media',
});

export default function ScoutForm({ editingScout, onClose }) {
  useBodyScrollLock();
  const { addOrUpdateScout } = useClubData();
  const [scout, setScout] = useState(editingScout ? scoutToFormState(editingScout) : emptyScout);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePosition = (pos) => {
    let current = [...scout.positions];
    if (pos === 'POR') { current = ['POR']; }
    else { current = current.filter((p) => p !== 'POR'); if (current.includes(pos)) { current = current.filter((p) => p !== pos); } else { current.push(pos); } }
    setScout({ ...scout, positions: current });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!scout.name.trim()) return setFormError('El nombre es obligatorio.');
    if (!scout.positions || scout.positions.length === 0) return setFormError('Selecciona al menos una posición.');

    setFormError('');
    setIsSubmitting(true);
    try {
      await addOrUpdateScout({
        name: scout.name.trim(), positions: scout.positions, position: scout.positions[0], age: scout.age ? parseInt(scout.age) : null,
        rating: scout.rating ? parseInt(scout.rating) : null, potential: scout.potential ? parseInt(scout.potential) : null,
        originClub: scout.originClub.trim() || null, estimatedValue: parseValue(scout.estimatedValue),
        notes: scout.notes.trim() || null, priority: scout.priority,
      }, editingScout?.id);
      onClose();
    } catch (err) {
      setFormError('Error de base de datos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 overscroll-contain" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative my-auto flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="font-black italic text-green-500 text-sm uppercase">{editingScout ? 'Editar Ojeado' : 'Nuevo Ojeado'}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>

        {formError && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse shrink-0"><ShieldAlert size={14} className="shrink-0" /><span>{formError}</span></div>}

        <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1 pb-4 overscroll-contain">
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label><input type="text" required autoComplete="off" placeholder="Ej: Kobbie Mainoo" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={scout.name} onChange={(e) => setScout({ ...scout, name: e.target.value })} /></div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones * (Toca varias · POR es excluyente)</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
              {ALL_POSITIONS.map((pos) => (<button key={pos} type="button" onClick={() => togglePosition(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${scout.positions.includes(pos) ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Edad</label><input type="number" min="14" max="50" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={scout.age} onChange={(e) => setScout({ ...scout, age: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Media</label><input type="number" min="1" max="99" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={scout.rating} onChange={(e) => setScout({ ...scout, rating: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Potencial</label><input type="number" min="1" max="99" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={scout.potential} onChange={(e) => setScout({ ...scout, potential: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Club de Origen</label><input type="text" placeholder="Ej: Manchester United" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-base md:text-sm text-fg placeholder:text-fg-faint" value={scout.originClub} onChange={(e) => setScout({ ...scout, originClub: e.target.value })} /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Valor Estimado (€)</label><input type="text" placeholder="Ej: 20.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={scout.estimatedValue} onChange={(e) => setScout({ ...scout, estimatedValue: formatValueInput(e.target.value) })} /></div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Prioridad</label>
            <div className="flex gap-2">
              {['Baja', 'Media', 'Alta'].map((p) => (<button key={p} type="button" onClick={() => setScout({ ...scout, priority: p })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${scout.priority === p ? 'bg-green-500 text-black' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>{p}</button>))}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Notas</label><textarea rows={3} placeholder="Observaciones del ojeador..." className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-sm text-fg placeholder:text-fg-faint resize-none" value={scout.notes} onChange={(e) => setScout({ ...scout, notes: e.target.value })} /></div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-green-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-green-400 shrink-0 disabled:opacity-50">{isSubmitting ? 'Guardando...' : editingScout ? 'Guardar Cambios' : 'Añadir a la Libreta'}</button>
        </div>
      </form>
    </div>
  );
}
