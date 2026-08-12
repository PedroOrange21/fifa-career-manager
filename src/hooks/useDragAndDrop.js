import { useEffect, useRef, useState } from 'react';

// Umbral de movimiento (px) para distinguir un arrastre real de un simple toque/tap.
const DRAG_MOVE_THRESHOLD = 8;
// Ventana (ms) durante la cual se ignora el "click fantasma" que algunos navegadores móviles
// disparan tras un touchend, para que no reabra un modal justo después de soltar un jugador.
const CLICK_SUPPRESS_MS = 350;
// Auto-scroll al arrastrar cerca del borde superior/inferior del viewport: franja (px) desde
// cada borde donde se activa, y velocidad máxima (px por fotograma) al llegar justo al borde,
// escalando suavemente a 0 en el límite exterior de la franja.
const AUTO_SCROLL_EDGE = 90;
const AUTO_SCROLL_MAX_SPEED = 16;

const UNCALLED_TARGETS = ['uncalled', 'forLoan', 'forSale', 'loanedOut'];

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.debug('[drag]', ...args);
};

const resolveTargetSlot = (element) => {
  let targetSlot = element.getAttribute('data-slot');
  if (!UNCALLED_TARGETS.includes(targetSlot) && !targetSlot.startsWith('bench-')) {
    targetSlot = parseInt(targetSlot, 10);
  }
  return targetSlot;
};

