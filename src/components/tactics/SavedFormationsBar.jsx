import { useState } from 'react';
import { ShieldAlert, Users, Save, Pencil, X } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import ConfirmModal from '../common/ConfirmModal';
import TacticsDropdown from './TacticsDropdown';

export default function SavedFormationsBar() {
  const {
    savedFormations, saveCurrentFormation, activeTacticName,
    loadSavedFormation, formationToDelete, setFormationToDelete, confirmDeleteFormation, renameSavedFormation,
  } = useClubData();
  const [newFormationName, setNewFormationName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleSave = () => {
    if (!newFormationName.trim()) return;
    saveCurrentFormation(newFormationName);
    setNewFormationName('');
  };

  const handleLoadSelect = (name) => {
    const f = savedFormations.find((sf) => sf.name === name);
    if (f) loadSavedFormation(f);
  };

  const startRename = (name) => { setRenaming(name); setRenameValue(name); };

  const confirmRename = async (e) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    await renameSavedFormation(renaming, renameValue.trim());
    setRenaming(null);
  };

  const selectedName = activeTacticName && savedFormations.some((f) => f.name === activeTacticName) ? activeTacticName : '';

  return (
    <div className="flex flex-col gap-3 md:gap-4 mb-2">
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl flex items-center gap-2">
        <input type="text" placeholder="Nombre de la táctica..." className="flex-1 min-w-0 h-9 bg-well px-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint" value={newFormationName} onChange={(e) => setNewFormationName(e.target.value)} />
        <button onClick={handleSave} title="Guardar táctica" className="shrink-0 h-9 w-9 flex items-center justify-center bg-green-500 text-black rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400">
          <Save size={14} />
        </button>
        <TacticsDropdown
          icon={Users}
          value={selectedName}
          options={savedFormations.map((f) => f.name)}
          onChange={handleLoadSelect}
          onEditOption={startRename}
          onDeleteOption={(name) => setFormationToDelete(name)}
          placeholder="Plantillas"
          emptyLabel="Sin equipos guardados"
          wrapperClassName="relative shrink-0"
          triggerClassName="h-9 px-3"
        />
      </div>

      {formationToDelete && (
        <ConfirmModal
          icon={ShieldAlert}
          title="¿Borrar Formación?"
          message={`Se eliminará "${formationToDelete}" de tus tácticas guardadas.`}
          onCancel={() => setFormationToDelete(null)}
          onConfirm={confirmDeleteFormation}
        />
      )}

      {renaming && (
        <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setRenaming(null)}>
          <form onSubmit={confirmRename} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Pencil size={16} /> Renombrar Táctica</h3>
              <button type="button" onClick={() => setRenaming(null)} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
            </div>
            <input type="text" autoFocus required placeholder="Nombre de la táctica..." className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <button type="submit" className="w-full bg-green-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-green-400 transition-all">Guardar Cambios</button>
          </form>
        </div>
      )}
    </div>
  );
}
