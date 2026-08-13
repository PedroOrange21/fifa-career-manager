import { useCallback, useRef, useState } from 'react';
import { Shield, Plus, Edit2, Check, User, LogOut, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

const THEME_OPTIONS = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'auto', label: 'Automático', icon: MonitorSmartphone },
];

export default function ClubMenu({ setActiveTab, onSwitchClub }) {
  const { clubs, activeClub, activeClubId, setShowClubModal, setEditingClub } = useClubs();
  const { user, handleLogout } = useAuth();
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(menuRef, close, open);

  const handleSwitch = (clubId) => { onSwitchClub(clubId); close(); };
  const handleNewClub = () => { setEditingClub(null); setShowClubModal(true); close(); };
  const handleEditClub = (club) => { setEditingClub(club); close(); };
  const goProfile = () => { setActiveTab('profile'); close(); };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 group" title="Modo Carrera y Ajustes">
        {activeClub?.logo ? (
          <img src={activeClub.logo} alt={activeClub.name} className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-border object-cover group-hover:border-green-500 transition-colors shadow-lg" />
        ) : (
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-surface border-2 border-border flex items-center justify-center group-hover:border-green-500 transition-colors shadow-lg"><Shield size={18} className="text-fg-muted" /></div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <button onClick={goProfile} className="w-full p-4 border-b border-border-subtle bg-canvas/50 flex items-center gap-3 cursor-pointer hover:bg-well transition-colors text-left" title="Mi Perfil / Ajustes">
            {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-border-subtle" /> : <div className="w-10 h-10 rounded-full bg-well flex items-center justify-center border border-border-subtle"><User size={20} className="text-fg-faint" /></div>}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black uppercase truncate text-fg">{user.displayName || 'Míster'}</span>
              <span className="text-[9px] text-fg-muted truncate">{user.email}</span>
            </div>
          </button>

          <div className="max-h-[50vh] overflow-y-auto no-scrollbar">
            <div className="p-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-fg-faint ml-2 mb-2 block">Tus Modos Carrera</span>
              <div className="space-y-1">
                {clubs.map((c) => (
                  <div key={c.id} className={`flex items-center p-1 rounded-xl transition-all border ${activeClubId === c.id ? 'bg-green-500/10 border-green-500/20' : 'hover:bg-well border-transparent'}`}>
                    <button onClick={() => handleSwitch(c.id)} className="flex-1 flex items-center gap-3 p-1 min-w-0">
                      {c.logo ? <img src={c.logo} alt="logo" className="w-8 h-8 rounded-full object-cover bg-canvas" /> : <div className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center border border-border-subtle"><Shield size={14} className="text-fg-faint" /></div>}
                      <span className={`text-xs font-bold truncate text-left ${activeClubId === c.id ? 'text-green-500' : 'text-fg'}`}>{c.name}</span>
                      {activeClubId === c.id && <Check size={16} className="text-green-500 shrink-0 ml-auto" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditClub(c); }} className="p-2 text-fg-faint hover:text-green-500 transition-colors rounded-lg">
                      <Edit2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={handleNewClub} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-well border border-dashed border-border-subtle mt-2 text-fg-muted hover:text-fg transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-canvas border border-border-subtle"><Plus size={14} /></div>
                  <span className="text-xs font-bold text-left">Crear Nuevo Club</span>
                </button>
              </div>
            </div>

            <div className="p-3 border-t border-border-subtle">
              <span className="text-[9px] font-black uppercase tracking-widest text-fg-faint ml-2 mb-2 block">Apariencia</span>
              <div className="flex bg-well p-1 rounded-xl border border-border-subtle">
                {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setMode(id)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${mode === id ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'border-transparent text-fg-muted hover:text-fg'}`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 border-t border-border-subtle">
              <button onClick={goProfile} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-well text-fg transition-colors text-xs font-bold"><User size={16} className="text-fg-muted" /> Mi Perfil / Ajustes</button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-500 transition-colors text-xs font-bold"><LogOut size={16} /> Cerrar Sesión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
