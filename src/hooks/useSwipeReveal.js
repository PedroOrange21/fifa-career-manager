import { useEffect, useRef, useState } from 'react';

// Distancia extra de arrastre, más allá del panel de botones, necesaria para que el rótulo
// rojo de "Borrar" llegue al 100% (dragProgress === 1). Fija, no depende del ancho de la fila.
const DELETE_ZONE_EXTRA = 80;

// Gesto de deslizar compartido por las filas de jugador de toda la app (Plantilla, Academia,
// Operaciones). El botón de "Borrar" siempre es el primero en asomar al arrastrar (ver
// SwipeableRow: el panel está anclado a la derecha y el último botón del array — Borrar — es
// el más próximo al borde). Por eso "dragProgress" empieza a crecer desde el primer píxel del
// gesto, de forma continua y proporcional al arrastre, en vez de esperar a que se revele el
// panel completo: así el rótulo rojo se adelanta en cuanto Borrar empieza a mostrarse.
//
// El resto del recorrido sigue delimitado por "actionWidth" (el ancho real del panel de
// botones de cada fila — 2, 3 o 4 acciones según la lista) solo a efectos de qué ocurre al
// SOLTAR el dedo: soltar más allá del panel completo (offset ≤ -actionWidth) dispara
// onFullSwipe directamente (que siempre debe abrir una confirmación antes de borrar nada);
// soltar pasada la mitad del panel lo deja abierto revelando los botones; soltar antes de eso
// cierra la fila. "dragProgress" sigue creciendo hasta 1 en el tope de recorrido (actionWidth +
// DELETE_ZONE_EXTRA), un poco más allá de ese punto de soltar, para que la animación nunca se
// sienta "cortada" justo cuando se dispara el borrado.
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
        // Crece de 0 (dedo en reposo) a 1 (tope de arrastre) desde el primer píxel del gesto,
        // no solo al superar el panel de botones — el rótulo rojo se adelanta en cuanto Borrar
        // (el primer botón en asomar) empieza a revelarse.
        setDragProgress(Math.min(1, next / drag.maxDrag));
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
