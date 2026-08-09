import { Store, ArrowRightLeft } from 'lucide-react';
import MarketTab from './MarketTab';
import OperationsTab from './OperationsTab';

const SUB_TABS = [
  { id: 'scouting', label: 'Ojeadores', icon: Store },
  { id: 'operations', label: 'Operaciones', icon: ArrowRightLeft },
];

export default function MarketShell({ subTab, setSubTab, onSignScout, onRequestEditPlayer }) {
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="sticky top-[71px] md:top-[73px] z-30 flex bg-surface p-1 rounded-2xl border border-border-subtle shadow-lg">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 dark:focus:ring-0 dark:focus-visible:ring-0 dark:focus:outline-none active:shadow-none dark:active:bg-zinc-800 [-webkit-tap-highlight-color:transparent] ${subTab === id ? 'bg-canvas text-fg shadow-sm border border-border-subtle' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {subTab === 'scouting' && <MarketTab onSignScout={onSignScout} />}
      {subTab === 'operations' && <OperationsTab onRequestEditPlayer={onRequestEditPlayer} />}
    </div>
  );
}
