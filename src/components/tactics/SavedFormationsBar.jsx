import { useState } from 'react';
import { ShieldAlert, Users, Save, Pencil, X } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import ConfirmModal from '../common/ConfirmModal';
import TacticsDropdown from './TacticsDropdown';

export default function SavedFormationsBar() {
  const {
    savedFormations, saveCurrentFormation, updateActiveTactic, activeTacticName,
    formation, lineup, bench,
    loadSavedFormation, formationToDelete, setFormationToDelete, confirmDeleteFormation, renameSavedFormation,
  } = useClubData();
  const [newFormationName, setNewFormationName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [saveMode, setSaveMode] = useState('current');
  const [newTacticNameForSave, setNewTacticNameForSave] = useState('');

  const handleSave = () => {
    if (!newFormationName.trim()) return;
    saveCurrentFormation(newFormationName);
    setNewFormationName('');
  };

  const openSaveChoice = () => { setSaveMode('current'); setNewTacticNameForSave(''); setShowSaveChoice(true); };

  const confirmSaveChoice = async () => {
    if (saveMode === 'new') {
      const trimmed = newTacticNameForSave.trim();
      if (!trimmed) return;
      await saveCurrentFormation(trimmed);
      // Deja la formación recién creada como activa (misma lógica que al cargar un equipo
      // guardado), para que el desplegable la refleje y "Guardar Cambios" no reaparezca
      // de inmediato al coincidir ya con lo guardado.
      loadSavedFormation({ name: trimmed, formation, lineup, bench });
    } else {
      await updateActiveTactic();
    }
    setShowSaveChoice(false);
  };

  // ¿La táctica activa (once/banquillo/no convocados) se separó de lo que hay guardado bajo
  // ese nombre? Si no hay ninguna táctica activa (nunca se guardó, o se vació), no aplica.
  const activePreset = activeTacticName ? savedFormations.find((f) => f.name === activeTacticName) : null;
  const hasPendingChanges = !!activePreset && JSON.stringify({ formation, lineup, bench }) !== JSON.stringify({ formation: activePreset.formation, lineup: activePreset.lineup, bench: activePreset.bench || {} });

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
        {hasPendingChanges ? (
          // Estado modificado: el botón se expande hacia la izquierda, ocupando también el
          // hueco del campo de nombre, para avisar con un texto destacado y guardar en un toque.
          <button onClick={openSaveChoice} title="Guardar cambios de la táctica" className="flex-1 min-w-0 h-9 flex items-center justify-center gap-2 bg-green-500 text-black rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400 font-black uppercase text-xs animate-in fade-in slide-in-from-right-4 duration-200">
            <Save size={14} className="shrink-0" /> Guardar Cambios
          </button>
        ) : (
          <>
            {/* El placeholder hereda por defecto el font-size del propio input, que en móvil
                queda forzado a 16px por la regla global anti-zoom (para que Safari/Chrome no
                hagan zoom al enfocar). Como placeholder:text-xs apunta al pseudo-elemento
                ::placeholder (más específico que esa herencia), reduce solo el texto de
                marcador de posición sin tocar el tamaño real del texto tecleado. */}
            <input type="text" placeholder="Nombre de la táctica..." className="flex-1 min-w-0 h-9 bg-well px-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-xs font-bold text-fg placeholder:text-fg-faint max-md:placeholder:text-xs" value={newFormationName} onChange={(e) => setNewFormationName(e.target.value)} />
            <button onClick={handleSave} title="Guardar táctica" className="shrink-0 h-9 w-9 flex items-center justify-center bg-green-500 text-black rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400">
              <Save size={14} />
            </button>
          </>
        )}
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

      {showSaveChoice && (
        <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSaveChoice(false)}>
          <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2"><Save size={16} /> Guardar Cambios</h3>
              <button type="button" onClick={() => setShowSaveChoice(false)} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
            </div>

            <div className="space-y-2 mb-4">
              <button type="button" onClick={() => setSaveMode('current')} className={`w-full p-4 rounded-2xl border text-left transition-all ${saveMode === 'current' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                <div className="font-black uppercase text-xs">Guardar en {activeTacticName}</div>
                <div className="text-[9px] font-bold mt-0.5 opacity-70 uppercase tracking-widest">Actualiza esta formación existente</div>
              </button>
              <button type="button" onClick={() => setSaveMode('new')} className={`w-full p-4 rounded-2xl border text-left transition-all ${saveMode === 'new' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                <div className="font-black uppercase text-xs">Guardar como Nueva Formación</div>
                <div className="text-[9px] font-bold mt-0.5 opacity-70 uppercase tracking-widest">Crea un equipo independiente</div>
              </button>
            </div>

            {saveMode === 'new' && (
              <input type="text" autoFocus placeholder="Nombre de la nueva táctica..." className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm mb-4" value={newTacticNameForSave} onChange={(e) => setNewTacticNameForSave(e.target.value)} />
            )}

            <button type="button" onClick={confirmSaveChoice} disabled={saveMode === 'new' && !newTacticNameForSave.trim()} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-green-400 transition-all disabled:opacity-40 disabled:pointer-events-none">
              {saveMode === 'current' ? `Guardar en ${activeTacticName}` : 'Guardar Nueva Formación'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
