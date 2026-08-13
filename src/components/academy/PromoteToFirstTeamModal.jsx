import { useState } from 'react';
import { X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { formatValueInput, parseValue } from '../../utils/format';
import Dropdown from '../common/Dropdown';

const CONTRACT_YEAR_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Año${n > 1 ? 's' : ''}` }));
const DEFAULT_CONTRACT_YEARS = '3';

// Firma del primer contrato profesional al promover a un canterano: ficha con Sueldo Mensual,
// Años de Contrato y Cláusula de Rescisión (opcional), igual que un jugador "Comprado" normal.
// Al confirmar, el jugador se convoca al banquillo (si hay hueco), pasa a tipo "Comprado" (ya
// no participa de las reglas de Cantera) y pierde su rango de potencial numérico, que deja de
// aplicar una vez es un profesional del primer equipo con contrato propio.
export default function PromoteToFirstTeamModal({ player, onClose }) {
  useBodyScrollLock();
  const { bench, assignPlayerToSlot, addOrUpdatePlayer } = useClubData();
  const [wage, setWage] = useState('');
  const [contractYears, setContractYears] = useState(DEFAULT_CONTRACT_YEARS);
  const [releaseClause, setReleaseClause] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wage || parseValue(wage) <= 0) { setError('El sueldo mensual es obligatorio.'); return; }
    if (!contractYears) { setError('Selecciona los años de contrato.'); return; }
    setError('');
    setIsSaving(true);
    try {
      const alreadyCalledUp = Object.values(bench).includes(player.id);
      if (!alreadyCalledUp) {
        const emptyBenchIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !bench[i]);
        if (emptyBenchIdx !== undefined) assignPlayerToSlot(`bench-${emptyBenchIdx}`, player.id);
      }
      await addOrUpdatePlayer({
        type: 'Comprado',
        value: 0,
        wage: parseValue(wage),
        contractYears: parseInt(contractYears),
        releaseClause: parseValue(releaseClause) || null,
        potential: null,
      }, player.id);
      onClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la promoción. Inténtalo de nuevo.');
      setIsSaving(false);
    }
  };

  // Se considera "modificado" en cuanto se ha escrito algo en sueldo/cláusula o se ha
  // cambiado la duración por defecto del contrato; en ese caso la "X" pide confirmación
  // antes de descartar, en vez de cerrar directamente.
  const isDirty = !!wage || !!releaseClause || contractYears !== DEFAULT_CONTRACT_YEARS;
  const handleCloseClick = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };

  return (
    <>
      {/* Sin onClick en el fondo: se cierra única y exclusivamente con el botón "X" (mismo
          patrón que PlayerForm), para que ningún clic/touch que llegue a burbujear hasta aquí
          — p. ej. al seleccionar una opción del desplegable de Años de Contrato, pintado en un
          portal fuera de este árbol DOM — pueda cerrar el modal entero por accidente. */}
      <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2"><ShieldCheck size={16} /> Contrato Profesional</h3>
            <button type="button" onClick={handleCloseClick} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          </div>
          <p className="text-[10px] text-fg-muted font-bold mb-5">Sube a {player.name} al primer equipo con su primer contrato profesional.</p>

          {error && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 text-red-400 text-[10px] font-black">{error}</div>}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-fg-muted ml-1">Sueldo Mensual (€) *</label>
              <input autoFocus type="text" inputMode="numeric" required placeholder="Ej: 500.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-blue-400 font-black text-center text-fg text-base md:text-sm placeholder:text-fg-faint" value={wage} onChange={(e) => setWage(formatValueInput(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-fg-muted ml-1">Años de Contrato *</label>
              <Dropdown value={contractYears} options={CONTRACT_YEAR_OPTIONS} onChange={setContractYears} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-fg-muted ml-1">Cláusula de Rescisión (€) — Opcional</label>
              <input type="text" inputMode="numeric" placeholder="Ej: 150.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-blue-400 font-black text-center text-fg text-base md:text-sm placeholder:text-fg-faint" value={releaseClause} onChange={(e) => setReleaseClause(formatValueInput(e.target.value))} />
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-blue-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-blue-400 transition-all disabled:opacity-50">{isSaving ? 'Guardando...' : 'Confirmar Promoción'}</button>
        </form>
      </div>

      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/90 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-fg">¿Deseas salir?</h3>
            <p className="text-[10px] text-fg-muted mb-6 font-bold uppercase tracking-widest">Se perderán los datos del contrato introducidos.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all touch-manipulation">Cancelar</button>
              <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all touch-manipulation">Salir y Descartar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
