import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  LayoutDashboard,
  Trash2,
  Edit,
  RefreshCcw,
  X,
  Check,
  LogOut,
  LogIn,
  Mail,
  Lock,
  UserPlus,
  ShieldAlert,
  Sparkles,
  User,
  Info,
  Search,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  query,
  onSnapshot,
  deleteDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithCustomToken,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCXNwNdKeE_Yr97iaFV_Ezw5GabBYasdnY',
  authDomain: 'fifa-manger.firebaseapp.com',
  projectId: 'fifa-manger',
  storageBucket: 'fifa-manger.firebasestorage.app',
  messagingSenderId: '945035024406',
  appId: '1:945035024406:web:0e2d4e42c81f910f223d37',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = 'fifa-manager-main';

const FORMATIONS = {
  '4-3-3': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MC', x: 50, y: 52 }, { pos: 'MC', x: 24, y: 46 }, { pos: 'MC', x: 76, y: 46 },
    { pos: 'ED', x: 78, y: 22 }, { pos: 'EI', x: 22, y: 22 }, { pos: 'DC', x: 50, y: 14 },
  ],
  '4-4-2': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MD', x: 82, y: 45 }, { pos: 'MC', x: 60, y: 48 }, { pos: 'MC', x: 40, y: 48 }, { pos: 'MI', x: 18, y: 45 },
    { pos: 'DC', x: 60, y: 18 }, { pos: 'DC', x: 40, y: 18 },
  ],
  '3-5-2': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'DFC', x: 50, y: 72 }, { pos: 'DFC', x: 72, y: 70 }, { pos: 'DFC', x: 28, y: 70 },
    { pos: 'MCD', x: 50, y: 54 }, { pos: 'MC', x: 66, y: 46 }, { pos: 'MC', x: 34, y: 46 }, { pos: 'MD', x: 84, y: 38 }, { pos: 'MI', x: 16, y: 38 },
    { pos: 'DC', x: 60, y: 18 }, { pos: 'DC', x: 40, y: 18 },
  ],
  '4-2-3-1': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MCD', x: 60, y: 56 }, { pos: 'MCD', x: 40, y: 56 },
    { pos: 'MD', x: 82, y: 35 }, { pos: 'MCO', x: 50, y: 35 }, { pos: 'MI', x: 18, y: 35 },
    { pos: 'DC', x: 50, y: 15 }
  ],
  '4-1-2-1-2': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MCD', x: 50, y: 58 },
    { pos: 'MD', x: 75, y: 46 }, { pos: 'MI', x: 25, y: 46 },
    { pos: 'MCO', x: 50, y: 35 },
    { pos: 'DC', x: 60, y: 18 }, { pos: 'DC', x: 40, y: 18 }
  ],
  '4-3-1-2': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MC', x: 70, y: 50 }, { pos: 'MC', x: 50, y: 54 }, { pos: 'MC', x: 30, y: 50 },
    { pos: 'MCO', x: 50, y: 35 },
    { pos: 'DC', x: 60, y: 18 }, { pos: 'DC', x: 40, y: 18 }
  ],
  '5-3-2': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'CAD', x: 85, y: 62 }, { pos: 'DFC', x: 68, y: 72 }, { pos: 'DFC', x: 50, y: 74 }, { pos: 'DFC', x: 32, y: 72 }, { pos: 'CAI', x: 15, y: 62 },
    { pos: 'MC', x: 70, y: 48 }, { pos: 'MC', x: 50, y: 48 }, { pos: 'MC', x: 30, y: 48 },
    { pos: 'DC', x: 60, y: 18 }, { pos: 'DC', x: 40, y: 18 }
  ],
  '5-2-3': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'CAD', x: 85, y: 62 }, { pos: 'DFC', x: 68, y: 72 }, { pos: 'DFC', x: 50, y: 74 }, { pos: 'DFC', x: 32, y: 72 }, { pos: 'CAI', x: 15, y: 62 },
    { pos: 'MC', x: 65, y: 48 }, { pos: 'MC', x: 35, y: 48 },
    { pos: 'ED', x: 78, y: 22 }, { pos: 'EI', x: 22, y: 22 },
    { pos: 'DC', x: 50, y: 15 }
  ],
  '3-4-3': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'DFC', x: 72, y: 72 }, { pos: 'DFC', x: 50, y: 74 }, { pos: 'DFC', x: 28, y: 72 },
    { pos: 'MD', x: 85, y: 48 }, { pos: 'MC', x: 60, y: 50 }, { pos: 'MC', x: 40, y: 50 }, { pos: 'MI', x: 15, y: 48 },
    { pos: 'ED', x: 78, y: 22 }, { pos: 'EI', x: 22, y: 22 },
    { pos: 'DC', x: 50, y: 15 }
  ],
  '4-5-1': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MC', x: 50, y: 52 },
    { pos: 'MD', x: 82, y: 38 }, { pos: 'MCO', x: 65, y: 35 }, { pos: 'MCO', x: 35, y: 35 }, { pos: 'MI', x: 18, y: 38 },
    { pos: 'DC', x: 50, y: 15 }
  ],
  '4-3-2-1': [
    { pos: 'POR', x: 50, y: 88 }, { pos: 'LD', x: 82, y: 68 }, { pos: 'DFC', x: 64, y: 72 }, { pos: 'DFC', x: 36, y: 72 }, { pos: 'LI', x: 18, y: 68 },
    { pos: 'MC', x: 75, y: 50 }, { pos: 'MC', x: 50, y: 52 }, { pos: 'MC', x: 25, y: 50 },
    { pos: 'SD', x: 65, y: 28 }, { pos: 'SD', x: 35, y: 28 },
    { pos: 'DC', x: 50, y: 12 }
  ]
};

