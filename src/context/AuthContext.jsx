import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged, signOut, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword,
} from 'firebase/auth';
import { auth, googleProvider, ensureAuthPersistence } from '../firebase';
import { resizeImageToDataUrl } from '../utils/image';

const AuthContext = createContext(null);

// Safari (escritorio o iOS) y navegadores móviles en general bloquean o cierran de forma poco
// fiable el popup de Google (aparece "No se pudo iniciar sesión con Google" o el usuario queda
// varado en una pestaña huérfana), así que ahí se usa redirección completa en vez de popup.
const isMobileOrSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isMobile || isSafari;
};

// Códigos de error de signInWithPopup ante los que tiene sentido reintentar automáticamente
// con signInWithRedirect en vez de mostrar un error directamente al usuario.
const POPUP_FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
];

// Marca propia (independiente de Firebase) de que se acaba de iniciar una redirección a
// Google: sobrevive a la navegación completa porque sessionStorage persiste en la misma
// pestaña. Sirve para distinguir, al volver, entre "no había ninguna redirección pendiente"
// (getRedirectResult(null) es normal) y "SÍ la había pero Firebase no logró detectarla" (el
// síntoma típico de Safari/iOS con ITP: Google completa el login pero la app nunca recibe el
// resultado), caso en el que merece la pena reintentar y avisar explícitamente al usuario en
// vez de devolverlo en silencio a la pantalla de Login.
const REDIRECT_PENDING_KEY = 'fifa-manager-google-redirect-pending';
const markRedirectPending = () => { try { sessionStorage.setItem(REDIRECT_PENDING_KEY, '1'); } catch { /* Safari privado puede bloquear sessionStorage; no es crítico. */ } };
const consumeRedirectPending = () => {
  try {
    const wasPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    return wasPending;
  } catch { return false; }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [googleRedirectError, setGoogleRedirectError] = useState('');

  // La pantalla de carga (loadingApp) no debe apagarse hasta que AMBAS señales hayan
  // llegado: el primer disparo de onAuthStateChanged Y la resolución de getRedirectResult.
  // Si solo se esperara a onAuthStateChanged, en Safari/móvil podía dispararse una primera
  // vez con el usuario aún en null (antes de que Firebase terminara de procesar la vuelta
  // de la redirección de Google), provocando que la app mostrara un parpadeo del login o
  // se quedara varada en él en vez de esperar el resultado real.
  const authReadyRef = useRef(false);
  const redirectCheckedRef = useRef(false);
  const finishLoadingIfReady = () => {
    if (authReadyRef.current && redirectCheckedRef.current) setLoadingApp(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      authReadyRef.current = true;
      finishLoadingIfReady();
    });
    return () => unsubscribe();
  }, []);

  // Recoge el resultado del inicio de sesión con Google al volver de la redirección completa
  // (signInWithRedirect navega fuera de la app; al volver, esta promesa entrega directamente
  // las credenciales si había un login pendiente, o se resuelve con null si no la había, sin
  // que eso se considere un error). Los errores se registran para depuración y se muestran al
  // usuario, pero nunca bloquean el arranque de la app.
  useEffect(() => {
    const resolveRedirect = async () => {
      const wasPending = consumeRedirectPending();
      try {
        let result = await getRedirectResult(auth);
        console.info('[Auth] getRedirectResult (1er intento):', result ? `usuario ${result.user?.email}` : 'sin resultado', '| redirección esperada:', wasPending);

        // Si esperábamos un resultado (se marcó justo antes de redirigir) pero llegó vacío,
        // puede ser una carrera de timing en Safari/iOS: se reintenta una vez tras una breve
        // espera antes de asumir que Firebase realmente no detectó la vuelta de Google.
        if (!result?.user && wasPending) {
          await wait(400);
          result = await getRedirectResult(auth);
          console.info('[Auth] getRedirectResult (2º intento tras espera):', result ? `usuario ${result.user?.email}` : 'sin resultado');
        }

        if (result?.user) {
          // Defensivo: en algunos casos de Safari/iOS con ITP, onAuthStateChanged puede
          // tardar en reflejar el resultado. Si getRedirectResult ya trae un usuario válido,
          // se guarda aquí directamente en vez de esperar a ese otro disparo.
          setUser(result.user);
        } else if (wasPending) {
          // Google completó el login (se navegó y se volvió), pero Firebase no logró asociar
          // el resultado con esta sesión — típico bloqueo de ITP sobre el iframe de authDomain
          // en Safari/iOS. Se avisa explícitamente en vez de devolver al usuario en silencio a
          // un formulario de Login vacío sin explicación.
          console.warn('[Auth] Se esperaba resultado de redirección de Google y no llegó ninguno (posible bloqueo de ITP en Safari/iOS).');
          setGoogleRedirectError('Safari bloqueó la respuesta de Google. Inténtalo de nuevo o desactiva "Impedir seguimiento entre sitios" para este sitio.');
        }
      } catch (err) {
        console.error('[Auth] Error al procesar getRedirectResult:', err?.code || err?.message || err);
        setGoogleRedirectError('No se pudo iniciar sesión con Google.');
      } finally {
        redirectCheckedRef.current = true;
        finishLoadingIfReady();
      }
    };
    resolveRedirect();
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleRedirectError('');
    // La persistencia se fija también aquí (y no solo una vez al cargar firebase.js) para
    // garantizar que ya esté aplicada justo antes de iniciar el login, evitando que Safari
    // pierda la sesión al volver de la redirección.
    await ensureAuthPersistence();

    if (isMobileOrSafari()) {
      // En Safari/iOS el popup de Google es poco fiable (ITP puede bloquear las cookies de
      // terceros que necesita para completarse), así que se va directo a redirección
      // completa. La navegación fuera de la página corta la ejecución aquí; el resultado
      // (éxito o error) se recoge en el useEffect de getRedirectResult al volver.
      markRedirectPending();
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // Si el popup fue bloqueado o cerrado antes de completarse, se reintenta con
      // redirección completa en vez de mostrar un error directamente.
      if (POPUP_FALLBACK_CODES.includes(err?.code)) {
        markRedirectPending();
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error('[Auth] signInWithPopup falló:', err?.code || err?.message || err);
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
    user, loadingApp, googleRedirectError,
    handleGoogleLogin, handleEmailAuth, handleLogout,
    handleUpdateName, handleUpdatePassword, handlePhotoUpload,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
