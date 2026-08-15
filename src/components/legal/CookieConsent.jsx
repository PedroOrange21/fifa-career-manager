import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { useLegal } from '../../context/LegalContext';

const STORAGE_KEY = 'fifa-manager:cookieConsent';

// Banner flotante de consentimiento: se muestra una única vez (hasta que el usuario elija una
// opción) y la elección se recuerda en localStorage para no volver a molestar en sesiones
// futuras. "Solo necesarias" y "Aceptar" guardan la misma marca de consentimiento resuelto —
// esta app no usa cookies de rastreo/publicidad de terceros, solo localStorage funcional
// (sesión, club activo y tema), así que ambas opciones dejan la app en el mismo estado.
export default function CookieConsent() {
  const { openPrivacy } = useLegal();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch (err) { console.error(err); }
  }, []);

  const resolve = (choice) => {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (err) { console.error(err); }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[250] p-3 md:p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="max-w-lg mx-auto bg-surface border border-border rounded-[24px] shadow-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0"><Cookie size={18} /></div>
          <p className="text-xs text-fg-secondary font-bold leading-relaxed">
            Usamos almacenamiento local (localStorage) para mantener tu sesión iniciada y guardar tu partida y preferencias — no usamos cookies de rastreo publicitario.{' '}
            <button type="button" onClick={openPrivacy} className="text-green-500 underline underline-offset-2 hover:text-green-400 font-black">Ver Política de Cookies</button>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => resolve('essential')} className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all touch-manipulation">Solo Necesarias</button>
          <button type="button" onClick={() => resolve('accepted')} className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-green-500 text-black font-black uppercase text-[10px] hover:bg-green-400 transition-all shadow-lg shadow-green-500/20 touch-manipulation">Aceptar</button>
        </div>
      </div>
    </div>
  );
}
