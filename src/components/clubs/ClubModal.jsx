import { useRef, useState } from 'react';
import { X, Shield, Camera, RefreshCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { resizeImageToDataUrl } from '../../utils/image';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { OnboardingWizardModal } from '../onboarding/OnboardingWizard';

// Editar un club existente conserva el formulario simple de un solo paso (nombre + escudo):
// no forma parte del onboarding. Crear un club (primero o adicional) delega por completo en
// OnboardingWizardModal (clubExists=false), que encadena identidad + fondos + registro de
// jugadores en un único flujo, ver componente OnboardingWizard.jsx.
function EditClubForm({ editingClub, onClose }) {
  const { updateClub, setClubToDelete, clubs } = useClubs();
  const canDeleteClub = clubs.length > 1;
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
        {canDeleteClub ? (
          <button type="button" onClick={() => { onClose(); setClubToDelete(editingClub.id); }} className="w-full bg-red-500/10 text-red-500 p-4 rounded-2xl border border-red-500/20 font-black uppercase text-xs flex justify-center items-center gap-2 hover:bg-red-500/20 active:scale-95 transition-all">
            <Trash2 size={16} /> Eliminar Modo Carrera
          </button>
        ) : (
          <div className="w-full bg-well text-fg-faint p-4 rounded-2xl border border-border-subtle flex flex-col items-center gap-1.5 text-center">
            <span className="font-black uppercase text-xs flex items-center gap-2 opacity-70"><Trash2 size={16} /> Eliminar Modo Carrera</span>
            <span className="text-[9px] font-bold normal-case tracking-normal opacity-80">Debe existir al menos un modo carrera. Crea otro antes de poder eliminar este.</span>
          </div>
        )}
      </div>
    </form>
  );
}

export default function ClubModal({ editingClub, onClose, onFirstClubCreated }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { setShowClubModal } = useClubs();
  const handleClose = () => { if (onClose) onClose(); else setShowClubModal(false); };

  if (!editingClub) {
    return <OnboardingWizardModal clubExists={false} onDismiss={handleClose} onFirstClubCreated={onFirstClubCreated} />;
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <EditClubForm editingClub={editingClub} onClose={handleClose} />
    </div>
  );
}
