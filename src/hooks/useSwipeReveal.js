import { useEffect, useRef, useState } from 'react';

// Gesto de deslizar compartido por las filas de jugador de toda la app (Plantilla, Academia,
// Operaciones). Usa un listener nativo de touchmove con { passive: false } porque React
// registra los onTouchMove sintéticos como pasivos por defecto y no deja llamar a
// preventDefault() desde la prop JSX (necesario aquí para bloquear el scroll vertical de la
// lista mientras se arrastra en horizontal). El eje del gesto (horizontal vs vertical) se
// decide en los primeros píxeles de movimiento y ya no cambia durante ese mismo toque.
//
// Deslizamiento corto: deja la fila abierta (revela Editar/Eliminar). Deslizamiento largo —
// más de la mitad del ancho de la propia fila — activa la zona de borrado: a partir de ahí,
// "deleteProgress" crece de 0 a 1 de forma continua (no en un solo salto) a medida que se
// sigue arrastrando hasta el tope, para que el rótulo rojo de "Borrar" se expanda con
// suavidad en vez de aparecer de golpe. Si se suelta dentro de esa zona (deleteProgress > 0,
// equivalente al antiguo "pastThreshold"), dispara onFullSwipe (que siempre debe abrir una
// confirmación antes de borrar nada).
//
// El efecto se suscribe UNA sola vez (deps []): si "onFullSwipe" (una función definida en
// línea por el padre) formara parte de las dependencias, el efecto se desmontaría y volvería
// a montar los listeners nativos en mitad de un arrastre real, cortando el gesto y obligando
// a soltar y volver a deslizar. Por eso la última versión de onFullSwipe se guarda en un ref
// que el listener siempre lee "en caliente".
export function useSwipeReveal(onFullSwipe, actionWidth = 128) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pastThreshold, setPastThreshold] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  // Progreso continuo desde el primer píxel de arrastre (0) hasta el tope de recorrido (1),
  // a diferencia de "deleteProgress" (que solo crece en el último tramo, tras cruzar el 50%
  // del ancho). Pensado para overlays que deben sentirse fluidos y reactivos durante todo el
  // gesto, no solo al final — usado hoy por Operaciones; el resto de listas sigue leyendo
  // "deleteProgress" sin cambios.
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
      const width = el.getBoundingClientRect().width || 320;
      drag.threshold = -(width * 0.5);
      drag.maxDrag = drag.threshold - 80;
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
        setPastThreshold(next <= drag.threshold);
        // 0 justo al cruzar el 50% del ancho (drag.threshold), 1 al llegar al tope de
        // arrastre (drag.maxDrag) — el tramo "extra" que ya existía tras el umbral, ahora
        // usado para animar el crecimiento en vez de solo determinar un booleano.
        const growth = next <= drag.threshold ? Math.min(1, (next - drag.threshold) / (drag.maxDrag - drag.threshold)) : 0;
        setDeleteProgress(growth);
        setDragProgress(Math.min(1, next / drag.maxDrag));
      }
    };
    const onEnd = () => {
      if (drag.axis === 'x') {
        const final = offsetRef.current;
        if (final <= drag.threshold) {
          offsetRef.current = 0; setOffset(0);
          onFullSwipeRef.current();
        } else if (final < -actionWidthRef.current / 2) {
          offsetRef.current = -actionWidthRef.current; setOffset(-actionWidthRef.current);
        } else {
          offsetRef.current = 0; setOffset(0);
        }
      }
      drag.active = false;
      drag.axis = null;
      setDragging(false);
      setPastThreshold(false);
      setDeleteProgress(0);
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
  return { rowRef, offset, dragging, pastThreshold, deleteProgress, dragProgress, close };
}

// Ancho del panel de acciones reveladas al deslizar: 3 botones de 64px (w-16) cada uno.
export const ROW_ACTION_WIDTH = 192;
