import { useRef, useState } from 'react';
import { X, ShieldAlert, Camera, RefreshCcw, User, Globe2 } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { flagEmoji, detectCountry } from '../../constants/countries';
import { formatValueInput, parseValue } from '../../utils/format';
import { resizeImageToDataUrl } from '../../utils/image';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

export const STATUS_OPTIONS = ['Seguimiento', 'Negociando', 'Prioritario', 'Descartado'];
export const STATUS_LABELS = { Seguimiento: 'En Seguimiento', Negociando: 'Negociando', Prioritario: 'Objetivo Prioritario', Descartado: 'Descartado' };
export const STATUS_STYLE = {
  Seguimiento: 'bg-well-strong text-fg-muted border-border',
  Negociando: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Prioritario: 'bg-red-500/20 text-red-400 border-red-500/20',
  Descartado: 'bg-well text-fg-faint border-border-subtle opacity-70',
};

const FOOT_OPTIONS = ['Diestro', 'Zurdo', 'Ambas'];

const emptyTarget = { photo: '', name: '', nationality: '', originClub: '', primaryPosition: '', secondaryPositions: [], preferredFoot: 'Diestro', age: '', rating: '', estimatedValue: '', wage: '', status: 'Seguimiento', notes: '' };

const targetToFormState = (t) => ({
  photo: t.photo || '', name: t.name, nationality: t.nationality || '', originClub: t.originClub || '',
  primaryPosition: t.primaryPosition || t.positions?.[0] || '',
  secondaryPositions: t.secondaryPositions || t.positions?.slice(1) || [],
  preferredFoot: t.preferredFoot || 'Diestro',
  age: t.age || '', rating: t.rating || '',
  estimatedValue: formatValueInput(String(t.estimatedValue || '')), wage: formatValueInput(String(t.wage || '')),
  status: t.status || 'Seguimiento', notes: t.notes || '',
});

