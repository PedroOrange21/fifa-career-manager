import { useState } from 'react';
import { Mail, Lock, User, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthScreen() {
  const { handleGoogleLogin, handleEmailAuth } = useAuth();
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onGoogleLogin = async () => {
    setAuthError('');
    try { await handleGoogleLogin(); } catch (err) { setAuthError(err.message); }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try { await handleEmailAuth({ mode: authMode, email, password, displayName }); } catch (err) { setAuthError(err.message); }
  };

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col items-center justify-center p-4 overscroll-none">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <span className="text-green-500 font-black text-5xl md:text-6xl italic tracking-tighter block leading-none">soccerclothes.</span>
        <h1 className="text-fg-secondary font-black tracking-[0.3em] text-xs md:text-sm uppercase mt-2">MODO CARRERA</h1>
      </div>

      <div className="bg-surface border border-border p-6 md:p-8 rounded-[40px] shadow-2xl w-full max-w-md">
        {authError && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-6 flex gap-3 text-red-400 text-xs font-bold items-start animate-pulse"><ShieldAlert className="flex-shrink-0" size={18} /><span>{authError}</span></div>}
        <form onSubmit={onSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div><label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 mb-1 block">Tu Nombre de Míster</label><div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" size={18} /><input type="text" placeholder="Ej: Míster Guardiola" className="w-full bg-well p-4 pl-12 rounded-2xl border border-border outline-none focus:border-green-500 text-base md:text-sm font-bold text-fg placeholder:text-fg-faint" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div></div>
          )}
          <div><label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 mb-1 block">Correo Electrónico</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" size={18} /><input type="email" placeholder="ejemplo@correo.com" className="w-full bg-well p-4 pl-12 rounded-2xl border border-border outline-none focus:border-green-500 text-base md:text-sm font-bold text-fg placeholder:text-fg-faint" value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
          <div>
            <label className="text-[10px] font-black text-fg-muted uppercase tracking-wider ml-1 mb-1 block">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" size={18} />
              <input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" className="w-full bg-well p-4 pl-12 pr-12 rounded-2xl border border-border outline-none focus:border-green-500 text-base md:text-sm font-bold text-fg placeholder:text-fg-faint" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <button type="submit" className="w-full bg-green-500 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-green-500/20 active:scale-95 transition-all mt-6">
            {authMode === 'login' ? 'INICIAR SESIÓN' : 'REGISTRARME GRATIS'}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-border"></div><span className="px-3 text-[10px] font-black text-fg-faint uppercase tracking-widest">O</span><div className="flex-1 h-px bg-border"></div>
        </div>

        <button onClick={onGoogleLogin} className="w-full bg-well hover:bg-well-strong text-fg border border-border font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-wider mb-6">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          <span>Entrar con Google</span>
        </button>

        <div className="text-center">
          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-xs text-green-500 hover:underline font-bold">
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
