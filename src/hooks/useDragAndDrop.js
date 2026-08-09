import { useEffect, useRef, useState } from 'react';

// Umbral de movimiento (px) para distinguir un arrastre real de un simple toque/tap.
const DRAG_MOVE_THRESHOLD = 8;
// Ventana (ms) durante la cual se ignora el "click fantasma" que algunos navegadores móviles
// disparan tras un touchend, para que no reabra un modal justo después de soltar un jugador.
const CLICK_SUPPRESS_MS = 350;

export function useDragAndDrop({ players, executeMove }) {
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedSourceSlot, setDraggedSourceSlot] = useState(null);
  const [floatingDrag, setFloatingDrag] = useState(null);
  const dragMovedRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!floatingDrag) return;
    const handleGlobalTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!dragMovedRef.current) {
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        if (Math.hypot(dx, dy) > DRAG_MOVE_THRESHOLD) dragMovedRef.current = true;
      }
      setFloatingDrag((prev) => (prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null));
    };
    const handleGlobalTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      const slotElement = dropTarget?.closest('[data-slot]');

      if (slotElement) {
        let targetSlot = slotElement.getAttribute('data-slot');
        if (targetSlot !== 'uncalled' && targetSlot !== 'forLoan' && targetSlot !== 'forSale' && targetSlot !== 'loanedOut' && !targetSlot.startsWith('bench-')) {
          targetSlot = parseInt(targetSlot, 10);
        }
        executeMove(floatingDrag.player.id, floatingDrag.sourceSlot, targetSlot);
      }

      // Solo suprimimos el click sintético posterior si hubo un arrastre real; así un
      // toque simple (sin mover el dedo) sigue abriendo la ficha del jugador con normalidad.
      if (dragMovedRef.current) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, CLICK_SUPPRESS_MS);
      }

      setDraggedPlayer(null); setDraggedSourceSlot(null); setFloatingDrag(null);
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [floatingDrag, players, executeMove]);

  const handleDragStart = (e, playerId, slotIndex) => {
    setDraggedPlayer(playerId); setDraggedSourceSlot(slotIndex); e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, targetSlotIndex) => {
    e.preventDefault(); executeMove(draggedPlayer, draggedSourceSlot, targetSlotIndex);
    setDraggedPlayer(null); setDraggedSourceSlot(null);
  };
  const handleTouchStartLocal = (e, playerId, slotIndex) => {
    const touch = e.touches[0]; const player = players.find((p) => p.id === playerId); if (!player) return;
    dragMovedRef.current = false;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    setDraggedPlayer(playerId); setDraggedSourceSlot(slotIndex);
    setFloatingDrag({ player, sourceSlot: slotIndex, x: touch.clientX, y: touch.clientY });
  };
  const shouldSuppressClick = () => suppressClickRef.current;

  return {
    draggedPlayer, floatingDrag,
    handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal, shouldSuppressClick,
  };
}
