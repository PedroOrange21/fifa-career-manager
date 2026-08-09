import { Users, LayoutDashboard, Target } from 'lucide-react';
import PlayerList from '../squad/PlayerList';
import TacticsTab from '../tactics/TacticsTab';
import AcademyTab from '../academy/AcademyTab';

const SUB_TABS = [
  { id: 'squad', label: 'Plantilla', icon: Users },
  { id: 'tactics', label: 'Táctica', icon: LayoutDashboard },
  { id: 'academy', label: 'Cantera', icon: Target },
];

export default function ClubTab({
  subTab, setSubTab, onNavigateToScouting,
  pendingEditPlayer, onConsumePendingEdit, pendingPrefill, onConsumePendingPrefill,
}) {
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex bg-surface p-1 rounded-2xl border border-border-subtle">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${subTab === id ? (id === 'academy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-canvas text-fg shadow-sm border border-border-subtle') : 'text-fg-muted hover:text-fg-secondary'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {subTab === 'squad' && (
        <PlayerList
          pendingEditPlayer={pendingEditPlayer} onConsumePendingEdit={onConsumePendingEdit}
          pendingPrefill={pendingPrefill} onConsumePendingPrefill={onConsumePendingPrefill}
        />
      )}
      {subTab === 'tactics' && <TacticsTab onNavigateToScouting={onNavigateToScouting} />}
      {subTab === 'academy' && <AcademyTab />}
    </div>
  );
}
