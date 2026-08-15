import { Undo2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';

// Toast flotante con temporizador visual (ver @keyframes undo-countdown en index.css) tras
// pulsar "Finalizar Cesión": el jugador ya desapareció de la Plantilla (ver "players" filtrado
// en ClubDataContext), pero el borrado real no se consolida en Firestore hasta que la barra
// llega a 0 sin que se pulse "Deshacer". Montado una única vez en ClubShell, por encima de
// cualquier pestaña, para que la ventana de deshacer sobreviva a la navegación entre tabs.
export default function EndLoanUndoToast() {
  const { pendingEndLoan, undoEndLoan } = useClubData();
  if (!pendingEndLoan) return null;

  const durationMs = pendingEndLoan.deadline - Date.now();

  return (
    <div
      key={pendingEndLoan.player.id + pendingEndLoan.deadline}
      className="fixed inset-x-0 bottom-20 md:bottom-6 z-[260] flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="pointer-events-auto bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0"><Undo2 size={16} /></div>
          <p className="flex-1 min-w-0 text-xs font-bold text-fg-secondary truncate">
            Cesión de <span className="text-fg font-black">{pendingEndLoan.player.name}</span> finalizada
          </p>
          <button type="button" onClick={undoEndLoan} className="shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 font-black uppercase text-[10px] hover:bg-yellow-500/20 active:scale-95 transition-all touch-manipulation">
            Deshacer
          </button>
        </div>
        <div className="h-1 bg-well-strong">
          <div className="h-full bg-yellow-500" style={{ animation: `undo-countdown ${durationMs}ms linear forwards` }} />
        </div>
      </div>
    </div>
  );
}
