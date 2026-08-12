import { Shield, Gamepad2, Briefcase, TrendingUp } from 'lucide-react';
import LiquidGlass from '../common/LiquidGlass';

const NAV_ITEMS = [
  { id: 'club', label: 'Club', icon: Shield },
  { id: 'market', label: 'Mercado', icon: Briefcase },
  { id: 'office', label: 'Oficina', icon: TrendingUp },
];

// Los 4 accesos juntos (Club, Mercado, Oficina y Partido) para el nav unificado de
// LiquidGlass en iPhone/iOS — en escritorio/otros dispositivos, "Partido" sigue siendo el
// botón circular verde separado de siempre (ver más abajo).
const GLASS_NAV_ITEMS = [...NAV_ITEMS, { id: 'match', label: 'Partido', icon: Gamepad2 }];

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center items-center gap-3 px-4 pointer-events-none pb-safe">
      {/* Escritorio y cualquier dispositivo que no sea iPhone/iOS en móvil: diseño original
          intacto (píldora de 3 accesos + botón circular "Partido" aparte). Oculto en
          iPhone/iOS móvil vía .desktop-default-nav (ver index.css). */}
      <div className="desktop-default-nav items-center gap-3">
        <div className="flex justify-between items-center p-1.5 w-full max-w-[260px] bg-surface/60 backdrop-blur-2xl border border-border rounded-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center w-[68px] h-[52px] rounded-[22px] transition-all duration-300 ${activeTab === id ? 'bg-well-strong text-green-500' : 'text-fg-muted hover:text-fg-secondary'}`}>
              <Icon size={18} className={activeTab === id ? 'mb-0.5 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'mb-0.5'} />
              <span className="text-[7px] font-black uppercase tracking-widest">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setActiveTab('match')}
          className={`pointer-events-auto shrink-0 flex flex-col items-center justify-center w-[64px] h-[64px] rounded-full bg-emerald-600 text-white shadow-[0_10px_30px_rgba(5,150,105,0.5)] border-2 transition-all duration-300 active:scale-90 ${activeTab === 'match' ? 'border-white/70 scale-105' : 'border-emerald-400/40 hover:border-white/40'}`}
        >
          <Gamepad2 size={22} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
          <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">Partido</span>
        </button>
      </div>

      {/* iPhone/iOS en móvil: nav unificado con LiquidGlass, los 4 accesos juntos en una
          sola píldora de cristal líquido. Oculto en escritorio/otros dispositivos vía
          .liquid-glass-mobile-nav (ver index.css). */}
      <LiquidGlass className="liquid-glass-mobile-nav rounded-[50px] pointer-events-auto w-full max-w-[320px]" blur={0} chromaticAberration={2}>
        <nav className="flex items-center justify-around px-6 py-3 text-white">
          {GLASS_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-300 ${activeTab === id ? 'text-white' : 'text-white/50'}`}>
              <Icon size={20} className={activeTab === id ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : ''} />
              <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
            </button>
          ))}
        </nav>
      </LiquidGlass>
    </div>
  );
}