const getRatingStyle = (rating) => {
  if (rating >= 75) return 'bg-[#FACC15] text-black'; 
  if (rating >= 65) return 'bg-[#CBD5E1] text-black'; 
  return 'bg-[#CD7F32] text-white'; 
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('squad');
  const [formation, setFormation] = useState('4-3-3');
  const [lineup, setLineup] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating-desc'); 

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    rating: 75,
    pos: 'MC',
    age: 23,
    type: 'Comprado',
    value: '',
    role: 'Titular'
  });

  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [pickingSlot, setPickingSlot] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const playersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'players');
    const unsubPlayers = onSnapshot(playersRef, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Error al leer plantilla:', err));

    const tacticsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tactics');
    const unsubTactics = onSnapshot(tacticsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.formation) setFormation(data.formation);
        if (data.lineup) setLineup(data.lineup);
      }
    });

    return () => {
      unsubPlayers();
      unsubTactics();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { setAuthError('No se pudo iniciar sesión con Google. Revisa la consola.'); }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('Por favor, rellena todos los campos.');
      return;
    }

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName) {
          setAuthError('Escribe un nombre de Míster para tu perfil.');
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        setUser({ ...userCredential.user, displayName });
      }
    } catch (err) {
      if (err.code === 'auth/weak-password') setAuthError('La contraseña debe tener al menos 6 caracteres.');
      else if (err.code === 'auth/email-already-in-use') setAuthError('Este correo electrónico ya está registrado.');
      else if (err.code === 'auth/invalid-credential') setAuthError('Correo o contraseña incorrectos.');
      else setAuthError('Error: ' + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!user || !newPlayer.name) return;

    try {
      if (editingId) {
        const playerRef = doc(db, 'artifacts', appId, 'users', user.uid, 'players', editingId);
        await updateDoc(playerRef, {
          name: newPlayer.name,
          rating: parseInt(newPlayer.rating) || 75,
          pos: newPlayer.pos,
          age: parseInt(newPlayer.age) || 23,
          type: newPlayer.type,
          value: newPlayer.value ? parseInt(String(newPlayer.value).replace(/\./g, '')) : 0,
          role: newPlayer.role || 'Titular'
        });
      } else {
        const playerRef = doc(db, 'artifacts', appId, 'users', user.uid, 'players', crypto.randomUUID());
        await setDoc(playerRef, {
          name: newPlayer.name,
          rating: parseInt(newPlayer.rating) || 75,
          pos: newPlayer.pos,
          age: parseInt(newPlayer.age) || 23,
          type: newPlayer.type,
          value: newPlayer.value ? parseInt(String(newPlayer.value).replace(/\./g, '')) : 0,
          role: newPlayer.role || 'Titular'
        });
      }
      setShowForm(false);
      setEditingId(null);
      setNewPlayer({ name: '', rating: 75, pos: 'MC', age: 23, type: 'Comprado', value: '', role: 'Titular' });
    } catch (err) {
      setAuthError('Error al guardar jugador.');
    }
  };

  const handleEditClick = (p) => {
    setNewPlayer({
      name: p.name,
      rating: p.rating,
      pos: p.pos,
      age: p.age,
      type: p.type || 'Comprado',
      value: p.value ? Number(p.value).toLocaleString('es-ES') : '',
      role: p.role || 'Titular'
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const deletePlayer = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'players', id));
      const newLineup = { ...lineup };
      let changed = false;
      Object.keys(newLineup).forEach((slot) => {
        if (newLineup[slot] === id) {
          delete newLineup[slot];
          changed = true;
        }
      });
      if (changed) {
        setLineup(newLineup);
        saveTactics(formation, newLineup);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveTactics = async (newForm, newLineup) => {
    if (!user) return;
    try {
      const tacticsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tactics');
      await setDoc(tacticsRef, { formation: newForm, lineup: newLineup });
    } catch (err) {
      console.error('Error al guardar táctica:', err);
    }
  };

  const assignPlayerToSlot = (slotIndex, playerId) => {
    const newLineup = { ...lineup };
    if (playerId === null) {
      delete newLineup[slotIndex];
    } else {
      Object.keys(newLineup).forEach((key) => {
        if (newLineup[key] === playerId) delete newLineup[key];
      });
      newLineup[slotIndex] = playerId;
    }
    setLineup(newLineup);
    saveTactics(formation, newLineup);
    setPickingSlot(null);
  };

  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  let sortedPlayers = [...filteredPlayers];
  switch (sortBy) {
    case 'rating-desc': sortedPlayers.sort((a, b) => b.rating - a.rating); break;
    case 'rating-asc': sortedPlayers.sort((a, b) => a.rating - b.rating); break;
    case 'value-desc': sortedPlayers.sort((a, b) => (b.value || 0) - (a.value || 0)); break;
    case 'value-asc': sortedPlayers.sort((a, b) => (a.value || 0) - (b.value || 0)); break;
    case 'age-desc': sortedPlayers.sort((a, b) => b.age - a.age); break;
    case 'age-asc': sortedPlayers.sort((a, b) => a.age - b.age); break;
    case 'name-asc': sortedPlayers.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'pos': sortedPlayers.sort((a, b) => (a.pos || '').localeCompare(b.pos || '')); break;
    case 'type': sortedPlayers.sort((a, b) => (a.type || '').localeCompare(b.type || '')); break;
    default: sortedPlayers.sort((a, b) => b.rating - a.rating);
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0b] flex flex-col items-center justify-center">
        <RefreshCcw className="animate-spin text-green-500 mb-4" size={40} />
        <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Cargando base de datos...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <span className="text-green-500 font-black text-5xl italic tracking-tighter">soccerclothes.</span>
          <h1 className="text-white/30 font-bold tracking-[0.3em] text-xs uppercase mt-2">Plataforma de Control</h1>
        </div>

        <div className="bg-[#111114] border border-white/10 p-6 md:p-8 rounded-[40px] shadow-2xl w-full max-w-md">
          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-6 flex gap-3 text-red-400 text-xs font-bold items-start animate-pulse">
              <ShieldAlert className="flex-shrink-0" size={18} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="text-[10px] font-black text-white/40 uppercase tracking-wider ml-1 mb-1 block">Tu Nombre de Míster</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input type="text" placeholder="Ej: Míster Guardiola" className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-green-500 text-sm font-bold text-white" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-wider ml-1 mb-1 block">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input type="email" placeholder="ejemplo@correo.com" className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-green-500 text-sm font-bold text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-white/40 uppercase tracking-wider ml-1 mb-1 block">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input type="password" placeholder="Mínimo 6 caracteres" className="w-full bg-white/5 p-4 pl-12 rounded-2xl border border-white/10 outline-none focus:border-green-500 text-sm font-bold text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="w-full bg-green-500 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-green-500/20 active:scale-95 transition-all mt-6">
              {authMode === 'login' ? 'INICIAR SESIÓN' : 'REGISTRARME GRATIS'}
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="px-3 text-[10px] font-black text-white/20 uppercase tracking-widest">O</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <button onClick={handleGoogleLogin} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-wider mb-6">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Entrar con Google
          </button>

          <div className="text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-xs text-green-500 hover:underline font-bold">
              {authMode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#111114]/90 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-green-500 font-black italic tracking-tighter text-xl">soccerclothes.</h1>
          <div className="hidden sm:block h-4 w-px bg-white/10"></div>
          <span className="hidden sm:block text-[10px] text-white/40 font-black uppercase tracking-widest">
            Míster: {user.displayName || user.email.split('@')[0]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl">
            <button onClick={() => setActiveTab('squad')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'squad' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'text-white/40'}`}>Plantilla</button>
            <button onClick={() => setActiveTab('tactics')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'tactics' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'text-white/40'}`}>Táctica</button>
          </div>
          <button onClick={handleLogout} className="p-2.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-xl transition-all" title="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto pb-24">
        {}
        {activeTab === 'squad' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input type="text" placeholder="Buscar jugador..." className="w-full bg-[#111114] p-4 pl-12 rounded-2xl border border-white/5 outline-none focus:border-green-500 text-xs font-bold text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <button onClick={() => { setEditingId(null); setNewPlayer({ name: '', rating: 75, pos: 'MC', age: 23, type: 'Comprado', value: '', role: 'Titular' }); setShowForm(true); }} className="w-full bg-green-500 text-black p-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Plus size={16} /> Fichar Nuevo Jugador
            </button>

            {}
            {showForm && (
              <form onSubmit={addPlayer} className="bg-[#18181b] p-5 rounded-[32px] border border-green-500/30 space-y-4 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black italic text-green-500 text-sm uppercase">{editingId ? 'Editar Jugador' : 'Nuevo Jugador'}</h3>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setNewPlayer({ name: '', rating: 75, pos: 'MC', age: 23, type: 'Comprado', value: '', role: 'Titular' }); }} className="p-1 text-white/20"><X size={18} /></button>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Nombre</label>
                  <input type="text" placeholder="Ej: Erling Haaland" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 focus:border-green-500 font-bold placeholder:text-white/10" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Media</label>
                    <input type="number" placeholder="90" min="1" max="99" className="w-full h-[56px] bg-white/5 rounded-xl outline-none border border-white/5 text-center font-black text-xl text-white placeholder:text-white/10 focus:border-green-500 transition-colors" value={newPlayer.rating} onChange={(e) => setNewPlayer({ ...newPlayer, rating: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Posición</label>
                    <div className="relative">
                      <select className="w-full h-[56px] bg-white/5 rounded-xl outline-none border border-white/5 text-center font-black text-xl text-white appearance-none cursor-pointer hover:bg-white/10 focus:border-green-500 transition-colors" value={newPlayer.pos} onChange={(e) => setNewPlayer({ ...newPlayer, pos: e.target.value })}>
                        <option value="POR" className="bg-[#18181b] text-white text-base font-bold">POR</option>
                        <option value="DFC" className="bg-[#18181b] text-white text-base font-bold">DFC</option>
                        <option value="LD" className="bg-[#18181b] text-white text-base font-bold">LD</option>
                        <option value="LI" className="bg-[#18181b] text-white text-base font-bold">LI</option>
                        <option value="MCD" className="bg-[#18181b] text-white text-base font-bold">MCD</option>
                        <option value="MC" className="bg-[#18181b] text-white text-base font-bold">MC</option>
                        <option value="MCO" className="bg-[#18181b] text-white text-base font-bold">MCO</option>
                        <option value="MD" className="bg-[#18181b] text-white text-base font-bold">MD</option>
                        <option value="MI" className="bg-[#18181b] text-white text-base font-bold">MI</option>
                        <option value="ED" className="bg-[#18181b] text-white text-base font-bold">ED</option>
                        <option value="EI" className="bg-[#18181b] text-white text-base font-bold">EI</option>
                        <option value="DC" className="bg-[#18181b] text-white text-base font-bold">DC</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Edad</label>
                    <input type="number" placeholder="23" min="15" max="50" className="w-full h-[56px] bg-white/5 rounded-xl outline-none border border-white/5 text-center font-black text-xl text-white placeholder:text-white/10 focus:border-green-500 transition-colors" value={newPlayer.age} onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Tipo de Adquisición</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Cantera'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${newPlayer.type === 'Cantera' ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Cantera</button>
                    <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Cedido'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${newPlayer.type === 'Cedido' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Cedido</button>
                    <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Comprado'})} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${newPlayer.type === 'Comprado' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Comprado</button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Valor del Jugador (€)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 50.000.000" 
                    className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 focus:border-green-500 font-bold placeholder:text-white/10" 
                    value={newPlayer.value} 
                    onChange={(e) => { 
                      const val = e.target.value.replace(/\D/g, ''); 
                      setNewPlayer({ ...newPlayer, value: val ? Number(val).toLocaleString('es-ES') : '' }); 
                    }} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Rol en el Equipo</label>
                  <div className="relative">
                    <select className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 text-xs font-black text-white appearance-none cursor-pointer hover:bg-white/10 focus:border-green-500 transition-colors uppercase" value={newPlayer.role || 'Titular'} onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}>
                      <option value="Estrella" className="bg-[#18181b]">Estrella</option>
                      <option value="Titular Indiscutible" className="bg-[#18181b]">Titular Indiscutible</option>
                      <option value="Titular" className="bg-[#18181b]">Titular</option>
                      <option value="Rotación" className="bg-[#18181b]">Rotación</option>
                      <option value="Promesa" className="bg-[#18181b]">Promesa</option>
                      <option value="Para Ceder" className="bg-[#18181b]">Para Ceder</option>
                      <option value="Transferible" className="bg-[#18181b]">Transferible</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
                  </div>
                </div>

                <button type="submit" className="w-full bg-green-500 text-black shadow-lg shadow-green-500/20 p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-4 active:scale-[0.98] transition-all">
                  {editingId ? 'Guardar Cambios' : 'Añadir a la Plantilla'}
                </button>
              </form>
            )}

            {}
            <div className="bg-[#111114] rounded-[32px] border border-white/10 overflow-hidden divide-y divide-white/5 shadow-2xl">
              {sortedPlayers.length === 0 && (
                <div className="p-16 text-center text-white/10 font-black italic uppercase tracking-widest text-xs">
                  {searchQuery ? 'No se encontraron jugadores' : 'Plantilla Vacía'}
                </div>
              )}
              {sortedPlayers.map((p) => (
                <div key={p.id} className="p-5 flex items-center justify-between group hover:bg-white/[0.01] transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black leading-none shadow-lg ${getRatingStyle(p.rating)}`}>
                      <span className="text-[8px] opacity-70 font-bold mb-0.5">{p.pos || 'MC'}</span>
                      <span className="text-xl">{p.rating}</span>
                    </div>
                    <div>
                      <div className="font-black uppercase italic text-lg truncate tracking-tighter leading-tight flex items-center gap-2">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{p.age} Años</span>
                        {p.value > 0 && (
                          <span className="text-[9px] text-green-400/80 font-black uppercase tracking-widest">
                            {Number(p.value).toLocaleString('es-ES')} €
                          </span>
                        )}
                        <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                          p.type === 'Cantera' ? 'bg-green-600/20 text-green-400' : 
                          p.type === 'Cedido' ? 'bg-yellow-500/20 text-yellow-400' : 
                          'bg-blue-600/20 text-blue-400'
                        }`}>
                          {p.type || 'Comprado'}
                        </span>
                        <span className="text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-white/10 text-white/60">
                          {p.role || 'Titular'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditClick(p)} className="p-2 text-white/10 hover:text-blue-500 transition-colors">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => deletePlayer(p.id)} className="p-2 text-white/10 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        {activeTab === 'tactics' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center bg-[#111114] p-4 rounded-[24px] border border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Esquema Táctico</span>
              <select value={formation} onChange={(e) => { setFormation(e.target.value); saveTactics(e.target.value, lineup); }} className="bg-transparent text-green-500 font-black uppercase outline-none cursor-pointer text-xs">
                {Object.keys(FORMATIONS).map((f) => <option key={f} value={f} className="bg-[#111114]">{f}</option>)}
              </select>
            </div>

            <div className="bg-green-950/20 border-4 border-green-500/20 rounded-[48px] p-6 relative min-h-[580px] overflow-hidden shadow-inner bg-[radial-gradient(#15803d_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="absolute inset-4 border border-white/5 rounded-[36px] pointer-events-none"></div>
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-white/5 rounded-full pointer-events-none"></div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 h-20 border-b border-x border-white/5 pointer-events-none"></div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-20 border-t border-x border-white/5 pointer-events-none"></div>

              {FORMATIONS[formation].map((slot, idx) => {
                const player = players.find((p) => p.id === lineup[idx]);
                return (
                  <div key={idx} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-10">
                    <button onClick={() => setPickingSlot(idx)} className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-black transition-all duration-300 shadow-2xl active:scale-90 ${player ? 'bg-[#18181b] border-green-500 text-green-400 scale-105' : 'bg-black/80 border-white/10 border-dashed text-white/20 hover:border-white/40'}`}>
                      {player ? (
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[8px] text-white/30 font-bold mb-0.5 uppercase">{player.pos}</span>
                          <span className="text-base">{player.rating}</span>
                        </div>
                      ) : <span className="text-[9px] uppercase tracking-tighter">{slot.pos}</span>}
                    </button>
                    {player && (
                      <span className="text-[8px] font-black bg-black/85 text-white/90 px-2 py-0.5 rounded-md border border-white/10 shadow-lg whitespace-nowrap uppercase italic max-w-[65px] truncate">
                        {player.name.split(' ').pop()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {}
      {pickingSlot !== null && (
        <div className="fixed inset-0 bg-black/95 z-[100] p-6 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Colocar Jugador</h2>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Alineación: {FORMATIONS[formation][pickingSlot]?.pos}</p>
            </div>
            <button onClick={() => setPickingSlot(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/50 hover:text-white"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pb-8 no-scrollbar">
            <button onClick={() => assignPlayerToSlot(pickingSlot, null)} className="w-full p-5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black uppercase text-[10px] tracking-wider border border-red-500/20">
              Quitar de la posición
            </button>

            {players.sort((a, b) => b.rating - a.rating).map((p) => (
              <button key={p.id} onClick={() => assignPlayerToSlot(pickingSlot, p.id)} className={`w-full p-4 rounded-2xl bg-white/5 flex items-center gap-4 hover:bg-white/10 transition-all border border-transparent ${lineup[pickingSlot] === p.id ? 'border-green-500 bg-green-500/10' : ''}`}>
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none shadow-md ${getRatingStyle(p.rating)}`}>
                  <span className="text-[8px] opacity-70 mb-0.5">{p.pos}</span>
                  <span className="text-lg">{p.rating}</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-black uppercase italic text-base truncate text-white">{p.name}</div>
                  <div className="text-[9px] text-white/20 font-black uppercase">{p.age} Años</div>
                </div>
                {lineup[pickingSlot] === p.id && <Check className="text-green-500" size={20} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}