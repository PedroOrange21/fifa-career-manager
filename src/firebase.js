import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';

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

// El authDomain (*.firebaseapp.com) es un origen distinto al del hosting real de la app.
// Firebase usa ese origen para el "handshake" de OAuth y para un iframe interno que detecta
// cuándo vuelve el resultado de una redirección. En Safari/iOS, con ITP activo, ese iframe se
// trata como almacenamiento de terceros y puede quedar bloqueado — es la causa más habitual de
// que la redirección de Google "funcione" (Google la completa) pero la app nunca reciba el
// resultado. Aviso solo informativo: solucionarlo del todo requiere configurar un dominio
// propio como authDomain en la consola de Firebase Hosting, algo fuera del alcance del código.
if (typeof window !== 'undefined' && !firebaseConfig.authDomain.includes(window.location.hostname)) {
  console.info(`[Auth] authDomain (${firebaseConfig.authDomain}) es distinto del host de la app (${window.location.hostname}). En Safari/iOS con ITP esto puede bloquear la detección del resultado de signInWithRedirect.`);
}

// Cadena de persistencia con fallback: indexedDBLocalPersistence es la implementación más
// resistente en Safari (la recomendada por Firebase para mitigar los cortes de IndexedDB en
// modo privado/ITP); si falla, se cae a localStorage clásico y, como último recurso, a memoria
// (no sobrevive a la navegación completa de signInWithRedirect, pero evita dejar la sesión sin
// ningún tipo de persistencia). Se registra en consola cuál terminó aplicándose, para poder
// diagnosticar exactamente qué ocurre en el dispositivo real del usuario.
const PERSISTENCE_CHAIN = [
  { name: 'indexedDBLocalPersistence', value: indexedDBLocalPersistence },
  { name: 'browserLocalPersistence', value: browserLocalPersistence },
  { name: 'inMemoryPersistence', value: inMemoryPersistence },
];

export const ensureAuthPersistence = async () => {
  for (const { name, value } of PERSISTENCE_CHAIN) {
    try {
      await setPersistence(auth, value);
      return name;
    } catch (err) {
      console.error(`[Auth] Fallo al fijar persistencia "${name}":`, err?.code || err?.message || err);
    }
  }
  console.error('[Auth] No se pudo fijar ningún tipo de persistencia; la sesión podría no sobrevivir a la redirección.');
  return null;
};
ensureAuthPersistence().then((name) => { if (name) console.info(`[Auth] Persistencia activa: ${name}`); });
