import { useState } from 'react';
import { X, Camera, Image as ImageIcon, ShieldAlert, Check, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { scanPlayerCard, mapStatsScanResultToUpdate } from '../../services/geminiPlayerScan';
import { prepareImageForScan } from '../../utils/imagePrep';

// Actualización individual de estadísticas (Pestaña "Rendimiento y Estadísticas" de la Ficha
// del Jugador): a diferencia del escaneo masivo (ScanPlayerCardModal + StatsImportReviewModal),
// aquí ya se sabe exactamente a qué jugador pertenece la foto — sin emparejamiento por nombre,
// una única foto y una pantalla de confirmación directa antes de aplicar.
export default function PlayerStatsScanModal({ player, onClose, onApplied }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { updatePlayerStats } = useClubData();

  const [status, setStatus] = useState('idle'); // 'idle' | 'scanning' | 'preview' | 'error'
  const [error, setError] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [applying, setApplying] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    setStatus('scanning');
    setError('');
    let preparedFile = file;
    try {
      preparedFile = await prepareImageForScan(file);
    } catch (err) {
      console.error('Error preparando la imagen de estadísticas:', err);
    }
    try {
      const result = await scanPlayerCard(preparedFile, 'estadisticas');
      setExtracted(mapStatsScanResultToUpdate(result));
      setStatus('preview');
    } catch (err) {
      console.error('Error escaneando estadísticas:', err);
      setError(err.message || 'No se pudo analizar la imagen.');
      setStatus('error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  const handleApply = async () => {
    if (!extracted || applying) return;
    setApplying(true);
    try {
      // name/positions/ratingGrowth son solo del propio escaneo (identidad/crecimiento a
      // mostrar aquí) — updatePlayerStats espera únicamente los campos reales de seasonStats.
      const { name: _name, positions: _positions, ratingGrowth: _ratingGrowth, ...statsPatch } = extracted;
      await updatePlayerStats(player.id, statsPatch);
      onApplied?.({ ...statsPatch, rating: extracted.rating });
      onClose();
    } catch (err) {
      console.error('Error aplicando estadísticas:', err);
      setError('No se pudieron guardar las estadísticas. Inténtalo de nuevo.');
      setApplying(false);
    }
  };

  const growth = extracted?.ratingGrowth;

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={status === 'scanning' ? undefined : onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {status === 'preview' && (
              <button type="button" onClick={() => { setStatus('idle'); setExtracted(null); }} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            )}
            <h3 className="font-black italic text-blue-400 text-sm uppercase">Escanear Estadísticas</h3>
          </div>
          {status !== 'scanning' && (<button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>)}
        </div>

        {status === 'scanning' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Analizando con IA...</p>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-well border border-border-subtle">
              <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
                Ve en tu juego a <span className="text-fg font-black">Centro de Plantilla &gt; Estadísticas</span> con <span className="text-fg font-black">{player.name}</span> seleccionado, y haz una foto a su pantalla de rendimiento.
              </p>
            </div>
            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
                <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="space-y-2.5">
              <label className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><Camera size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm text-fg">Tomar Foto</div>
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Usa la cámara de tu móvil ahora mismo.</div>
                </div>
                <input type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
              <label className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle bg-well hover:border-blue-500 hover:bg-well-strong transition-all text-left touch-manipulation cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><ImageIcon size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-black uppercase italic text-sm text-fg">Subir desde Galería</div>
                  <div className="text-[10px] font-bold text-fg-muted mt-0.5">Elige una captura ya guardada.</div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {status === 'preview' && extracted && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-well border border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Media Final</span>
                <span className="flex items-center gap-1.5 text-fg font-black text-sm">
                  {extracted.rating || '—'}
                  {growth != null && growth !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[10px] ${growth > 0 ? 'text-green-500' : 'text-red-400'}`}>
                      {growth > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {growth > 0 ? `+${growth}` : growth}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-subtle">
                {[
                  ['PJ', extracted.matchesPlayed], ['G', extracted.goals], ['A', extracted.assists],
                  ['PI', extracted.cleanSheets], ['TA', extracted.yellowCards], ['TR', extracted.redCards],
                ].map(([label, val]) => (
                  <div key={label} className="text-center bg-well-strong rounded-xl py-2">
                    <div className="text-sm font-black text-fg">{val ?? 0}</div>
                    <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint">{label}</div>
                  </div>
                ))}
              </div>
              {extracted.averageRating ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-fg-faint">Nota Media</span>
                  <span className="text-xs font-black text-green-500">{extracted.averageRating}</span>
                </div>
              ) : null}
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
                <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
              </div>
            )}
            <button type="button" onClick={handleApply} disabled={applying} className="w-full py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-green-400 transition-all disabled:opacity-50 touch-manipulation">
              <Check size={16} /> {applying ? 'Guardando...' : 'Aplicar Estadísticas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
