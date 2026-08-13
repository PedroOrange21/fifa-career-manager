import { useRef, useState } from 'react';
import { X, Shield, Camera, RefreshCcw, ShieldAlert, Trash2, Wallet, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { resizeImageToDataUrl } from '../../utils/image';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { formatCurrency, formatValueInput, parseValue } from '../../utils/format';

const BUDGET_PRESETS = [1000000, 5000000, 10000000, 50000000, 100000000, 200000000, 500000000, 1000000000];

// Asistente paso a paso (solo para crear un club nuevo, primero o adicional): identidad,
// presupuesto inicial de fichajes y un resumen final antes de guardar en Firestore. Editar un
// club existente sigue usando el formulario simple de un solo paso (más abajo).
function CreateClubWizard({ onClose, onFirstClubCreated }) {
  const { clubs, createClub } = useClubs();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [budget, setBudget] = useState(BUDGET_PRESETS[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customBudget, setCustomBudget] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const isFirstClub = clubs.length === 0;
  const canDismiss = !isFirstClub;
  const handleClose = () => { if (onClose) onClose(); };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 150, 0.8);
      setLogo(dataUrl);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const pickPreset = (amount) => { setCustomMode(false); setCustomBudget(''); setBudget(amount); };
  const pickCustom = () => { setCustomMode(true); setBudget(parseValue(customBudget)); };
  const onCustomBudgetChange = (raw) => {
    const formatted = formatValueInput(raw);
    setCustomBudget(formatted);
    setBudget(parseValue(formatted));
  };

  const canGoNextFromStep1 = name.trim().length > 0;
  // Personalizado exige un importe válido y positivo antes de poder continuar; los presets
  // siempre son válidos porque ya son cifras positivas fijas.
  const canGoNextFromStep2 = !customMode || parseValue(customBudget) > 0;

  const goNext = () => {
    if (step === 1 && !canGoNextFromStep1) return;
    if (step === 2 && !canGoNextFromStep2) return;
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError('');
    setIsSaving(true);
    try {
      const result = await createClub(name, logo, budget);
      if (result?.isFirstClub) onFirstClubCreated?.();
      else handleClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo crear el club. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border p-6 md:p-8 rounded-[32px] w-full max-w-sm shadow-2xl relative">
      {canDismiss && <button type="button" onClick={handleClose} className="absolute top-4 right-4 p-2 bg-well rounded-full hover:bg-well-strong text-fg-muted hover:text-fg"><X size={18} /></button>}

      <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-fg mb-1">
        {isFirstClub ? '¡Crea tu Club!' : 'Nuevo Modo Carrera'}
      </h2>
      <p className="text-[9px] md:text-[10px] text-green-500 font-black uppercase tracking-widest mb-5">Comienza tu leyenda</p>

      {/* Indicador de progreso: 3 barras, la del paso actual y anteriores en verde. */}
      <div className="flex items-center gap-1.5 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse"><ShieldAlert size={14} className="shrink-0" /><span>{error}</span></div>}

      {step === 1 && (
        <div className="animate-in fade-in duration-200">
          <p className="text-[9px] font-black text-fg-faint uppercase tracking-widest mb-4">Paso 1 de {totalSteps} · Identidad</p>
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group cursor-pointer" onClick={() => !isUploadingLogo && fileInputRef.current?.click()}>
              {logo ? <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl border-2 border-border object-cover shadow-2xl" /> : <div className="w-20 h-20 rounded-2xl bg-well border-2 border-dashed border-border flex flex-col items-center justify-center shadow-2xl hover:border-green-500 transition-all text-fg-muted hover:text-green-500"><Shield size={28} /><span className="text-[8px] font-black uppercase mt-1">Escudo</span></div>}
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} />
              <button type="button" disabled={isUploadingLogo} className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{isUploadingLogo ? <RefreshCcw size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Nombre del Club</label>
            <input type="text" autoFocus placeholder="Ej: CD Olvera" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goNext(); } }} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in duration-200">
          <p className="text-[9px] font-black text-fg-faint uppercase tracking-widest mb-4">Paso 2 de {totalSteps} · Presupuesto Inicial</p>
          <div className="flex items-center gap-2 mb-4 p-3 rounded-2xl bg-well border border-border-subtle">
            <Wallet size={16} className="text-green-500 shrink-0" />
            <span className="text-xs font-bold text-fg-muted">Fondos para fichar jugadores desde el primer día</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {BUDGET_PRESETS.map((amount) => (
              <button key={amount} type="button" onClick={() => pickPreset(amount)} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${!customMode && budget === amount ? 'bg-green-500 text-black border-green-500' : 'bg-well border-border-subtle text-fg-secondary hover:border-fg-muted'}`}>
                {abbreviateBudget(amount)}
              </button>
            ))}
            <button type="button" onClick={pickCustom} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${customMode ? 'bg-green-500 text-black border-green-500' : 'bg-well border-border-subtle text-fg-secondary hover:border-fg-muted'}`}>
              Personalizar
            </button>
          </div>
          {customMode && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Cantidad Personalizada</label>
              <input type="text" inputMode="numeric" autoFocus placeholder="Ej: 20.000.000" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={customBudget} onChange={(e) => onCustomBudgetChange(e.target.value)} />
              {!canGoNextFromStep2 && <p className="text-[9px] font-black text-red-400 uppercase tracking-wide ml-1">Introduce una cantidad mayor que cero.</p>}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in duration-200">
          <p className="text-[9px] font-black text-fg-faint uppercase tracking-widest mb-4">Paso 3 de {totalSteps} · Resumen</p>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-well border border-border-subtle mb-4">
            {logo ? <img src={logo} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-border-subtle shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-well-strong flex items-center justify-center shrink-0"><Shield size={22} className="text-fg-faint" /></div>}
            <div className="min-w-0">
              <div className="font-black uppercase italic text-base truncate text-fg">{name || 'Tu Club'}</div>
              <div className="flex items-center gap-1.5 text-green-500 font-black text-xs mt-0.5"><Wallet size={12} /> {formatCurrency(budget)}</div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-2">
            <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest"><Sparkles size={13} /> Después de crear tu club</div>
            <ul className="text-[10px] font-bold text-fg-muted space-y-1 ml-1">
              <li>· Ficha jugadores desde Plantilla o Mercado</li>
              <li>· Da de alta canteranos en la pestaña Cantera</li>
              <li>· Arma tu once titular en Táctica</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 1 && (
          <button type="button" onClick={goBack} disabled={isSaving} className="shrink-0 w-14 flex items-center justify-center bg-well text-fg-muted p-4 rounded-2xl hover:bg-well-strong transition-all disabled:opacity-50">
            <ChevronLeft size={18} />
          </button>
        )}
        {step < totalSteps ? (
          <button type="button" onClick={goNext} disabled={(step === 1 && !canGoNextFromStep1) || (step === 2 && !canGoNextFromStep2)} className="flex-1 bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs md:text-sm tracking-wider shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            Siguiente <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={handleCreate} disabled={isSaving} className="flex-1 bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs md:text-sm tracking-wider shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            {isSaving ? 'Creando...' : <><Check size={16} /> Crear Club y Empezar</>}
          </button>
        )}
      </div>
    </div>
  );
}

function abbreviateBudget(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toLocaleString('es-ES', { useGrouping: true })}M €`;
  if (amount >= 1000) return `${amount / 1000}Mil €`;
  return `${amount} €`;
}

// Editar un club existente conserva el formulario simple de un solo paso (nombre + escudo):
// no forma parte del onboarding y cambiarlo queda fuera del alcance de esta renovación.
function EditClubForm({ editingClub, onClose }) {
  const { updateClub, setClubToDelete } = useClubs();
  const [name, setName] = useState(editingClub.name || '');
  const [logo, setLogo] = useState(editingClub.logo || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingLogo(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 150, 0.8);
      setLogo(dataUrl);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setIsSaving(true);
    try {
      await updateClub(editingClub.id, { name, logo });
      onClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el club. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 md:p-8 rounded-[32px] w-full max-w-sm shadow-2xl relative">
      <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 bg-well rounded-full hover:bg-well-strong text-fg-muted hover:text-fg"><X size={18} /></button>
      <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-fg mb-1">Editar Club</h2>
      <p className="text-[9px] md:text-[10px] text-green-500 font-black uppercase tracking-widest mb-6">Actualiza los datos de tu club</p>

      {error && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-4 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse"><ShieldAlert size={14} className="shrink-0" /><span>{error}</span></div>}

      <div className="flex flex-col items-center gap-4 mb-6">
        <div className="relative group cursor-pointer" onClick={() => !isUploadingLogo && fileInputRef.current?.click()}>
          {logo ? <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl border-2 border-border object-cover shadow-2xl" /> : <div className="w-20 h-20 rounded-2xl bg-well border-2 border-dashed border-border flex flex-col items-center justify-center shadow-2xl hover:border-green-500 transition-all text-fg-muted hover:text-green-500"><Shield size={28} /><span className="text-[8px] font-black uppercase mt-1">Escudo</span></div>}
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleLogoUpload} />
          <button type="button" disabled={isUploadingLogo} className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{isUploadingLogo ? <RefreshCcw size={20} className="animate-spin text-white" /> : <Camera size={20} className="text-white" />}</button>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Nombre del Club</label>
        <input type="text" autoFocus required placeholder="Ej: CD Olvera" className="w-full bg-well p-4 rounded-2xl outline-none border border-border focus:border-green-500 font-bold text-fg text-base md:text-sm placeholder:text-fg-faint" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-3">
        <button type="submit" disabled={!name.trim() || isSaving} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs md:text-sm tracking-wider shadow-lg shadow-green-500/20 active:scale-95 transition-all hover:bg-green-400 disabled:opacity-50 disabled:active:scale-100">
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        <button type="button" onClick={() => { onClose(); setClubToDelete(editingClub.id); }} className="w-full bg-red-500/10 text-red-500 p-4 rounded-2xl border border-red-500/20 font-black uppercase text-xs flex justify-center items-center gap-2 hover:bg-red-500/20 active:scale-95 transition-all">
          <Trash2 size={16} /> Eliminar Modo Carrera
        </button>
      </div>
    </form>
  );
}

export default function ClubModal({ editingClub, onClose, onFirstClubCreated }) {
  useBodyScrollLock();
  const { setShowClubModal } = useClubs();
  const handleClose = () => { if (onClose) onClose(); else setShowClubModal(false); };

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {editingClub ? (
        <EditClubForm editingClub={editingClub} onClose={handleClose} />
      ) : (
        <CreateClubWizard onClose={handleClose} onFirstClubCreated={onFirstClubCreated} />
      )}
    </div>
  );
}
