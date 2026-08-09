import { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { formatValueInput, parseValue } from '../../utils/format';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const emptyPlayer = { name: '', rating: '', positions: [], age: '', preferredFoot: 'Diestro', marketValue: '', type: 'Comprado', value: '', loanDuration: '1 Temporada', originClub: '', wage: '', potential: '' };

const playerToFormState = (p) => ({
  name: p.name, rating: p.rating || '', positions: p.positions || (p.pos ? [p.pos] : []), age: p.age || '', preferredFoot: p.preferredFoot || 'Diestro',
  marketValue: formatValueInput(String(p.marketValue || p.value || '')), type: p.type || 'Comprado', value: formatValueInput(String(p.value || '')),
  loanDuration: p.loanDuration || '1 Temporada', originClub: p.originClub || '', wage: formatValueInput(String(p.wage || '')), potential: p.potential || '',
});

export default function PlayerForm({ editingPlayer, prefill, sourceScoutId, onClose }) {
  useBodyScrollLock();
  const { addOrUpdatePlayer, deleteScout } = useClubData();
  const [newPlayer, setNewPlayer] = useState(editingPlayer ? playerToFormState(editingPlayer) : prefill ? { ...emptyPlayer, ...prefill } : emptyPlayer);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePosition = (pos) => {
    let current = [...newPlayer.positions];
    if (pos === 'POR') { current = ['POR']; }
    else { current = current.filter((p) => p !== 'POR'); if (current.includes(pos)) { current = current.filter((p) => p !== pos); } else { current.push(pos); } }
    setNewPlayer({ ...newPlayer, positions: current });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newPlayer.name || !newPlayer.name.trim()) return setFormError('El nombre es obligatorio.');
    if (!newPlayer.positions || newPlayer.positions.length === 0) return setFormError('Selecciona una posición.');
    if (!newPlayer.rating || isNaN(newPlayer.rating) || newPlayer.rating < 1 || newPlayer.rating > 99) return setFormError('Media entre 1 y 99.');
    if (!newPlayer.age || isNaN(newPlayer.age) || newPlayer.age < 15 || newPlayer.age > 50) return setFormError('Edad entre 15 y 50.');
    if (!newPlayer.marketValue || parseValue(newPlayer.marketValue) <= 0) return setFormError('Valor de mercado obligatorio.');
    if (newPlayer.type === 'Comprado' && (!newPlayer.value || parseValue(newPlayer.value) <= 0)) return setFormError('Precio de compra obligatorio.');
    if (newPlayer.type === 'Cedido' && (!newPlayer.originClub || !newPlayer.originClub.trim())) return setFormError('Club de origen obligatorio.');
    if (newPlayer.type === 'Cantera' && newPlayer.potential && (isNaN(newPlayer.potential) || newPlayer.potential < 1 || newPlayer.potential > 99)) return setFormError('Potencial entre 1 y 99.');

    setFormError('');
    setIsSubmitting(true);
    try {
      await addOrUpdatePlayer({
        name: newPlayer.name.trim(), rating: parseInt(newPlayer.rating), positions: newPlayer.positions, age: parseInt(newPlayer.age),
        preferredFoot: newPlayer.preferredFoot || 'Diestro', marketValue: parseValue(newPlayer.marketValue), type: newPlayer.type,
        value: newPlayer.type === 'Comprado' ? parseValue(newPlayer.value) : 0, loanDuration: newPlayer.type === 'Cedido' ? newPlayer.loanDuration : null,
        originClub: newPlayer.type === 'Cedido' ? newPlayer.originClub.trim() : null, transferStatus: 'Activo',
        wage: parseValue(newPlayer.wage),
        potential: newPlayer.type === 'Cantera' && newPlayer.potential ? parseInt(newPlayer.potential) : null,
      }, editingPlayer?.id);
      if (!editingPlayer && sourceScoutId) {
        try { await deleteScout(sourceScoutId); } catch (err) { console.error(err); }
      }
      onClose();
    } catch (err) {
      setFormError('Error de base de datos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 overscroll-contain" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative my-auto flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="font-black italic text-green-500 text-sm uppercase">{editingPlayer ? 'Editar Jugador' : 'Nuevo Jugador'}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>

        {formError && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse shrink-0"><ShieldAlert size={14} className="shrink-0" /><span>{formError}</span></div>}

        <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1 pb-4 overscroll-contain">
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label><input type="text" required autoComplete="off" placeholder="Ej: Erling Haaland" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} /></div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones * (Toca varias)</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
              {ALL_POSITIONS.map((pos) => (<button key={pos} type="button" onClick={() => togglePosition(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${newPlayer.positions.includes(pos) ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Media *</label><input type="number" required placeholder="90" min="1" max="99" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={newPlayer.rating} onChange={(e) => setNewPlayer({ ...newPlayer, rating: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Edad *</label><input type="number" required placeholder="23" min="15" max="50" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={newPlayer.age} onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Pierna</label><select className="w-full h-14 bg-surface rounded-xl outline-none border border-border-subtle text-center font-black text-base md:text-[10px] text-fg" value={newPlayer.preferredFoot} onChange={(e) => setNewPlayer({ ...newPlayer, preferredFoot: e.target.value })}><option value="Diestro">Diestro</option><option value="Zurdo">Zurdo</option><option value="Ambas">Ambas</option></select></div>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Valor de Mercado (€) *</label><input type="text" required placeholder="Ej: 80.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={newPlayer.marketValue} onChange={(e) => setNewPlayer({ ...newPlayer, marketValue: formatValueInput(e.target.value) })} /></div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Salario Anual (€)</label><input type="text" placeholder="Ej: 5.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={newPlayer.wage} onChange={(e) => setNewPlayer({ ...newPlayer, wage: formatValueInput(e.target.value) })} /></div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Tipo de Adquisición</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewPlayer({ ...newPlayer, type: 'Cantera' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Cantera' ? 'bg-emerald-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cantera</button>
              <button type="button" onClick={() => setNewPlayer({ ...newPlayer, type: 'Cedido' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Cedido' ? 'bg-yellow-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cedido</button>
              <button type="button" onClick={() => setNewPlayer({ ...newPlayer, type: 'Comprado' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Comprado' ? 'bg-blue-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Comprado</button>
            </div>
          </div>
          {newPlayer.type === 'Cantera' && (<div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Potencial (1-99)</label><input type="number" min="1" max="99" placeholder="Ej: 88" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={newPlayer.potential} onChange={(e) => setNewPlayer({ ...newPlayer, potential: e.target.value })} /></div>)}
          {newPlayer.type === 'Comprado' && (<div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra (€) *</label><input type="text" required placeholder="Ej: 50.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={newPlayer.value} onChange={(e) => setNewPlayer({ ...newPlayer, value: formatValueInput(e.target.value) })} /></div>)}
          {newPlayer.type === 'Cedido' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Duración Cesión</label><select className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-black text-base md:text-xs text-fg" value={newPlayer.loanDuration} onChange={(e) => setNewPlayer({ ...newPlayer, loanDuration: e.target.value })}><option value="6 Meses">6 Meses</option><option value="1 Temporada">1 Temporada</option><option value="2 Temporadas">2 Temporadas</option></select></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Club de Origen *</label><input type="text" required placeholder="Ej: Real Madrid" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-base md:text-sm text-fg placeholder:text-fg-faint" value={newPlayer.originClub} onChange={(e) => setNewPlayer({ ...newPlayer, originClub: e.target.value })} /></div>
            </div>
          )}
          <button type="submit" disabled={isSubmitting} className="w-full bg-green-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-green-400 shrink-0 disabled:opacity-50">{isSubmitting ? 'Guardando...' : editingPlayer ? 'Guardar Cambios' : 'Añadir a la Plantilla'}</button>
        </div>
      </form>
    </div>
  );
}

export { emptyPlayer, playerToFormState };