export function useDragAndDrop({ players, executeMove }) {
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedSourceSlot, setDraggedSourceSlot] = useState(null);
  const [floatingDrag, setFloatingDrag] = useState(null);

  // Estado "vivo" del arrastre táctil en curso, leído/escrito por ref para que los listeners
  // globales se registren UNA sola vez (evita el desmontaje/remontaje en cada touchmove que
  // provocaba pérdida de eventos y bloqueaba el arrastre en algunos móviles).
  const activeTouchDragRef = useRef(null);
  const suppressClickRef = useRef(false);
  // Última posición Y conocida del puntero/dedo mientras se arrastra, actualizada tanto por
  // touchmove (móvil) como por dragover (ratón, ver el useEffect del auto-scroll). Se lee en
  // cada fotograma del bucle de auto-scroll sin necesidad de recrear listeners.
  const pointerYRef = useRef(null);
  const autoScrollRafRef = useRef(null);

  // Los listeners táctiles se adjuntan una única vez al montar el hook (no dependen de estado
  // reactivo), leyendo siempre el arrastre activo desde `activeTouchDragRef`.
  useEffect(() => {
    const handleGlobalTouchMove = (e) => {
      const drag = activeTouchDragRef.current;
      if (!drag) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (!drag.moved) {
        const dx = touch.clientX - drag.startX;
        const dy = touch.clientY - drag.startY;
        if (Math.hypot(dx, dy) > DRAG_MOVE_THRESHOLD) drag.moved = true;
      }
      pointerYRef.current = touch.clientY;
      setFloatingDrag({ player: drag.player, sourceSlot: drag.sourceSlot, x: touch.clientX, y: touch.clientY });
    };

    const finishTouchDrag = () => {
      activeTouchDragRef.current = null;
      pointerYRef.current = null;
      setDraggedPlayer(null);
      setDraggedSourceSlot(null);
      setFloatingDrag(null);
    };

    const handleGlobalTouchEnd = (e) => {
      const drag = activeTouchDragRef.current;
      if (!drag) return;
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      const slotElement = dropTarget?.closest('[data-slot]');
      debugLog('touchend', { source: drag.sourceSlot, dropTarget: slotElement?.getAttribute('data-slot') ?? null });

      if (slotElement) {
        const targetSlot = resolveTargetSlot(slotElement);
        executeMove(drag.playerId, drag.sourceSlot, targetSlot);
      }

      // Solo suprimimos el click sintético posterior si hubo un arrastre real; así un
      // toque simple (sin mover el dedo) sigue abriendo la ficha del jugador con normalidad.
      if (drag.moved) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, CLICK_SUPPRESS_MS);
      }

      finishTouchDrag();
    };

    const handleGlobalTouchCancel = () => {
      // El sistema operativo puede interrumpir el gesto (llamada entrante, notificación, etc.).
      // Sin este manejador, el "fantasma" flotante quedaba encallado en pantalla.
      if (!activeTouchDragRef.current) return;
      debugLog('touchcancel: arrastre abortado');
      finishTouchDrag();
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleGlobalTouchCancel, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchCancel);
    };
  }, [executeMove]);

  // Rastreo de la posición Y del ratón durante un arrastre nativo (HTML5 DnD): "dragover" solo
  // dispara sobre elementos con su propio handler (los slots/zonas), pero al burbujear hasta
  // document seguimos recibiendo clientY aunque el puntero pase por zonas sin drop-target
  // registrado (p.ej. el borde superior/inferior de la página), que es justo donde hace falta
  // para el auto-scroll. "dragend" es una red de seguridad: si el usuario suelta fuera de
  // cualquier zona válida (sin que dispare "drop"), igualmente hay que limpiar el estado de
  // arrastre para que el auto-scroll se detenga de inmediato.
  useEffect(() => {
    const trackMouseY = (e) => { pointerYRef.current = e.clientY; };
    const handleGlobalDragEnd = () => {
      pointerYRef.current = null;
      setDraggedPlayer(null);
      setDraggedSourceSlot(null);
    };
    document.addEventListener('dragover', trackMouseY);
    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => {
      document.removeEventListener('dragover', trackMouseY);
      document.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // Bucle de auto-scroll: activo únicamente mientras hay un jugador arrastrándose (móvil o
  // escritorio). En cada fotograma comprueba la última posición Y conocida del puntero contra
  // los bordes del viewport y desplaza la página con window.scrollBy, con velocidad creciente
  // cuanto más cerca del borde. Se cancela solo (cleanup del efecto) en cuanto draggedPlayer
  // vuelve a null, sea por soltar sobre una zona válida, por touchend/touchcancel o por
  // dragend fuera de zona — nunca sigue corriendo tras finalizar el arrastre.
  useEffect(() => {
    if (!draggedPlayer) return;
    const tick = () => {
      const y = pointerYRef.current;
      if (y !== null) {
        const viewportHeight = window.innerHeight;
        if (y < AUTO_SCROLL_EDGE) {
          window.scrollBy(0, -AUTO_SCROLL_MAX_SPEED * (1 - y / AUTO_SCROLL_EDGE));
        } else if (y > viewportHeight - AUTO_SCROLL_EDGE) {
          window.scrollBy(0, AUTO_SCROLL_MAX_SPEED * (1 - (viewportHeight - y) / AUTO_SCROLL_EDGE));
        }
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    };
  }, [draggedPlayer]);

  const handleDragStart = (e, playerId, slotIndex) => {
    debugLog('mouse dragstart', { playerId, slotIndex });
    pointerYRef.current = e.clientY;
    setDraggedPlayer(playerId); setDraggedSourceSlot(slotIndex); e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; pointerYRef.current = e.clientY; };
  const handleDrop = (e, targetSlotIndex) => {
    e.preventDefault();
    debugLog('mouse drop', { from: draggedSourceSlot, to: targetSlotIndex });
    executeMove(draggedPlayer, draggedSourceSlot, targetSlotIndex);
    pointerYRef.current = null;
    setDraggedPlayer(null); setDraggedSourceSlot(null);
  };
  const handleTouchStartLocal = (e, playerId, slotIndex) => {
    const player = players.find((p) => p.id === playerId); if (!player) return;
    const touch = e.touches[0];
    debugLog('touchstart', { playerId, slotIndex });
    activeTouchDragRef.current = { playerId, sourceSlot: slotIndex, player, startX: touch.clientX, startY: touch.clientY, moved: false };
    pointerYRef.current = touch.clientY;
    setDraggedPlayer(playerId); setDraggedSourceSlot(slotIndex);
    setFloatingDrag({ player, sourceSlot: slotIndex, x: touch.clientX, y: touch.clientY });
  };
  const shouldSuppressClick = () => suppressClickRef.current;

  return {
    draggedPlayer, floatingDrag,
    handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal, shouldSuppressClick,
  };
}
