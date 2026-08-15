import { useEffect, useRef, useState } from 'react';
import { Shield, Gamepad2, Briefcase, TrendingUp, CalendarClock } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'club', label: 'Club', icon: Shield },
  { id: 'market', label: 'Mercado', icon: Briefcase },
  { id: 'office', label: 'Oficina', icon: TrendingUp },
  { id: 'season', label: 'Temporada', icon: CalendarClock },
  { id: 'match', label: 'Partido', icon: Gamepad2 },
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
    // Barra a ancho completo (de extremo a extremo), pegada al borde inferior: nunca cambia de
    // opacidad ni de fondo. Al hacer scroll hacia abajo se vuelve más compacta ocultando el
    // texto de cada pestaña (solo iconos); el texto se colapsa por altura máxima (no por
    // display:none) para que la transición sea fluida, sin saltos bruscos.
    <div className="fixed inset-x-0 bottom-0 z-50 pb-safe">
      <div className="grid grid-cols-5 w-full bg-surface/60 backdrop-blur-2xl border-t border-border rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center transition-all duration-300 ${shrunk ? 'py-2.5' : 'py-3'} ${activeTab === id ? 'text-green-500' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={19} className={activeTab === id ? 'drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : ''} />
            <span className={`block overflow-hidden text-[8px] font-black uppercase tracking-widest transition-all duration-200 ease-in-out ${shrunk ? 'max-h-0 opacity-0 mt-0' : 'max-h-[10px] opacity-100 mt-1'}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
