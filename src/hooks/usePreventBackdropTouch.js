import { useEffect, useRef } from 'react';

// Bloquea el "scroll chaining" hacia la página de fondo cuando el usuario arrastra sobre
// el backdrop de un modal (la zona sin contenido scrolleable, fuera de la tarjeta). Usa un
// listener nativo con { passive: false } porque React registra los onTouchMove sintéticos
// como pasivos por defecto y no deja llamar a preventDefault() desde la prop JSX. Solo actúa
// si el toque empezó exactamente sobre el backdrop (e.target === el), nunca si empezó dentro
// de la tarjeta, para no interferir con su scroll interno (overflow-y-auto propio).
export function usePreventBackdropTouch(active) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const handleTouchMove = (e) => { if (e.target === el) e.preventDefault(); };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [active]);
  return ref;
}
