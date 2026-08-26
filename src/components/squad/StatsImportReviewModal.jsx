import { useState } from 'react';
import { X, Check, ShieldAlert, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { findBestPlayerMatch } from '../../utils/nameMatch';
import Dropdown from '../common/Dropdown';

// Revisión del escaneo masivo de Estadísticas (ver mapStatsScanResultToUpdate en
// geminiPlayerScan.js): a diferencia de BulkScanReviewModal (que da de ALTA jugadores nuevos),
// aquí cada foto ACTUALIZA a un jugador YA EXISTENTE de la plantilla — el paso clave es
// emparejar el nombre que leyó la IA con el jugador real (findBestPlayerMatch hace una primera
// sugerencia automática; el usuario puede corregirla fila a fila con el desplegable, o excluir
// la fila del todo). "Aplicar" llama a updatePlayerStats por cada fila incluida y emparejada.
export default function StatsImportReviewModal({ results, onClose, onDone }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { players, updatePlayerStats } = useClubData();

  const playerOptions = [{ value: '', label: 'Sin emparejar' }, ...players.map((p) => ({ value: p.id, label: p.name }))];

  const [rows, setRows] = useState(() => (results?.succeeded || []).map((extracted, i) => {
    const match = findBestPlayerMatch(extracted.name, players);
    return {
      id: `stat-${i}`,
      extracted,
      matchedPlayerId: match?.id || '',
      included: !!match,
    };
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const failedRows = results?.failed || [];

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const includedRows = rows.filter((r) => r.included && r.matchedPlayerId);
  const canApply = includedRows.length > 0 && !saving;

  const handleApply = async () => {
    if (!canApply) return;
    setSaving(true);
    setSaveError('');
    try {
      for (const r of includedRows) {
        // name/positions/ratingGrowth/fileName son solo para mostrar y emparejar en esta
        // pantalla — updatePlayerStats espera únicamente los campos reales de seasonStats
        // (más "rating", que sí actualiza la media del jugador si vino en el escaneo).
        const { name: _name, positions: _positions, ratingGrowth: _ratingGrowth, fileName: _fileName, ...statsPatch } = r.extracted;
        // eslint-disable-next-line no-await-in-loop
        await updatePlayerStats(r.matchedPlayerId, statsPatch);
      }
      onDone?.(includedRows.length);
      onClose();
    } catch (err) {
      console.error('Error aplicando estadísticas en lote:', err);
      setSaveError('Se produjo un error guardando las estadísticas. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2">Estadísticas Detectadas</h3>
          {!saving && (<button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>)}
        </div>

        <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar space-y-3">
          <p className="text-[10px] font-bold text-fg-muted">
            Se detectaron <span className="text-fg font-black">{rows.length}</span> foto{rows.length === 1 ? '' : 's'}. Revisa el emparejamiento con tu plantilla antes de aplicar.
          </p>

          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
              <ShieldAlert size={14} className="shrink-0" /><span>{saveError}</span>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="p-8 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Sin resultados aprovechables</div>
          ) : (
            <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              {rows.map((r) => {
                const e = r.extracted;
                const growth = e.ratingGrowth;
                return (
                  <div key={r.id} className={`p-3 space-y-2 transition-opacity ${r.included ? '' : 'opacity-40'}`}>
                    <div className="flex items-center gap-2.5">
                      <button type="button" onClick={() => updateRow(r.id, { included: !r.included })} disabled={!r.matchedPlayerId} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors touch-manipulation disabled:opacity-30 ${r.included ? 'border-green-500 bg-green-500' : 'border-border-subtle'}`}>
                        {r.included && <Check size={12} className="text-black" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-fg truncate">{e.name || 'Nombre no detectado'}</div>
                        <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate flex items-center gap-1.5">
                          {e.rating ? <span>Media {e.rating}</span> : null}
                          {growth != null && growth !== 0 && (
                            <span className={`flex items-center gap-0.5 ${growth > 0 ? 'text-green-500' : 'text-red-400'}`}>
                              {growth > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {growth > 0 ? `+${growth}` : growth}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Emparejar con</label>
                        <Dropdown value={r.matchedPlayerId} options={playerOptions} onChange={(v) => updateRow(r.id, { matchedPlayerId: v, included: !!v })} labelClassName="text-[10px]" placeholder="Sin emparejar" />
                      </div>
                      <div className="flex items-end gap-2 text-[9px] font-bold text-fg-faint uppercase tracking-wide pb-2.5">
                        <span>PJ {e.matchesPlayed ?? 0}</span><span>G {e.goals ?? 0}</span><span>A {e.assists ?? 0}</span>
                        {e.averageRating ? <span>MED {e.averageRating}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {failedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-red-400">
                <ShieldAlert size={12} className="shrink-0" /> Fotos No Reconocidas ({failedRows.length})
              </div>
              <div className="bg-well rounded-2xl border border-red-500/20 divide-y divide-border-subtle overflow-hidden">
                {failedRows.map((f, i) => (
                  <div key={i} className="p-3 flex items-center gap-2 text-[9px] font-bold text-fg-faint">
                    <AlertTriangle size={13} className="text-yellow-500 shrink-0" />
                    <span className="truncate">{f.fileName}{f.error ? ` — ${f.error}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={!canApply} onClick={handleApply} className="flex-1 w-full py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-400 transition-all disabled:opacity-50 touch-manipulation">
            {saving ? 'Aplicando...' : (<><Check size={16} className="shrink-0" /> Aplicar Estadísticas ({includedRows.length})</>)}
          </button>
        </footer>
      </div>
    </div>
  );
}
