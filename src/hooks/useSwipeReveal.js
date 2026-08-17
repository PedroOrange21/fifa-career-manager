import { useEffect, useRef, useState } from 'react';

// Ancho fijo del botón de Borrar (el único que vive en el lado derecho del gesto).
export const DELETE_BUTTON_WIDTH = 64;
// Distancia extra de arrastre, más allá del botón de Borrar, necesaria para que el rótulo
// rojo llegue al 100% (dragProgress === 1) y se comprometa el borrado directo.
const DELETE_ZONE_EXTRA = 80;

// Gesto de deslizar compartido por las filas de jugador de toda la app (Plantilla, Academia,
// Operaciones), dividido por DIRECCIÓN:
//
// Izquierda (offset negativo, hasta -actionWidth): revela el panel de gestión (Más
// opciones/Recuperar/Ejec. Opc. Compra, Editar…) fijo detrás de la fila. Tope duro en
// -actionWidth — no hay borrado ni arrastre continuo hacia este lado, la fila simplemente no
// se mueve más allá de ese punto.
//
// Derecha (offset positivo): revela el botón de Borrar en solitario. De 0 a
// DELETE_BUTTON_WIDTH es la zona de revelado — soltar aquí deja el botón abierto y pulsable.
// Superando ese punto ("Arrastre continuo a fondo") empieza la Fase 2: "dragProgress" crece de
// 0 a 1 según se avanza hasta el tope de recorrido (DELETE_BUTTON_WIDTH + DELETE_ZONE_EXTRA),
// para que el rótulo rojo cubra la tarjeta hacia la derecha de forma fluida. Soltar en
// cualquier punto de esta fase dispara onDelete directamente (que siempre debe abrir una
// confirmación antes de borrar nada).
//
// Usa un listener nativo de touchmove con { passive: false } porque React registra los
// onTouchMove sintéticos como pasivos por defecto y no deja llamar a preventDefault() desde la
// prop JSX (necesario aquí para bloquear el scroll vertical de la lista mientras se arrastra en
// horizontal). El eje del gesto (horizontal vs vertical) se decide en los primeros píxeles de
// movimiento y ya no cambia durante ese mismo toque.
//
// El efecto se suscribe UNA sola vez (deps []): si "onDelete" (una función definida en línea
// por el padre) formara parte de las dependencias, el efecto se desmontaría y volvería a
// montar los listeners nativos en mitad de un arrastre real, cortando el gesto y obligando a
// soltar y volver a deslizar. Por eso la última versión de onDelete se guarda en un ref que el
// listener siempre lee "en caliente".
export function useSwipeReveal(onDelete, actionWidth = 128) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const rowRef = useRef(null);
  const offsetRef = useRef(0);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const actionWidthRef = useRef(actionWidth);
  actionWidthRef.current = actionWidth;

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const drag = { startX: 0, startY: 0, active: false, axis: null, startOffset: 0, deleteThreshold: DELETE_BUTTON_WIDTH, deleteMax: DELETE_BUTTON_WIDTH + DELETE_ZONE_EXTRA };
    const onStart = (e) => {
      const t = e.touches[0];
      drag.startX = t.clientX; drag.startY = t.clientY; drag.active = true; drag.axis = null; drag.startOffset = offsetRef.current;
    };
    const onMove = (e) => {
      if (!drag.active) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'x') setDragging(true);
      }
      if (drag.axis === 'x') {
        e.preventDefault();
        // Izquierda: tope duro en -actionWidth. Derecha: hasta deleteMax (botón + zona de
        // borrado continuo).
        const next = Math.max(-actionWidthRef.current, Math.min(drag.deleteMax, drag.startOffset + dx));
        offsetRef.current = next;
        setOffset(next);
        // 0 mientras se revela solo el botón de Borrar, crece de 0 a 1 al superarlo.
        const growth = next > drag.deleteThreshold ? Math.min(1, (next - drag.deleteThreshold) / (drag.deleteMax - drag.deleteThreshold)) : 0;
        setDragProgress(growth);
      }
    };
    const onEnd = () => {
      if (drag.axis === 'x') {
        const final = offsetRef.current;
        if (final >= drag.deleteThreshold) {
          // Se soltó en o más allá del botón de Borrar del todo revelado: borrado directo.
          offsetRef.current = 0; setOffset(0);
          onDeleteRef.current();
        } else if (final > DELETE_BUTTON_WIDTH / 2) {
          // Pasada la mitad del botón: queda revelado y pulsable, sin borrar todavía.
          offsetRef.current = DELETE_BUTTON_WIDTH; setOffset(DELETE_BUTTON_WIDTH);
        } else if (final < -actionWidthRef.current / 2) {
          // Pasada la mitad del panel de gestión: queda abierto.
          offsetRef.current = -actionWidthRef.current; setOffset(-actionWidthRef.current);
        } else {
          offsetRef.current = 0; setOffset(0);
        }
      }
      drag.active = false;
      drag.axis = null;
      setDragging(false);
      setDragProgress(0);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const close = () => { offsetRef.current = 0; setOffset(0); };
  return { rowRef, offset, dragging, dragProgress, close };
}

// Ancho del panel de gestión revelado al deslizar hacia la izquierda: 3 botones de 64px (w-16)
// cada uno.
export const ROW_ACTION_WIDTH = 192;
