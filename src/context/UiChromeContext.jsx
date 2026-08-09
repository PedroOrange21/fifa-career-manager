import { createContext, useContext } from 'react';

// Permite que modales de pantalla completa (como el asistente de Fichar Jugador) oculten
// temporalmente la cabecera y la navegación inferior de ClubShell sin necesidad de pasar
// props a través de varios niveles de componentes intermedios.
export const UiChromeContext = createContext({ hide: () => {}, show: () => {} });

export const useUiChrome = () => useContext(UiChromeContext);
