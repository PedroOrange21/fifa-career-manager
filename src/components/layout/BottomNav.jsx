import { useEffect, useRef, useState } from 'react';
import { Shield, Gamepad2, Briefcase, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'club', label: 'Club', icon: Shield },
  { id: 'market', label: 'Mercado', icon: Briefcase },
  { id: 'match', label: 'Partido', icon: Gamepad2 },
  { id: 'office', label: 'Oficina', icon: TrendingUp },
];

// Umbral mínimo de desplazamiento (en píxeles) antes de reaccionar: evita que micro-scrolls
// (rebote táctil, ruido del trackpad) hagan parpadear la barra entre estado normal y
// contraído. Por debajo de "TOP_BUFFER" siempre se muestra a tamaño completo, para que nunca
// aparezca contraída justo al entrar en una pestaña con la página ya arriba del todo.
const SCROLL_THRESHOLD = 8;
const TOP_BUFFER = 80;

export default function BottomNav({ activeTab, setActiveTab }) {
  const [shrunk, setShrunk] = useState(false);
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;
        if (currentY <= TOP_BUFFER) {
          // Cerca de arriba (incluido el rebote elástico en iOS con valores negativos):
          // siempre a tamaño completo, sin depender del umbral de dirección.
          setShrunk(false);
          lastScrollY.current = currentY;
        } else if (Math.abs(delta) > SCROLL_THRESHOLD) {
          setShrunk(delta > 0);
          lastScrollY.current = currentY;
        }
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    // Barra a ancho completo (de extremo a extremo), pegada al borde inferior: al reducirse en
    // scroll solo se escala (origin-bottom, centrada), nunca cambia de opacidad ni de fondo.
    <div className={`fixed inset-x-0 bottom-0 z-50 pb-safe origin-bottom transition-transform duration-300 ease-in-out ${shrunk ? 'scale-[0.94]' : 'scale-100'}`}>
      <div className="grid grid-cols-4 w-full bg-surface/60 backdrop-blur-2xl border-t border-border rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center py-3 transition-all duration-300 ${activeTab === id ? 'text-green-500' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={19} className={activeTab === id ? 'mb-1 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'mb-1'} />
            <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
