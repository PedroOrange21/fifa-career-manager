import { useEffect, useState } from 'react';

export function useDragAndDrop({ players, executeMove }) {
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedSourceSlot, setDraggedSourceSlot] = useState(null);
  const [floatingDrag, setFloatingDrag] = useState(null);

  useEffect(() => {
    if (!floatingDrag) return;
    const handleGlobalTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
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
    setDraggedPlayer(playerId); setDraggedSourceSlot(slotIndex);
    setFloatingDrag({ player, sourceSlot: slotIndex, x: touch.clientX, y: touch.clientY });
  };

  return {
    draggedPlayer, floatingDrag,
    handleDragStart, handleDragOver, handleDrop, handleTouchStartLocal,
  };
}
