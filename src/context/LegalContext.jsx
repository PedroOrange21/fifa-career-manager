import { createContext, useContext, useState } from 'react';
import LegalModal from '../components/legal/LegalModal';

const LegalContext = createContext(null);

// Punto de acceso único a los textos legales (Política de Privacidad/Cookies y Términos y
// Condiciones): expone openPrivacy/openTerms para que cualquier componente (banner de
// cookies, pie de página del login, perfil de usuario...) pueda abrir el modal correspondiente
// sin pasar props a través de varios niveles. Montado en la raíz de App.jsx, así que funciona
// igual antes y después de iniciar sesión.
export function LegalProvider({ children }) {
  const [openType, setOpenType] = useState(null); // 'privacy' | 'terms' | null

  const value = {
    openPrivacy: () => setOpenType('privacy'),
    openTerms: () => setOpenType('terms'),
  };

  return (
    <LegalContext.Provider value={value}>
      {children}
      {openType && <LegalModal type={openType} onClose={() => setOpenType(null)} />}
    </LegalContext.Provider>
  );
}

export const useLegal = () => useContext(LegalContext);
