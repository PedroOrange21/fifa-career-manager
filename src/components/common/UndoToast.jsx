import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';

const EXIT_MS = 250;

// Toast flotante y sutil (glassmorphism: fondo oscuro translúcido + blur) en la parte superior
// de la pantalla, con temporizador visual (ver @keyframes undo-countdown en index.css),
// reutilizado por cualquier acción crítica con ventana de "Deshacer": eliminar jugador,
// finalizar cesión, vender jugador o eliminar un objetivo de Mercado (ver pendingUndo/
// scheduleUndo en ClubDataContext). El elemento implicado ya desapareció visualmente de la
// vista correspondiente, pero el borrado real no se consolida en Firestore hasta que la barra
// llega a 0 sin que se pulse "Deshacer". Montado una única vez en ClubShell, por encima de
// cualquier pestaña, para que la ventana de deshacer sobreviva a la navegación entre tabs.
//
// entry/closing: pendingUndo pasa a null en el instante exacto en que se cancela o se
// consolida, pero para que la salida se vea como un fundido/deslizamiento suave (en vez de un
// desmontaje brusco) este componente retiene su propia copia ("entry") unos milisegundos más,
// solo para reproducir la transición de salida antes de desmontarse de verdad.
export default function UndoToast() {
  const { pendingUndo, cancelPendingUndo } = useClubData();
  const [entry, setEntry] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (pendingUndo) {
      setEntry(pendingUndo);
      setClosing(false);
      return;
    }
    if (!entry) return;
    setClosing(true);
    const t = setTimeout(() => setEntry(null), EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUndo]);

  if (!entry) return null;

  const durationMs = Math.max(entry.deadline - Date.now(), 0);

  return (
    <div
      className={`fixed inset-x-0 top-[76px] md:top-[84px] z-[260] flex justify-center px-4 pointer-events-none transition-all ease-out ${closing ? 'opacity-0 -translate-y-2 duration-200' : 'opacity-100 translate-y-0 duration-300'}`}
    >
      <div className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-full max-w-xs">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Undo2 size={14} className="text-yellow-400 shrink-0" />
          <p className="flex-1 min-w-0 text-[11px] font-medium text-white/85 truncate">{entry.label}</p>
          <button type="button" onClick={cancelPendingUndo} className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-yellow-400 hover:text-yellow-300 active:scale-95 transition-all touch-manipulation">
            Deshacer
          </button>
        </div>
        <div className="h-[3px] bg-white/10">
          {!closing && <div key={entry.kind + entry.id + entry.deadline} className="h-full bg-yellow-400" style={{ animation: `undo-countdown ${durationMs}ms linear forwards` }} />}
        </div>
      </div>
    </div>
  );
}
