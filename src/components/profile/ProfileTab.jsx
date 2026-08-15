import { useRef, useState } from 'react';
import { User, Camera, RefreshCcw, ShieldCheck, ShieldAlert, Eye, EyeOff, LogOut, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ProfileTab({ onClose }) {
  const { user, handleUpdateName, handleUpdatePassword, handlePhotoUpload, handleLogout } = useAuth();

  const [profileName, setProfileName] = useState(user.displayName || user.email.split('@')[0]);
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const fileInputRef = useRef(null);

  const flash = (type, text) => { setProfileMessage({ type, text }); setTimeout(() => setProfileMessage({ type: '', text: '' }), 3000); };

  const onUpdateName = async () => {
    try { await handleUpdateName(profileName); flash('success', 'Nombre actualizado.'); }
    catch (err) { flash('error', err.message); }
  };

  const onUpdatePassword = async () => {
    try { await handleUpdatePassword(newPassword); setNewPassword(''); flash('success', 'Contraseña actualizada.'); }
    catch (err) { flash('error', err.message); }
  };

  const onPhotoChange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsUploadingPhoto(true);
    try { await handlePhotoUpload(file); flash('success', 'Foto actualizada.'); }
    catch (err) { flash('error', err.message); }
    finally { setIsUploadingPhoto(false); }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-fg">Perfil de Usuario</h2>
          <button onClick={onClose} className="p-2.5 bg-well rounded-full hover:bg-well-strong transition-all text-fg-muted hover:text-fg active:scale-95" title="Cerrar"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative group cursor-pointer" onClick={() => !isUploadingPhoto && fileInputRef.current?.click()}>
            {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-border object-cover shadow-2xl" /> : <div className="w-24 h-24 rounded-full bg-well border-4 border-border flex items-center justify-center shadow-2xl"><User size={40} className="text-fg-muted" /></div>}
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={onPhotoChange} />
            <button disabled={isUploadingPhoto} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{isUploadingPhoto ? <RefreshCcw size={24} className="animate-spin text-white" /> : <Camera size={24} className="text-white" />}</button>
          </div>
          <p className="text-[10px] text-fg-muted font-black uppercase tracking-widest bg-well px-3 py-1 rounded-lg border border-border-subtle">{user.email}</p>
        </div>

        {profileMessage.text && (<div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${profileMessage.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>{profileMessage.type === 'error' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}{profileMessage.text}</div>)}

        <div className="space-y-6">
          <div className="space-y-2"><label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Nombre de Entrenador</label><div className="flex flex-col sm:flex-row gap-2 sm:gap-3"><input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full sm:flex-1 bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg text-base md:text-sm" /><button onClick={onUpdateName} className="w-full sm:w-auto bg-green-500 text-black p-4 rounded-xl font-black uppercase text-[10px] md:text-xs hover:bg-green-400 transition-all shadow-lg shadow-green-500/20 active:scale-95">Guardar</button></div></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1">Cambiar Contraseña</label><div className="flex flex-col sm:flex-row gap-2 sm:gap-3"><div className="relative w-full sm:flex-1"><input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-well p-4 pr-12 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold text-fg placeholder:text-fg-faint text-base md:text-sm" /><button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><button onClick={onUpdatePassword} className="w-full sm:w-auto bg-well-strong text-fg p-4 rounded-xl font-black uppercase text-[10px] md:text-xs hover:brightness-125 transition-all border border-border active:scale-95">Actualizar</button></div></div>
        </div>

        {/* Los enlaces a Privacidad/Términos ya viven en el pie de página global
            (Footer.jsx, montado por ClubShell al final del contenido de cada pestaña). */}
        <div className="pt-4 mt-2 border-t border-border-subtle">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-xs hover:bg-red-500/20 transition-all border border-red-500/20 shadow-lg shadow-red-500/10">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
