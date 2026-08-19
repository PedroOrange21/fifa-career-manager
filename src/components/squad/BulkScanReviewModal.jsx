import { useState } from 'react';
import { X, Check, ShieldAlert, RefreshCcw, GraduationCap } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { getCardStyle } from '../../utils/cardStyle';
import { buildPlayerPayload } from '../../utils/playerPayload';

// Paso final de la carga masiva con IA (varias fotos escaneadas en cola por
// scanPlayerCardsQueue, ver ScanPlayerCardModal): tabla de revisión con lo que Gemini extrajo
// de cada foto, clasificado y listo para guardar en lote — la "Tabla/resumen" pedida tanto para
// el escaneo múltiple dentro de la app (Primer Equipo o Academia) como para los dos bloques de
// carga masiva de OnboardingWizard, que reutiliza este mismo componente sin más que pasarle
// extraDefaults/skipInitialTransaction distintos.
// - mode: 'primerEquipo' | 'academia' — solo afecta a qué dato secundario se muestra por fila
//   (posición+valor en primer equipo, rango de potencial en academia) y al texto del título.
// - results: { succeeded: [prefill, ...], failed: [{fileName, error}, ...] } — succeeded ya
//   viene con "type" resuelto por Gemini (Comprado/Cedido) en modo primerEquipo, o "Cantera" en
//   modo academia.
// - extraDefaults: se fusiona en cada fila antes de guardarla (p. ej. { isInitialSquad: true,
//   sourceClub: 'En el club desde el inicio' } para "Ya en el Club" o el "Empieza desde Cero"
//   de OnboardingWizard) — nunca se muestra en la tabla, solo se aplica al guardar.
// - skipInitialTransaction: idéntico al de PlayerForm, pasado tal cual a addOrUpdatePlayer.
export default function BulkScanReviewModal({ mode = 'primerEquipo', results, extraDefaults = {}, skipInitialTransaction = false, onClose, onSaved }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { addOrUpdatePlayer } = useClubData();

  // Las filas sin nombre legible no se pueden guardar de forma útil: se separan de entrada
  // junto a los fallos reales de escaneo, en vez de mostrarse como una fila fantasma en la
  // tabla de revisión.
  const rows = (results?.succeeded || []).filter((r) => r.name?.trim());
  const namelessCount = (results?.succeeded?.length || 0) - rows.length;
  const failedCount = (results?.failed?.length || 0) + namelessCount;

  const [excluded, setExcluded] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [saveError, setSaveError] = useState('');

  const toggleRow = (i) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const includedCount = rows.length - excluded.size;

  const handleSaveAll = async () => {
    if (saving || includedCount === 0) return;
    setSaving(true);
    setSaveError('');
    const toSave = rows.filter((_, i) => !excluded.has(i));
    setSaveProgress({ done: 0, total: toSave.length });
    let saved = 0;
    try {
      for (const row of toSave) {
        const payload = buildPlayerPayload({ ...row, ...extraDefaults });
        // eslint-disable-next-line no-await-in-loop
        await addOrUpdatePlayer(payload, undefined, { skipFinancialEffects: skipInitialTransaction });
        saved += 1;
        setSaveProgress({ done: saved, total: toSave.length });
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('Error guardando jugadores en lote:', err);
      setSaveError(`Se guardaron ${saved} de ${toSave.length} antes de fallar. Puedes reintentar con los que falten.`);
      setSaving(false);
    }
  };

  const title = mode === 'academia' ? 'Canteranos Detectados' : 'Jugadores Detectados';
  const noun = mode === 'academia' ? 'canteranos' : 'jugadores';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={saving ? undefined : onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-sm shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2">
            {mode === 'academia' && <GraduationCap size={16} className="shrink-0" />} {title}
          </h3>
          {!saving && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar">
          <p className="text-[10px] font-bold text-fg-muted mb-3">
            Se detectaron <span className="text-fg font-black">{rows.length}</span> {noun}. Desmarca los que no quieras guardar y confirma el resto en un solo paso.
          </p>

          {failedCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center">
              <ShieldAlert size={14} className="shrink-0" /><span>{failedCount} foto{failedCount === 1 ? '' : 's'} no se pudo procesar o no tenía datos legibles.</span>
            </div>
          )}
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center">
              <ShieldAlert size={14} className="shrink-0" /><span>{saveError}</span>
            </div>
          )}

          <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
            {rows.length === 0 ? (
              <div className="p-4 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Sin resultados aprovechables</div>
            ) : rows.map((r, i) => {
              const isOut = excluded.has(i);
              return (
                <button key={i} type="button" onClick={() => toggleRow(i)} disabled={saving} className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-opacity touch-manipulation ${isOut ? 'opacity-40' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(parseInt(r.rating) || 0)}`}>
                    <span className="text-[6px] opacity-70 font-bold">{r.positions?.[0] || '—'}</span><span className="text-[11px]">{r.rating || '—'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-fg truncate">{r.name}</div>
                    <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">
                      {mode === 'academia'
                        ? `${r.positions?.[0] || '—'} · Pot. ${r.potential || '—'} · ${r.age || '—'} Años`
                        : `${r.positions?.[0] || '—'} · ${r.type || 'Comprado'} · ${r.age || '—'} Años`}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isOut ? 'border-border-subtle' : 'border-green-500 bg-green-500'}`}>
                    {!isOut && <Check size={12} className="text-black" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={saving || includedCount === 0} onClick={handleSaveAll} className="flex-1 w-full py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 text-center hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:bg-green-500 touch-manipulation">
            {saving ? (<><RefreshCcw size={16} className="shrink-0 animate-spin" /> Guardando {saveProgress.done} de {saveProgress.total}...</>) : (<><Check size={16} className="shrink-0" /> Guardar Todos ({includedCount})</>)}
          </button>
        </footer>
      </div>
    </div>
  );
}
