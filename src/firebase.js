import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
// Fuerza que Google muestre siempre el selector de cuentas (en vez de reautenticar en
// silencio con la última usada), para poder cambiar de cuenta sin pasar antes por sesión.
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const appId = 'fifa-manager-main';
