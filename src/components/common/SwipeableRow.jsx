import { Trash2 } from 'lucide-react';
import { useSwipeReveal, DELETE_BUTTON_WIDTH } from '../../hooks/useSwipeReveal';

// Ancho de cada botón del panel de gestión (Más opciones/Recuperar/Ejec. Opc. Compra, Editar…).
export const SWIPE_BUTTON_WIDTH = 64;

// Gestor de deslizamiento único, compartido por Plantilla, Academia y Operaciones, dividido
// por DIRECCIÓN (ver useSwipeReveal para el detalle exacto de los umbrales):
//
// Izquierda: revela el panel de gestión ("buttons") — nunca incluye Borrar, y hace tope fijo
// al final del panel (sin arrastre continuo ni animación de borrado hacia ese lado).
//
// Derecha: revela en solitario el botón de Borrar; seguir arrastrando más allá de él expande
// el rótulo rojo de forma continua (dragProgress) hasta cubrir la tarjeta hacia la derecha,
// para el borrado directo por arrastre a fondo.
//
// "buttons" es la lista ordenada de acciones del panel izquierdo — el panel está anclado a la
// derecha de la fila, así que el ÚLTIMO botón del array es el primero en asomar al iniciar el
// arrastre hacia la izquierda. Cada botón admite:
//   - ref: opcional, para que el padre distinga "clic en este botón" de "clic fuera" cuando
//     abre un menú propio (p. ej. "Más opciones").
//   - closeOnClick: por defecto true; ponerlo a false si el propio onClick abre otro panel
//     (como el menú "Más") y no debe cerrar el swipe todavía.
//
// El contenido de cada fila (avatar, nombre, badges…) es completamente distinto entre
// Plantilla/Academia/Operaciones, así que se recibe como render-prop ("children" es una
// función) en vez de intentar forzar un único layout de tarjeta para las tres páginas.
export default function SwipeableRow({ onDelete, buttons, rounded = false, children }) {
  const actionWidth = SWIPE_BUTTON_WIDTH * buttons.length;
  const { rowRef, offset, dragging, dragProgress, close } = useSwipeReveal(onDelete, actionWidth);
  const roundedClass = rounded ? 'rounded-xl' : '';

  return (
    <div className={`relative overflow-hidden ${roundedClass}`}>
      {/* Panel izquierdo (swipe hacia la izquierda): solo acciones de gestión, sin Borrar. */}
      <div className="absolute inset-y-0 right-0 flex sm:hidden">
        {buttons.map(({ key, ref, icon: Icon, label, onClick, closeOnClick = true }) => (
          <button
            key={key}
            ref={ref}
            type="button"
            onClick={(e) => { onClick(e); if (closeOnClick) close(); }}
            className="w-16 flex flex-col items-center justify-center gap-1 bg-well-strong text-fg-muted active:bg-well touch-manipulation"
          >
            <Icon size={16} />
            <span className="text-[7px] font-black uppercase leading-tight text-center px-0.5">{label}</span>
          </button>
        ))}
      </div>

      {/* Panel derecho (swipe hacia la derecha): Borrar en solitario. */}
      <div className="absolute inset-y-0 left-0 flex sm:hidden" style={{ width: DELETE_BUTTON_WIDTH }}>
        <button type="button" onClick={() => { onDelete(); close(); }} className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white active:bg-red-400 touch-manipulation">
          <Trash2 size={16} />
          <span className="text-[7px] font-black uppercase">Borrar</span>
        </button>
      </div>

      {children({ rowRef, offset, dragging, close })}

      {/* Fase 2 del swipe hacia la derecha (solo móvil): al superar el botón de Borrar, el
          rótulo rojo crece de forma continua (dragProgress 0→1) expandiéndose desde la
          izquierda hacia la derecha, idéntico en Plantilla, Academia y Operaciones. */}
      <div className={`absolute inset-y-0 left-0 z-10 bg-red-500 sm:hidden pointer-events-none ${roundedClass}`} style={{ width: `${dragProgress * 100}%`, transition: dragging ? 'none' : 'width 200ms ease-out' }} />
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden pointer-events-none" style={{ opacity: dragProgress, transition: dragging ? 'none' : 'opacity 200ms ease-out' }}>
        <Trash2 size={18} /> Borrar
      </div>
    </div>
  );
}
