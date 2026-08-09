import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import MatchSetup from './MatchSetup';
import MatchControlPanel from './MatchControlPanel';

export default function MatchTab() {
  const [session, setSession] = useState(null);
  const [finished, setFinished] = useState(false);

  if (finished) {
    return (
      <div className="bg-surface p-8 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl text-center animate-in fade-in space-y-4">
        <CheckCircle2 className="mx-auto text-green-500" size={40} />
        <h2 className="text-lg font-black uppercase italic tracking-tighter text-fg">Partido Guardado</h2>
        <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">Las estadísticas de la plantilla se han actualizado</p>
        <button onClick={() => { setFinished(false); setSession(null); }} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-green-400 transition-all">Registrar Otro Partido</button>
      </div>
    );
  }

  if (!session) {
    return <MatchSetup onStart={setSession} />;
  }

  return (
    <MatchControlPanel
      opponent={session.opponent}
      starters={session.starters}
      onCancel={() => setSession(null)}
      onFinish={() => setFinished(true)}
    />
  );
}