export default function TargetForm({ editingTarget, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { addOrUpdateTarget } = useClubData();
  const [target, setTarget] = useState(editingTarget ? targetToFormState(editingTarget) : emptyTarget);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const selectedCountry = detectCountry(target.nationality);

  const selectPrimary = (pos) => {
    setTarget({ ...target, primaryPosition: pos, secondaryPositions: pos === 'POR' ? [] : target.secondaryPositions.filter((p) => p !== 'POR' && p !== pos) });
  };
  const toggleSecondary = (pos) => {
    if (pos === target.primaryPosition || pos === 'POR' || target.primaryPosition === 'POR') return;
    setTarget({ ...target, secondaryPositions: target.secondaryPositions.includes(pos) ? target.secondaryPositions.filter((p) => p !== pos) : [...target.secondaryPositions, pos] });
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200, 0.8);
      setTarget({ ...target, photo: dataUrl });
    } catch (err) {
      console.error(err);
      setFormError('No se pudo procesar la foto. Inténtalo con otra imagen.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!target.name.trim()) return setFormError('El nombre es obligatorio.');
    if (!target.primaryPosition) return setFormError('Selecciona la posición principal.');

    setFormError('');
    setIsSubmitting(true);
    try {
      await addOrUpdateTarget({
        photo: target.photo || null,
        name: target.name.trim(),
        nationality: target.nationality.trim() || null,
        originClub: target.originClub.trim() || null,
        positions: [target.primaryPosition, ...target.secondaryPositions],
        primaryPosition: target.primaryPosition, secondaryPositions: target.secondaryPositions,
        preferredFoot: target.preferredFoot,
        age: target.age ? parseInt(target.age) : null,
        rating: target.rating ? parseInt(target.rating) : null,
        estimatedValue: parseValue(target.estimatedValue),
        wage: parseValue(target.wage), status: target.status,
        notes: target.notes.trim() || null,
      }, editingTarget?.id);
      onClose();
    } catch (err) {
      setFormError('Error de base de datos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 overscroll-contain" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative my-auto flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="font-black italic text-green-500 text-sm uppercase">{editingTarget ? 'Editar Objetivo' : 'Nuevo Objetivo'}</h3><button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button></div>

        {formError && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse shrink-0"><ShieldAlert size={14} className="shrink-0" /><span>{formError}</span></div>}

        <div className="space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1 pb-4 overscroll-contain">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => { if (!isUploadingPhoto) fileInputRef.current?.click(); }}>
              {target.photo ? (
                <img src={target.photo} alt="Foto" className="w-20 h-20 rounded-full border-2 border-border object-cover shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-well border-2 border-dashed border-border flex flex-col items-center justify-center text-fg-muted hover:border-green-500 hover:text-green-500 transition-all">
                  <User size={26} />
                </div>
              )}
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
              <button type="button" disabled={isUploadingPhoto} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation">
                {isUploadingPhoto ? <RefreshCcw size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
              </button>
            </div>
            <span className="text-[9px] text-fg-faint font-black uppercase tracking-widest">Foto (opcional)</span>
          </div>

          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label><input type="text" required autoComplete="off" placeholder="Ej: Kobbie Mainoo" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={target.name} onChange={(e) => setTarget({ ...target, name: e.target.value })} /></div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Nacionalidad</label>
            <div className="relative">
              {selectedCountry ? (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none">{flagEmoji(selectedCountry.code)}</span>
              ) : (
                <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" size={16} />
              )}
              <input type="text" autoComplete="off" placeholder="Ej: Noruega" className="w-full bg-well p-4 pl-11 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={target.nationality} onChange={(e) => setTarget({ ...target, nationality: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Club Actual</label><input type="text" placeholder="Ej: Manchester United" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-base md:text-sm text-fg placeholder:text-fg-faint" value={target.originClub} onChange={(e) => setTarget({ ...target, originClub: e.target.value })} /></div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Posición Principal *</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
              {ALL_POSITIONS.map((pos) => (<button key={pos} type="button" onClick={() => selectPrimary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${target.primaryPosition === pos ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
            </div>
          </div>
          {target.primaryPosition && target.primaryPosition !== 'POR' && (
            <div className="space-y-1">
              <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones Secundarias</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                {ALL_POSITIONS.filter((pos) => pos !== 'POR' && pos !== target.primaryPosition).map((pos) => (<button key={pos} type="button" onClick={() => toggleSecondary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${target.secondaryPositions.includes(pos) ? 'bg-green-500/80 text-black shadow-lg shadow-green-500/20' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Pierna Buena</label>
            <div className="flex gap-2">
              {FOOT_OPTIONS.map((f) => (<button key={f} type="button" onClick={() => setTarget({ ...target, preferredFoot: f })} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border ${target.preferredFoot === f ? 'bg-green-500 text-black border-green-500' : 'bg-well text-fg-muted border-border-subtle hover:bg-well-strong'}`}>{f}</button>))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Edad</label><input type="number" min="14" max="50" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={target.age} onChange={(e) => setTarget({ ...target, age: e.target.value })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Media</label><input type="number" min="1" max="99" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={target.rating} onChange={(e) => setTarget({ ...target, rating: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Valor de Mercado (€)</label><input type="text" inputMode="numeric" placeholder="Ej: 20.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-fg placeholder:text-fg-faint" value={target.estimatedValue} onChange={(e) => setTarget({ ...target, estimatedValue: formatValueInput(e.target.value) })} /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Sueldo Aproximado (€)</label><input type="text" inputMode="numeric" placeholder="Ej: 500.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-fg placeholder:text-fg-faint" value={target.wage} onChange={(e) => setTarget({ ...target, wage: formatValueInput(e.target.value) })} /></div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-fg-muted ml-1">Estado de Seguimiento</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((s) => (<button key={s} type="button" onClick={() => setTarget({ ...target, status: s })} className={`py-2.5 rounded-xl text-[9px] font-black uppercase transition-all border ${target.status === s ? STATUS_STYLE[s] : 'bg-well text-fg-muted hover:bg-well-strong border-transparent'}`}>{STATUS_LABELS[s]}</button>))}
            </div>
          </div>
          <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Notas de Seguimiento</label><textarea rows={3} placeholder="Observaciones sobre la negociación..." className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-sm text-fg placeholder:text-fg-faint resize-none" value={target.notes} onChange={(e) => setTarget({ ...target, notes: e.target.value })} /></div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-green-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-6 hover:bg-green-400 shrink-0 disabled:opacity-50">{isSubmitting ? 'Guardando...' : editingTarget ? 'Guardar Cambios' : 'Añadir a la Lista'}</button>
        </div>
      </form>
    </div>
  );
}
