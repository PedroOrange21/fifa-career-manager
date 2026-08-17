import { Trash2 } from 'lucide-react';
import { useSwipeReveal } from '../../hooks/useSwipeReveal';

// Ancho de cada botón del panel de swipe (Borrar/Editar/Más, Recuperar, Ejecutar Compra...).
export const SWIPE_BUTTON_WIDTH = 64;

// Gestor de deslizamiento único, compartido por Plantilla, Academia y Operaciones: la misma
// mecánica de arrastre (useSwipeReveal), el mismo panel de botones revelado en un swipe corto
// y el mismo rótulo rojo de "Borrar" que crece de forma continua (dragProgress) al completar
// el gesto largo, en vez de que cada página reimplemente por su cuenta este bloque.
//
// "buttons" es la lista ordenada de acciones del panel — el panel está anclado a la derecha,
// así que el ÚLTIMO botón del array es el primero en asomar al iniciar el arrastre (mismo
// criterio ya usado en Plantilla antes de esta unificación). Cada botón admite:
//   - ref: opcional, para que el padre distinga "clic en este botón" de "clic fuera" cuando
//     abre un menú propio (p. ej. "Más opciones").
//   - danger: pinta el botón en rojo (reservado para Borrar).
//   - closeOnClick: por defecto true; ponerlo a false si el propio onClick abre otro panel
//     (como el menú "Más") y no debe cerrar el swipe todavía.
//
// El contenido de cada fila (avatar, nombre, badges…) es completamente distinto entre
// Plantilla/Academia/Operaciones, así que se recibe como render-prop ("children" es una
// función) en vez de intentar forzar un único layout de tarjeta para las tres páginas.
export default function SwipeableRow({ onFullSwipe, buttons, rounded = false, children }) {
  const actionWidth = SWIPE_BUTTON_WIDTH * buttons.length;
  const { rowRef, offset, dragging, dragProgress, close } = useSwipeReveal(onFullSwipe, actionWidth);
  const roundedClass = rounded ? 'rounded-xl' : '';

  return (
    <div className={`relative overflow-hidden ${roundedClass}`}>
      <div className="absolute inset-y-0 right-0 flex sm:hidden">
        {buttons.map(({ key, ref, icon: Icon, label, onClick, danger, closeOnClick = true }) => (
          <button
            key={key}
            ref={ref}
            type="button"
            onClick={(e) => { onClick(e); if (closeOnClick) close(); }}
            className={`w-16 flex flex-col items-center justify-center gap-1 touch-manipulation ${danger ? 'bg-red-500 text-white active:bg-red-400' : 'bg-well-strong text-fg-muted active:bg-well'}`}
          >
            <Icon size={16} />
            <span className="text-[7px] font-black uppercase leading-tight text-center px-0.5">{label}</span>
          </button>
        ))}
      </div>

      {children({ rowRef, offset, dragging, close })}

      {/* Borrado fluido y continuo (solo móvil): el rótulo rojo de "Borrar" crece desde el
          primer píxel de arrastre (dragProgress 0→1) hasta el tope del gesto, idéntico en
          Plantilla, Academia y Operaciones. */}
      <div className={`absolute inset-y-0 right-0 z-10 bg-red-500 sm:hidden pointer-events-none ${roundedClass}`} style={{ width: `${dragProgress * 100}%`, transition: dragging ? 'none' : 'width 200ms ease-out' }} />
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-white font-black uppercase text-sm sm:hidden pointer-events-none" style={{ opacity: dragProgress, transition: dragging ? 'none' : 'opacity 200ms ease-out' }}>
        <Trash2 size={18} /> Borrar
      </div>
    </div>
  );
}
