import { DollarSign, PieChart } from 'lucide-react';
import FinanceTab from './FinanceTab';
import FinanceStatsTab from './FinanceStatsTab';

const SUB_TABS = [
  { id: 'finance', label: 'Finanzas', icon: DollarSign },
  { id: 'stats', label: 'Estadísticas', icon: PieChart },
];

export default function OfficeTab({ subTab, setSubTab }) {
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="sticky top-[71px] md:top-[73px] z-30 flex bg-surface p-1 rounded-2xl border border-border-subtle shadow-lg">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 dark:focus:ring-0 dark:focus-visible:ring-0 dark:focus:outline-none active:shadow-none dark:active:bg-zinc-800 [-webkit-tap-highlight-color:transparent] ${subTab === id ? 'bg-canvas text-fg shadow-sm border border-border-subtle' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {subTab === 'finance' && <FinanceTab />}
      {subTab === 'stats' && <FinanceStatsTab />}
    </div>
  );
}
