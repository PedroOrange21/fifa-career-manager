import { useEffect, useState } from 'react';
import { ShieldAlert, Users, Save, Pencil, X } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useUiChrome } from '../../context/UiChromeContext';
import ConfirmModal from '../common/ConfirmModal';
import TacticsDropdown from './TacticsDropdown';

export default function SavedFormationsBar() {
  const {
    savedFormations, saveCurrentFormation, updateActiveTactic, activeTacticName,
    formation, lineup, bench,
    loadSavedFormation, formationToDelete, setFormationToDelete, confirmDeleteFormation, renameSavedFormation,
  } = useClubData();
  const { hide: hideChrome, show: showChrome } = useUiChrome();
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [saveMode, setSaveMode] = useState('current');
  const [newTacticNameForSave, setNewTacticNameForSave] = useState('');

  // Modal de guardar cambios a pantalla limpia: oculta cabecera y barra de navegación
  // inferior mientras está abierta, igual que el resto de modales de pantalla completa.
  useEffect(() => {
    if (!showSaveChoice) return;
    hideChrome();
    return () => showChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSaveChoice]);

  // Modal de renombrar táctica, también a pantalla limpia.
  useEffect(() => {
    if (!renaming) return;
    hideChrome();
    return () => showChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming]);

  // La confirmación de borrado de táctica usa el ConfirmModal compartido, que ya oculta la
  // cabecera y la navegación por sí mismo (useAutoHideChrome) — no hace falta gestionarlo aquí.

  // Sin táctica activa (primer guardado) no hay nada que "actualizar", así que el modal se
  // abre directamente en modo "nueva formación" — ahí es donde ahora se define el nombre.
  const openSaveChoice = () => { setSaveMode(activeTacticName ? 'current' : 'new'); setNewTacticNameForSave(''); setShowSaveChoice(true); };

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
  // Sin ningún equipo guardado todavía, el botón arranca en formato grande (icono + texto)
  // para que la acción principal de guardado sea evidente desde el primer momento; en cuanto
  // exista al menos un equipo guardado, vuelve a la lógica dinámica de siempre (compacto en
  // reposo, expandido solo con cambios pendientes).
  const showExpandedSave = hasPendingChanges || savedFormations.length === 0;

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
      {/* overflow visible a propósito (sin overflow-x-auto): el desplegable abre su lista de
          opciones en "position: absolute" por debajo de este contenedor, y un overflow-x-auto
          aquí fuerza a los navegadores a tratar también el eje Y como recortado, dejando la
          lista oculta detrás de la tarjeta. Los nombres largos ya no truncan (ver
          TacticsDropdown), así que no hace falta scroll horizontal como red de seguridad. */}
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl flex items-center gap-2">
        {/* El desplegable es SIEMPRE flex-1/w-full (móvil y escritorio, con o sin cambios
            pendientes), extendiéndose de forma continua hasta el botón de Guardar equipo sin
            dejar ningún hueco vacío intermedio — el propio flex-1 se encoge automáticamente
            (min-w-0) para cederle espacio al botón cuando este se expande con texto. */}
        <TacticsDropdown
          icon={Users}
          value={selectedName}
          options={savedFormations.map((f) => f.name)}
          onChange={handleLoadSelect}
          onEditOption={startRename}
          onDeleteOption={(name) => setFormationToDelete(name)}
          placeholder="Plantillas"
          emptyLabel="Sin equipos guardados"
          wrapperClassName="relative min-w-0 flex-1"
          triggerClassName="h-9 px-3 min-w-max max-w-none w-full transition-all duration-300 ease-in-out"
          triggerColorClassName="bg-well text-fg-secondary hover:bg-well-strong border border-border-subtle dark:bg-black/40 dark:text-white/80 dark:hover:bg-black/60 dark:border-transparent dark:backdrop-blur-sm"
        />
        {/* Altura h-9 igual que el desplegable. Sin "gap" en el flex: con el botón compacto
            (span de texto en max-w-0) un gap seguiría reservando hueco tras el icono y lo
            descentraría; el espaciado hacia el texto lo pone el propio span vía su margen
            izquierdo condicional. Anclado a la derecha por el "justify-between" de la fila, el
            botón crece "hacia dentro" (izquierda) al expandirse, sin desplazarse de bloque. */}
        <button onClick={openSaveChoice} title="Guardar equipo" className={`shrink-0 h-9 flex items-center justify-center text-center rounded-full bg-green-500 text-black shadow-lg shadow-green-500/20 active:scale-95 transition-all duration-300 ease-in-out hover:bg-green-400 font-black uppercase text-[10px] tracking-wider ${showExpandedSave ? 'px-4' : 'w-9 px-0'}`}>
          <Save size={14} className="shrink-0 mx-auto" />
          <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${showExpandedSave ? 'max-w-[140px] ml-1.5' : 'max-w-0 ml-0'}`}>Guardar Equipo</span>
        </button>
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
              {activeTacticName && (
                <button type="button" onClick={() => setSaveMode('current')} className={`w-full p-4 rounded-2xl border text-left transition-all ${saveMode === 'current' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                  <div className="font-black uppercase text-xs">Actualizar {activeTacticName}</div>
                  <div className="text-[9px] font-bold mt-0.5 opacity-70 uppercase tracking-widest">Actualiza esta formación existente</div>
                </button>
              )}
              <button type="button" onClick={() => setSaveMode('new')} className={`w-full p-4 rounded-2xl border text-left transition-all ${saveMode === 'new' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-well border-border-subtle text-fg-muted hover:bg-well-strong'}`}>
                <div className="font-black uppercase text-xs">Guardar como Nueva Formación</div>
                <div className="text-[9px] font-bold mt-0.5 opacity-70 uppercase tracking-widest">Crea un equipo independiente</div>
              </button>
            </div>

            {saveMode === 'new' && (
              <input type="text" autoFocus placeholder="Nombre de la nueva táctica..." className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm mb-4" value={newTacticNameForSave} onChange={(e) => setNewTacticNameForSave(e.target.value)} />
            )}

            <button type="button" onClick={confirmSaveChoice} disabled={saveMode === 'new' && !newTacticNameForSave.trim()} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-green-400 transition-all disabled:opacity-40 disabled:pointer-events-none">
              {saveMode === 'current' ? `Actualizar ${activeTacticName}` : 'Guardar Nueva Formación'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
