import { useEffect } from 'react';

// Contador a nivel de módulo (no de React) para que, si hay varios modales abiertos a la
// vez (p. ej. el asistente de Fichar Jugador + un ConfirmModal encima), el scroll no se
// desbloquee hasta que se cierre el último. Fijar el body con position:fixed (en vez de
// solo overflow:hidden) es necesario porque iOS Safari ignora overflow:hidden en el body
// y sigue permitiendo el "rubber-band scroll" del contenido de detrás.
let lockCount = 0;
let savedScrollY = 0;

export function useBodyScrollLock() {
  useEffect(() => {
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    }
    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, []);
}
