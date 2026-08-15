import { useEffect, useRef, useState } from 'react';
import { Shield, Gamepad2, Briefcase, TrendingUp } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'club', label: 'Club', icon: Shield },
  { id: 'market', label: 'Mercado', icon: Briefcase },
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
    <div
      className={`fixed left-0 right-0 z-50 flex justify-center items-center gap-2 px-4 pointer-events-none pb-safe origin-bottom transition-all duration-300 ease-in-out ${shrunk ? 'bottom-3 scale-[0.85]' : 'bottom-6 scale-100'}`}
    >
      <div className="flex justify-between items-center p-1 w-full max-w-[220px] bg-surface/60 backdrop-blur-2xl border border-border rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center w-[56px] h-[42px] rounded-[18px] transition-all duration-300 ${activeTab === id ? 'bg-well-strong text-green-500' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={15} className={activeTab === id ? 'mb-0.5 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'mb-0.5'} />
            <span className="text-[6.5px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setActiveTab('match')}
        className={`pointer-events-auto shrink-0 flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full bg-emerald-600 text-white shadow-[0_10px_30px_rgba(5,150,105,0.5)] border-2 transition-all duration-300 active:scale-90 ${activeTab === 'match' ? 'border-white/70 scale-105' : 'border-emerald-400/40 hover:border-white/40'}`}
      >
        <Gamepad2 size={18} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
        <span className="text-[6.5px] font-black uppercase tracking-widest mt-0.5">Partido</span>
      </button>
    </div>
  );
}
