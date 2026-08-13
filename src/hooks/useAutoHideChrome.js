import { useLayoutEffect } from 'react';
import { useUiChrome } from '../context/UiChromeContext';

// Estándar del proyecto para cualquier modal/tarjeta emergente a pantalla completa (fichas,
// formularios, confirmaciones, desgloses...): oculta automáticamente la cabecera y la barra
// de navegación flotante mientras el componente que llama a este hook está montado, y las
// restaura al desmontarse. Se apoya en el contador de UiChromeContext, así que varios
// modales abiertos a la vez (uno sobre otro) no se pisan entre sí: la cabecera/nav solo
// vuelve a aparecer cuando se cierra el último.
//
// useLayoutEffect (no useEffect) a propósito: se ejecuta de forma síncrona antes de que el
// navegador pinte el fotograma, así que cabecera/nav desaparecen en el mismo pintado en que
// aparece el modal, sin un frame intermedio donde ambos convivan en pantalla.
//
// Para que un modal nuevo herede este comportamiento "por defecto" basta con llamar a este
// hook nada más entrar en el componente — no hace falta reimplementar el efecto de hide/show
// en cada vista nueva, ni acordarse de ocultar la cabecera desde el componente padre que lo
// abre.
export function useAutoHideChrome() {
  const { hide, show } = useUiChrome();
  useLayoutEffect(() => {
    hide();
    return () => show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
