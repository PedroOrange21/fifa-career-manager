import { useEffect, useRef, useState } from 'react';

// Distancia extra de arrastre, más allá del panel de botones, necesaria para que el rótulo
// rojo de "Borrar" llegue al 100% (dragProgress === 1). Fija, no depende del ancho de la fila.
const DELETE_ZONE_EXTRA = 80;

// Gesto de deslizar compartido por las filas de jugador de toda la app (Plantilla, Academia,
// Operaciones), en dos fases claramente delimitadas por "actionWidth" (el ancho real del panel
// de botones de cada fila — 2, 3 o 4 acciones según la lista, ver SwipeableRow):
//
// Fase 1 (0 a -actionWidth): arrastre corto. La fila se desliza revelando progresivamente el
// panel de acciones (Editar/Borrar/Más/Recuperar…) que hay fijo detrás, visibles y pulsables
// con total normalidad. Sin rótulo rojo todavía. Al soltar dentro de esta fase: si se pasó de
// la mitad del panel, éste queda abierto (offset = -actionWidth); si no, la fila vuelve a su
// sitio.
//
// Fase 2 (más allá de -actionWidth): arrastre continuo a fondo, superando por completo el
// bloque de botones. "dragProgress" crece de 0 a 1 según se avanza desde el borde del panel
// hasta el tope de recorrido (actionWidth + DELETE_ZONE_EXTRA), para que el rótulo rojo de
// "Borrar" cubra la tarjeta de forma fluida en vez de aparecer de golpe. Soltar en cualquier
// punto de esta fase dispara onFullSwipe (que siempre debe abrir una confirmación antes de
// borrar nada) — no hace falta llegar al 100%.
//
// Usa un listener nativo de touchmove con { passive: false } porque React registra los
// onTouchMove sintéticos como pasivos por defecto y no deja llamar a preventDefault() desde la
// prop JSX (necesario aquí para bloquear el scroll vertical de la lista mientras se arrastra en
// horizontal). El eje del gesto (horizontal vs vertical) se decide en los primeros píxeles de
// movimiento y ya no cambia durante ese mismo toque.
//
// El efecto se suscribe UNA sola vez (deps []): si "onFullSwipe" (una función definida en
// línea por el padre) formara parte de las dependencias, el efecto se desmontaría y volvería
// a montar los listeners nativos en mitad de un arrastre real, cortando el gesto y obligando
// a soltar y volver a deslizar. Por eso la última versión de onFullSwipe se guarda en un ref
// que el listener siempre lee "en caliente".
export function useSwipeReveal(onFullSwipe, actionWidth = 128) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const rowRef = useRef(null);
  const offsetRef = useRef(0);
  const onFullSwipeRef = useRef(onFullSwipe);
  onFullSwipeRef.current = onFullSwipe;
  const actionWidthRef = useRef(actionWidth);
  actionWidthRef.current = actionWidth;

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const drag = { startX: 0, startY: 0, active: false, axis: null, startOffset: 0, threshold: -160, maxDrag: -240 };
    const onStart = (e) => {
      const t = e.touches[0];
      drag.startX = t.clientX; drag.startY = t.clientY; drag.active = true; drag.axis = null; drag.startOffset = offsetRef.current;
      // El límite de la Fase 1 es el ancho real del panel de botones (no un % del ancho de la
      // fila): así las dos fases quedan siempre alineadas con los botones que de verdad hay
      // debajo, tanto si son 2 (Academia) como 4 (Operaciones, Cedidos con opción de compra).
      drag.threshold = -actionWidthRef.current;
      drag.maxDrag = drag.threshold - DELETE_ZONE_EXTRA;
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
        const next = Math.max(drag.maxDrag, Math.min(0, drag.startOffset + dx));
        offsetRef.current = next;
        setOffset(next);
        // 0 mientras se está dentro del panel de botones (Fase 1), crece de 0 a 1 solo al
        // superarlo (Fase 2), hasta el tope de recorrido.
        const growth = next <= drag.threshold ? Math.min(1, (next - drag.threshold) / (drag.maxDrag - drag.threshold)) : 0;
        setDragProgress(growth);
      }
    };
    const onEnd = () => {
      if (drag.axis === 'x') {
        const final = offsetRef.current;
        if (final <= drag.threshold) {
          // Fase 2: se soltó más allá del panel de botones, borrado directo.
          offsetRef.current = 0; setOffset(0);
          onFullSwipeRef.current();
        } else if (final < -actionWidthRef.current / 2) {
          // Fase 1, pasada la mitad del panel: queda abierto revelando los botones.
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

// Ancho del panel de acciones reveladas al deslizar: 3 botones de 64px (w-16) cada uno.
export const ROW_ACTION_WIDTH = 192;
