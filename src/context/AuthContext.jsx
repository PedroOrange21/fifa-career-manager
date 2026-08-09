import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signOut, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, updatePassword,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { resizeImageToDataUrl } from '../utils/image';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingApp(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      throw new Error('No se pudo iniciar sesión con Google.');
    }
  };

  const handleEmailAuth = async ({ mode, email, password, displayName }) => {
    if (!email || !password) throw new Error('Rellena todos los campos.');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName) throw new Error('Escribe un nombre de Míster.');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        setUser({ ...cred.user, displayName });
      }
    } catch (err) {
      if (err.message === 'Escribe un nombre de Míster.') throw err;
      throw new Error('Error de autenticación. Verifica los datos.');
    }
  };

  const handleLogout = () => signOut(auth);

  const handleUpdateName = async (name) => {
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      setUser({ ...auth.currentUser, displayName: name });
    } catch (err) {
      throw new Error('Error al actualizar.');
    }
  };

  const handleUpdatePassword = async (newPassword) => {
    if (newPassword.length < 6) throw new Error('Mínimo 6 caracteres.');
    try {
      await updatePassword(auth.currentUser, newPassword);
    } catch (err) {
      throw new Error('Por seguridad, cierra sesión e intenta de nuevo.');
    }
  };

  const handlePhotoUpload = async (file) => {
    try {
      const dataUrl = await resizeImageToDataUrl(file, 150, 0.7);
      await updateProfile(auth.currentUser, { photoURL: dataUrl });
      setUser({ ...auth.currentUser, photoURL: dataUrl });
    } catch (err) {
      throw new Error('Error al actualizar la foto.');
    }
  };

  const value = {
    user, loadingApp,
    handleGoogleLogin, handleEmailAuth, handleLogout,
    handleUpdateName, handleUpdatePassword, handlePhotoUpload,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
