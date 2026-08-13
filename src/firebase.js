import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCXNwNdKeE_Yr97iaFV_Ezw5GabBYasdnY',
  authDomain: 'fifa-manger.firebaseapp.com',
  projectId: 'fifa-manger',
  storageBucket: 'fifa-manger.firebasestorage.app',
  messagingSenderId: '945035024406',
  appId: '1:945035024406:web:0e2d4e42c81f910f223d37',
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const appId = 'fifa-manager-main';

// Persistencia explícita en localStorage: sin esto, Safari/iOS (sobre todo con "Impedir
// seguimiento entre sitios" activo) puede perder el estado de la operación de login pendiente
// justo al volver de la redirección de Google, provocando que el usuario vuelva a la pantalla
// de Login sin haber iniciado sesión. Se fija aquí, lo antes posible al cargar el módulo, y se
// vuelve a asegurar justo antes de cada intento de login en AuthContext.jsx.
export const ensureAuthPersistence = () => setPersistence(auth, browserLocalPersistence);
ensureAuthPersistence().catch((err) => console.error('Error al fijar la persistencia de Auth:', err));
