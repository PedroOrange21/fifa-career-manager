import { useRef, useState } from 'react';
import { X, ShieldAlert, Camera, RefreshCcw, User, ChevronLeft, ChevronRight, Check, Globe2 } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { formatValueInput, parseValue } from '../../utils/format';
import { resizeImageToDataUrl } from '../../utils/image';
import { getCardStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const STEP_TITLES = ['Identidad', 'Atributos', 'Términos Económicos', 'Revisión Final'];
const TOTAL_STEPS = STEP_TITLES.length;

const splitName = (fullName) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

const toFormState = (p) => {
  const { firstName, lastName } = splitName(p?.name);
  const positions = p?.positions || (p?.pos ? [p.pos] : []);
  return {
    firstName, lastName,
    photo: p?.photo || '',
    nationality: p?.nationality || '',
    primaryPosition: positions[0] || '',
    secondaryPositions: positions.slice(1) || [],
    rating: p?.rating ? String(p.rating) : '',
    age: p?.age ? String(p.age) : '',
    preferredFoot: p?.preferredFoot || 'Diestro',
    type: p?.type || 'Comprado',
    marketValue: formatValueInput(String(p?.marketValue || p?.value || '')),
    value: formatValueInput(String(p?.value || '')),
    loanDuration: p?.loanDuration || '1 Temporada',
    originClub: p?.originClub || '',
    potential: p?.potential || '',
    wage: formatValueInput(String(p?.wage || '')),
    releaseClause: formatValueInput(String(p?.releaseClause || '')),
    contractYears: p?.contractYears || '',
  };
};

const emptyPlayer = toFormState(null);
const playerToFormState = toFormState;

export default function PlayerForm({ editingPlayer, prefill, sourceScoutId, onClose }) {
  useBodyScrollLock();
  const { addOrUpdatePlayer, deleteScout } = useClubData();
  const [form, setForm] = useState(() => toFormState(editingPlayer || prefill || null));
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const selectPrimary = (pos) => {
    set({ primaryPosition: pos, secondaryPositions: pos === 'POR' ? [] : form.secondaryPositions.filter((p) => p !== 'POR' && p !== pos) });
  };
  const toggleSecondary = (pos) => {
    if (pos === form.primaryPosition || pos === 'POR' || form.primaryPosition === 'POR') return;
    set({ secondaryPositions: form.secondaryPositions.includes(pos) ? form.secondaryPositions.filter((p) => p !== pos) : [...form.secondaryPositions, pos] });
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingPhoto(true);
    try { set({ photo: await resizeImageToDataUrl(file, 200, 0.8) }); }
    finally { setIsUploadingPhoto(false); }
  };

  const validateStep = (s) => {
    if (s === 1) {
      if (!form.firstName.trim()) return 'El nombre es obligatorio.';
    }
    if (s === 2) {
      if (!form.primaryPosition) return 'Selecciona la posición principal.';
      if (!form.rating || isNaN(form.rating) || form.rating < 1 || form.rating > 99) return 'Media entre 1 y 99.';
      if (!form.age || isNaN(form.age) || form.age < 15 || form.age > 50) return 'Edad entre 15 y 50.';
    }
    if (s === 3) {
      if (!form.marketValue || parseValue(form.marketValue) <= 0) return 'Valor de mercado obligatorio.';
      if (form.type === 'Comprado' && (!form.value || parseValue(form.value) <= 0)) return 'Precio de compra obligatorio.';
      if (form.type === 'Cedido' && !form.originClub.trim()) return 'Club de origen obligatorio.';
      if (form.type === 'Cantera' && form.potential && (isNaN(form.potential) || form.potential < 1 || form.potential > 99)) return 'Potencial entre 1 y 99.';
    }
    return '';
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) { setFormError(err); return; }
    setFormError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };
  const goPrev = () => { setFormError(''); setStep((s) => Math.max(1, s - 1)); };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setFormError(err); setStep(s); return; }
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const fullName = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}`;
      await addOrUpdatePlayer({
        name: fullName,
        positions: [form.primaryPosition, ...form.secondaryPositions],
        rating: parseInt(form.rating), age: parseInt(form.age),
        preferredFoot: form.preferredFoot || 'Diestro',
        photo: form.photo || null,
        nationality: form.nationality.trim() || null,
        marketValue: parseValue(form.marketValue), type: form.type,
        value: form.type === 'Comprado' ? parseValue(form.value) : 0,
        loanDuration: form.type === 'Cedido' ? form.loanDuration : null,
        originClub: form.type === 'Cedido' ? form.originClub.trim() : null,
        transferStatus: 'Activo',
        wage: parseValue(form.wage),
        releaseClause: parseValue(form.releaseClause) || null,
        contractYears: form.contractYears ? parseInt(form.contractYears) : null,
        potential: form.type === 'Cantera' && form.potential ? parseInt(form.potential) : null,
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

  const fullNamePreview = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}` || 'Nuevo Jugador';

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 overscroll-contain" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative my-auto flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h3 className="font-black italic text-green-500 text-sm uppercase">{editingPlayer ? 'Editar Jugador' : 'Fichar Jugador'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="shrink-0 mb-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${n <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-fg-muted text-center mt-2">Paso {step} de {TOTAL_STEPS} · {STEP_TITLES[step - 1]}</p>
        </div>

        {formError && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse shrink-0"><ShieldAlert size={14} className="shrink-0" /><span>{formError}</span></div>}

        <div key={step} className="space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1 pb-2 overscroll-contain animate-in fade-in slide-in-from-right-4 duration-300">
          {step === 1 && (
            <>
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="relative group cursor-pointer" onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
                  {form.photo ? <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full border-2 border-border object-cover shadow-lg" /> : <div className="w-20 h-20 rounded-full bg-well border-2 border-dashed border-border flex flex-col items-center justify-center text-fg-muted hover:border-green-500 hover:text-green-500 transition-all"><User size={26} /></div>}
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
                  <button type="button" disabled={isUploadingPhoto} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{isUploadingPhoto ? <RefreshCcw size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}</button>
                </div>
                <span className="text-[9px] text-fg-faint font-black uppercase tracking-widest">Foto / Avatar (opcional)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label><input type="text" required autoFocus autoComplete="off" placeholder="Erling" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Apellido</label><input type="text" autoComplete="off" placeholder="Haaland" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-fg-muted ml-1">Nacionalidad</label>
                <div className="relative"><Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" size={16} /><input type="text" placeholder="Ej: Noruega" className="w-full bg-well p-4 pl-11 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-fg-muted ml-1">Posición Principal *</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                  {ALL_POSITIONS.map((pos) => (<button key={pos} type="button" onClick={() => selectPrimary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${form.primaryPosition === pos ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
                </div>
              </div>
              {form.primaryPosition && form.primaryPosition !== 'POR' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones Secundarias</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                    {ALL_POSITIONS.filter((pos) => pos !== 'POR' && pos !== form.primaryPosition).map((pos) => (<button key={pos} type="button" onClick={() => toggleSecondary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${form.secondaryPositions.includes(pos) ? 'bg-green-500/80 text-black shadow-lg shadow-green-500/20' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>{pos}</button>))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Media (OVR) *</label><input type="number" required placeholder="90" min="1" max="99" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={form.rating} onChange={(e) => set({ rating: e.target.value })} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Edad *</label><input type="number" required placeholder="23" min="15" max="50" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={form.age} onChange={(e) => set({ age: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Pierna</label><select className="w-full h-12 bg-surface rounded-xl outline-none border border-border-subtle text-center font-black text-base md:text-xs text-fg" value={form.preferredFoot} onChange={(e) => set({ preferredFoot: e.target.value })}><option value="Diestro">Diestro</option><option value="Zurdo">Zurdo</option><option value="Ambas">Ambas</option></select></div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-fg-muted ml-1">Tipo de Adquisición</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => set({ type: 'Cantera' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'Cantera' ? 'bg-emerald-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cantera</button>
                  <button type="button" onClick={() => set({ type: 'Cedido' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'Cedido' ? 'bg-yellow-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cedido</button>
                  <button type="button" onClick={() => set({ type: 'Comprado' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'Comprado' ? 'bg-blue-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Comprado</button>
                </div>
              </div>
              {form.type === 'Cantera' && (<div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Potencial (1-99)</label><input type="number" min="1" max="99" placeholder="Ej: 88" className="w-full h-14 bg-well rounded-xl outline-none border border-border-subtle text-center font-black text-xl text-fg placeholder:text-fg-faint" value={form.potential} onChange={(e) => set({ potential: e.target.value })} /></div>)}
              {form.type === 'Comprado' && (<div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra (€) *</label><input type="text" required placeholder="Ej: 50.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={form.value} onChange={(e) => set({ value: formatValueInput(e.target.value) })} /></div>)}
              {form.type === 'Cedido' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Duración Cesión</label><select className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-black text-base md:text-xs text-fg" value={form.loanDuration} onChange={(e) => set({ loanDuration: e.target.value })}><option value="6 Meses">6 Meses</option><option value="1 Temporada">1 Temporada</option><option value="2 Temporadas">2 Temporadas</option></select></div>
                  <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Club de Origen *</label><input type="text" required placeholder="Ej: Real Madrid" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle font-bold text-base md:text-sm text-fg placeholder:text-fg-faint" value={form.originClub} onChange={(e) => set({ originClub: e.target.value })} /></div>
                </div>
              )}
              <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Valor de Mercado (€) *</label><input type="text" required placeholder="Ej: 80.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={form.marketValue} onChange={(e) => set({ marketValue: formatValueInput(e.target.value) })} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Sueldo Anual (€)</label><input type="text" placeholder="Ej: 5.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-lg text-fg placeholder:text-fg-faint" value={form.wage} onChange={(e) => set({ wage: formatValueInput(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Cláusula (€)</label><input type="text" placeholder="Ej: 150.000.000" className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-sm text-fg placeholder:text-fg-faint" value={form.releaseClause} onChange={(e) => set({ releaseClause: formatValueInput(e.target.value) })} /></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-fg-muted ml-1">Años Contrato</label><input type="number" min="0" max="10" placeholder="Ej: 4" className="w-full h-full bg-well p-4 rounded-xl outline-none border border-border-subtle text-center font-black text-sm text-fg placeholder:text-fg-faint" value={form.contractYears} onChange={(e) => set({ contractYears: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center">
              <div className={`relative w-52 rounded-[28px] p-5 shadow-2xl border-2 border-black/10 ${getCardStyle(parseInt(form.rating) || 0)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col items-center leading-none"><span className="text-4xl font-black">{form.rating}</span><span className="text-[10px] font-black uppercase mt-1 tracking-wider">{form.primaryPosition}</span></div>
                  {form.nationality && <span className="text-[8px] font-black uppercase bg-black/10 px-2 py-1 rounded-lg max-w-[70px] truncate text-right">{form.nationality}</span>}
                </div>
                <div className="flex justify-center my-3">
                  {form.photo ? <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full object-cover border-4 border-black/10 shadow-lg" /> : <div className="w-20 h-20 rounded-full bg-black/10 flex items-center justify-center border-4 border-black/10"><User size={30} /></div>}
                </div>
                <div className="text-center font-black uppercase italic text-sm tracking-tight border-t border-black/10 pt-2 truncate">{fullNamePreview}</div>
                {form.secondaryPositions.length > 0 && <div className="text-center text-[9px] font-bold uppercase opacity-70 mt-0.5 truncate">{form.secondaryPositions.join(' · ')}</div>}
              </div>

              <div className="w-full mt-4 bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Edad</span><span className="text-xs font-black text-fg">{form.age} Años</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Adquisición</span><span className="text-xs font-black text-fg">{form.type}{form.type === 'Cedido' && form.originClub ? ` · ${form.originClub}` : ''}</span></div>
                <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Valor de Mercado</span><span className="text-xs font-black text-green-500">{form.marketValue || '0'} €</span></div>
                {form.wage && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Sueldo Anual</span><span className="text-xs font-black text-fg">{form.wage} €</span></div>}
                {form.releaseClause && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Cláusula</span><span className="text-xs font-black text-fg">{form.releaseClause} €</span></div>}
                {form.contractYears && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Contrato</span><span className="text-xs font-black text-fg">{form.contractYears} Años</span></div>}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 shrink-0">
          {step > 1 && (<button type="button" onClick={goPrev} className="flex-1 py-4 rounded-xl bg-well-strong text-fg font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:brightness-125 transition-all"><ChevronLeft size={16} /> Anterior</button>)}
          {step < TOTAL_STEPS && (<button type="button" onClick={goNext} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all">Siguiente <ChevronRight size={16} /></button>)}
          {step === TOTAL_STEPS && (<button type="button" disabled={isSubmitting} onClick={handleConfirm} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50">{isSubmitting ? 'Guardando...' : (<><Check size={16} /> Confirmar Fichaje</>)}</button>)}
        </div>
      </div>
    </div>
  );
}

export { emptyPlayer, playerToFormState };
