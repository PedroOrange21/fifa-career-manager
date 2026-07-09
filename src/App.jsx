import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  LayoutDashboard,
  Trash2,
  RefreshCcw,
  X,
  Check,
  LogOut,
  Mail,
  Lock,
  User,
  Search,
  ShieldCheck,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';

// --- CONFIGURACIÓN DE FIREBASE ---
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

// Formaciones Tácticas Completas
const FORMATIONS = {
  '4-3-3': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:50,y:52},{pos:'MC',x:24,y:46},{pos:'MC',x:76,y:46},{pos:'ED',x:78,y:22},{pos:'EI',x:22,y:22},{pos:'DC',x:50,y:14}],
  '4-3-3 (MCO)': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:34,y:54},{pos:'MC',x:66,y:54},{pos:'MCO',x:50,y:38},{pos:'ED',x:78,y:22},{pos:'EI',x:22,y:22},{pos:'DC',x:50,y:14}],
  '4-3-3 (MCD)': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MCD',x:50,y:58},{pos:'MC',x:30,y:46},{pos:'MC',x:70,y:46},{pos:'ED',x:78,y:22},{pos:'EI',x:22,y:22},{pos:'DC',x:50,y:14}],
  '4-4-2': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MD',x:82,y:45},{pos:'MC',x:60,y:48},{pos:'MC',x:40,y:48},{pos:'MI',x:18,y:45},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '4-2-3-1': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MCD',x:62,y:55},{pos:'MCD',x:38,y:55},{pos:'MD',x:78,y:38},{pos:'MCO',x:50,y:38},{pos:'MI',x:22,y:38},{pos:'DC',x:50,y:14}],
  '4-1-2-1-2': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MCD',x:50,y:58},{pos:'MD',x:78,y:45},{pos:'MI',x:22,y:45},{pos:'MCO',x:50,y:34},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '4-3-1-2': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:50,y:54},{pos:'MC',x:24,y:50},{pos:'MC',x:76,y:50},{pos:'MCO',x:50,y:35},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '4-5-1': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:50,y:54},{pos:'MD',x:80,y:42},{pos:'MI',x:20,y:42},{pos:'MCO',x:64,y:34},{pos:'MCO',x:36,y:34},{pos:'DC',x:50,y:14}],
  '4-3-2-1': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:50,y:54},{pos:'MC',x:26,y:48},{pos:'MC',x:74,y:48},{pos:'SD',x:64,y:30},{pos:'SD',x:36,y:30},{pos:'DC',x:50,y:14}],
  '4-4-1-1': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MD',x:82,y:45},{pos:'MC',x:60,y:48},{pos:'MC',x:40,y:48},{pos:'MI',x:18,y:45},{pos:'SD',x:50,y:30},{pos:'DC',x:50,y:14}],
  '4-1-4-1': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MCD',x:50,y:58},{pos:'MD',x:82,y:40},{pos:'MC',x:60,y:42},{pos:'MC',x:40,y:42},{pos:'MI',x:18,y:40},{pos:'DC',x:50,y:14}],
  '4-2-2-2': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MCD',x:62,y:55},{pos:'MCD',x:38,y:55},{pos:'MCO',x:78,y:38},{pos:'MCO',x:22,y:38},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '4-2-4': [{pos:'POR',x:50,y:88},{pos:'LD',x:82,y:68},{pos:'DFC',x:64,y:72},{pos:'DFC',x:36,y:72},{pos:'LI',x:18,y:68},{pos:'MC',x:60,y:48},{pos:'MC',x:40,y:48},{pos:'ED',x:80,y:22},{pos:'EI',x:20,y:22},{pos:'DC',x:60,y:16},{pos:'DC',x:40,y:16}],
  '5-3-2': [{pos:'POR',x:50,y:88},{pos:'CAD',x:84,y:64},{pos:'DFC',x:66,y:72},{pos:'DFC',x:50,y:74},{pos:'DFC',x:34,y:72},{pos:'CAI',x:16,y:64},{pos:'MC',x:50,y:48},{pos:'MC',x:70,y:46},{pos:'MC',x:30,y:46},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '5-2-3': [{pos:'POR',x:50,y:88},{pos:'CAD',x:84,y:64},{pos:'DFC',x:66,y:72},{pos:'DFC',x:50,y:74},{pos:'DFC',x:34,y:72},{pos:'CAI',x:16,y:64},{pos:'MC',x:62,y:46},{pos:'MC',x:38,y:46},{pos:'ED',x:76,y:22},{pos:'EI',x:24,y:22},{pos:'DC',x:50,y:14}],
  '5-4-1': [{pos:'POR',x:50,y:88},{pos:'CAD',x:84,y:64},{pos:'DFC',x:66,y:72},{pos:'DFC',x:50,y:74},{pos:'DFC',x:34,y:72},{pos:'CAI',x:16,y:64},{pos:'MD',x:78,y:44},{pos:'MC',x:60,y:48},{pos:'MC',x:40,y:48},{pos:'MI',x:22,y:44},{pos:'DC',x:50,y:16}],
  '3-5-2': [{pos:'POR',x:50,y:88},{pos:'DFC',x:50,y:72},{pos:'DFC',x:72,y:70},{pos:'DFC',x:28,y:70},{pos:'MCD',x:50,y:54},{pos:'MC',x:66,y:46},{pos:'MC',x:34,y:46},{pos:'MD',x:84,y:38},{pos:'MI',x:16,y:38},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
  '3-4-3': [{pos:'POR',x:50,y:88},{pos:'DFC',x:50,y:72},{pos:'DFC',x:72,y:70},{pos:'DFC',x:28,y:70},{pos:'MC',x:60,y:48},{pos:'MC',x:40,y:48},{pos:'MD',x:84,y:42},{pos:'MI',x:16,y:42},{pos:'ED',x:76,y:22},{pos:'EI',x:24,y:22},{pos:'DC',x:50,y:14}],
  '3-4-1-2': [{pos:'POR',x:50,y:88},{pos:'DFC',x:50,y:72},{pos:'DFC',x:72,y:70},{pos:'DFC',x:28,y:70},{pos:'MC',x:60,y:50},{pos:'MC',x:40,y:50},{pos:'MD',x:84,y:44},{pos:'MI',x:16,y:44},{pos:'MCO',x:50,y:34},{pos:'DC',x:60,y:16},{pos:'DC',x:40,y:16}],
  '3-4-2-1': [{pos:'POR',x:50,y:88},{pos:'DFC',x:50,y:72},{pos:'DFC',x:72,y:70},{pos:'DFC',x:28,y:70},{pos:'MC',x:60,y:50},{pos:'MC',x:40,y:50},{pos:'MD',x:84,y:44},{pos:'MI',x:16,y:44},{pos:'SD',x:66,y:30},{pos:'SD',x:34,y:30},{pos:'DC',x:50,y:14}],
  '3-1-4-2': [{pos:'POR',x:50,y:88},{pos:'DFC',x:50,y:72},{pos:'DFC',x:72,y:70},{pos:'DFC',x:28,y:70},{pos:'MCD',x:50,y:58},{pos:'MC',x:64,y:44},{pos:'MC',x:36,y:44},{pos:'MD',x:84,y:38},{pos:'MI',x:16,y:38},{pos:'DC',x:60,y:18},{pos:'DC',x:40,y:18}],
};

const ALL_POSITIONS = ['POR', 'DFC', 'LD', 'LI', 'CAD', 'CAI', 'MCD', 'MC', 'MD', 'MI', 'MCO', 'ED', 'EI', 'SD', 'DC'];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('squad');
  const [formation, setFormation] = useState('4-3-3');
  const [lineup, setLineup] = useState({});
  const [bench, setBench] = useState({});
  const [savedFormations, setSavedFormations] = useState([]);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [formationToDelete, setFormationToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFormationName, setNewFormationName] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('rating-desc');
  
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null);
  const [infoSlot, setInfoSlot] = useState(null);
  
  // Drag and Drop State (Desktop & Mobile)
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedSourceSlot, setDraggedSourceSlot] = useState(null);
  const [floatingDrag, setFloatingDrag] = useState(null); // Para visualizar el arrastre en móviles

  const [newPlayer, setNewPlayer] = useState({
    name: '',
    rating: '',
    positions: ['MC'],
    age: '',
    preferredFoot: 'Diestro',
    marketValue: '',
    type: 'Comprado',
    value: '',
    loanDuration: '1 Temporada',
    originClub: ''
  });

  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [pickingSlot, setPickingSlot] = useState(null);

  // Helper function definitions
  const isUncalledZone = (slot) => ['uncalled', 'forLoan', 'forSale'].includes(String(slot));

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
        if (data.bench) setBench(data.bench); else setBench({});
        if (data.savedFormations) setSavedFormations(data.savedFormations);
      }
    });

    return () => {
      unsubPlayers();
      unsubTactics();
    };
  }, [user]);

  // Manejador global para el drag en móviles
  useEffect(() => {
    if (!floatingDrag) return;
    const handleGlobalTouchMove = (e) => {
      e.preventDefault(); 
      const touch = e.touches[0];
      setFloatingDrag(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
    };
    const handleGlobalTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      const slotElement = dropTarget?.closest('[data-slot]');
      
      if (slotElement) {
        let targetSlot = slotElement.getAttribute('data-slot');
        if (targetSlot !== 'uncalled' && targetSlot !== 'forLoan' && targetSlot !== 'forSale' && !targetSlot.startsWith('bench-')) {
          targetSlot = parseInt(targetSlot, 10);
        }
        executeMove(floatingDrag.player.id, floatingDrag.sourceSlot, targetSlot);
      }
      
      setDraggedPlayer(null);
      setDraggedSourceSlot(null);
      setFloatingDrag(null);
    };

    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [floatingDrag]);

  // --- Funciones de Lógica y UI ---

  const getCardStyle = (rating, isTactics = false) => {
    if (rating <= 64) return isTactics ? 'border-[#CD7F32] text-[#CD7F32]' : 'bg-[#CD7F32] text-black'; // Bronce
    if (rating >= 65 && rating <= 74) return isTactics ? 'border-[#C0C0C0] text-[#C0C0C0]' : 'bg-[#C0C0C0] text-black'; // Plata
    return isTactics ? 'border-[#FFD700] text-[#FFD700]' : 'bg-[#FFD700] text-black'; // Oro
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { setAuthError('No se pudo iniciar sesión con Google.'); }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) return setAuthError('Rellena todos los campos.');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!displayName) return setAuthError('Escribe un nombre de Míster.');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        setUser({ ...cred.user, displayName });
      }
    } catch (err) {
      setAuthError('Error de autenticación. Verifica los datos.');
    }
  };

  const handleLogout = () => signOut(auth);

  const formatValueInput = (val) => {
    if (!val) return '';
    const num = val.replace(/\./g, '').replace(/\D/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('es-ES');
  };

  const parseValue = (val) => {
    if (!val) return 0;
    return Number(String(val).replace(/\./g, ''));
  };

  const abbreviateValue = (val) => {
    if (!val) return '0 €';
    const num = parseValue(String(val));
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill €';
    if (num >= 1000) return (num / 1000).toFixed(0) + ' Mil €';
    return val + ' €';
  };

  const togglePosition = (pos) => {
    let current = [...newPlayer.positions];
    if (pos === 'POR') {
      current = ['POR'];
    } else {
      current = current.filter(p => p !== 'POR');
      if (current.includes(pos)) {
        current = current.filter(p => p !== pos);
      } else {
        current.push(pos);
      }
      if (current.length === 0) current = ['MC'];
    }
    setNewPlayer({ ...newPlayer, positions: current });
  };

  const addOrUpdatePlayer = async (e) => {
    e.preventDefault();
    if (!user || !newPlayer.name || newPlayer.positions.length === 0) return;

    try {
      const id = editingId || crypto.randomUUID();
      const playerRef = doc(db, 'artifacts', appId, 'users', user.uid, 'players', id);
      await setDoc(playerRef, {
        name: newPlayer.name,
        rating: parseInt(newPlayer.rating) || 0,
        positions: newPlayer.positions,
        age: parseInt(newPlayer.age) || 0,
        preferredFoot: newPlayer.preferredFoot || 'Diestro',
        marketValue: parseValue(newPlayer.marketValue),
        type: newPlayer.type,
        value: newPlayer.type === 'Comprado' ? parseValue(newPlayer.value) : 0,
        loanDuration: newPlayer.type === 'Cedido' ? newPlayer.loanDuration : null,
        originClub: newPlayer.type === 'Cedido' ? newPlayer.originClub : null
      }, { merge: true });
      setShowForm(false);
      setEditingId(null);
      setNewPlayer({ name: '', rating: '', positions: ['MC'], age: '', preferredFoot: 'Diestro', marketValue: '', type: 'Comprado', value: '', loanDuration: '1 Temporada', originClub: '' });
    } catch (err) {
      setAuthError('Error al guardar jugador.');
    }
  };

  const editPlayer = (p) => {
    setEditingId(p.id);
    setNewPlayer({
      name: p.name,
      rating: p.rating || '',
      positions: p.positions || [p.pos] || ['MC'],
      age: p.age || '',
      preferredFoot: p.preferredFoot || 'Diestro',
      marketValue: formatValueInput(String(p.marketValue || p.value || '')),
      type: p.type || 'Comprado',
      value: formatValueInput(String(p.value || '')),
      loanDuration: p.loanDuration || '1 Temporada',
      originClub: p.originClub || ''
    });
    setShowForm(true);
  };

  const saveTactics = async (newForm, newLineup, newBench) => {
    if (!user) return;
    try {
      const tacticsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tactics');
      try {
        await updateDoc(tacticsRef, { 
          formation: newForm, 
          lineup: newLineup, 
          bench: newBench || bench 
        });
      } catch (error) {
        await setDoc(tacticsRef, { 
          formation: newForm, 
          lineup: newLineup, 
          bench: newBench || bench,
          savedFormations: savedFormations 
        });
      }
    } catch (err) {
      console.error('Error al guardar táctica:', err);
    }
  };

  const clearTactics = () => {
    setLineup({});
    setBench({});
    saveTactics(formation, {}, {});
  };

  const confirmDeletePlayer = async () => {
    if (!user || !playerToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'players', playerToDelete));
      const newLineup = { ...lineup };
      const newBench = { ...bench };
      let changed = false;
      Object.keys(newLineup).forEach((slot) => {
        if (newLineup[slot] === playerToDelete) {
          delete newLineup[slot];
          changed = true;
        }
      });
      Object.keys(newBench).forEach((slot) => {
        if (newBench[slot] === playerToDelete) {
          delete newBench[slot];
          changed = true;
        }
      });
      if (changed) {
        setLineup(newLineup);
        setBench(newBench);
        saveTactics(formation, newLineup, newBench);
      }
    } catch (err) {
      console.error(err);
    }
    setPlayerToDelete(null);
  };

  // --- Sistema Unificado de Movimientos (Drag & Drop para PC y Móvil) ---
  const executeMove = (playerId, source, target) => {
    if (!playerId || String(source) === String(target)) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Validar si puede jugar en la posición del 11 inicial
    if (!isUncalledZone(target) && !String(target).startsWith('bench-')) {
      const slotData = FORMATIONS[formation][target];
      if (slotData && !player.positions.includes(slotData.pos)) return;
    }

    const newLineup = { ...lineup };
    const newBench = { ...bench };

    // 1. Identificar si hay alguien en el destino
    let displacedPlayerId = null;
    if (!isUncalledZone(target)) {
      if (String(target).startsWith('bench-')) {
        displacedPlayerId = newBench[String(target).split('-')[1]];
      } else {
        displacedPlayerId = newLineup[target];
      }
    }

    // --- LIMPIEZA ABSOLUTA ANTIDUPLICADOS ---
    Object.keys(newLineup).forEach(k => { if (newLineup[k] === playerId) delete newLineup[k]; });
    Object.keys(newBench).forEach(k => { if (newBench[k] === playerId) delete newBench[k]; });

    // 2. Colocar el jugador arrastrado en el destino
    if (!isUncalledZone(target)) {
      if (String(target).startsWith('bench-')) {
        newBench[String(target).split('-')[1]] = playerId;
      } else {
        newLineup[target] = playerId;
      }
    } else {
      let newStatus = 'Activo';
      if (target === 'forLoan') newStatus = 'Cedible';
      if (target === 'forSale') newStatus = 'Transferible';
      
      const playerRef = doc(db, 'artifacts', appId, 'users', user.uid, 'players', playerId);
      updateDoc(playerRef, { transferStatus: newStatus });
    }

    // 3. Mover el jugador desplazado al hueco original o mandarlo a no convocados
    if (displacedPlayerId && !isUncalledZone(source)) {
      Object.keys(newLineup).forEach(k => { if (newLineup[k] === displacedPlayerId) delete newLineup[k]; });
      Object.keys(newBench).forEach(k => { if (newBench[k] === displacedPlayerId) delete newBench[k]; });

      let canSwap = true;
      if (!String(source).startsWith('bench-')) {
        const displacedPlayer = players.find(p => p.id === displacedPlayerId);
        const sourceSlotData = FORMATIONS[formation][source];
        if (displacedPlayer && sourceSlotData && !displacedPlayer.positions.includes(sourceSlotData.pos)) {
          canSwap = false;
        }
      }
      if (canSwap) {
        if (String(source).startsWith('bench-')) {
          newBench[String(source).split('-')[1]] = displacedPlayerId;
        } else {
          newLineup[source] = displacedPlayerId;
        }
      }
    }

    setLineup(newLineup);
    setBench(newBench);
    saveTactics(formation, newLineup, newBench);
  };

  const handleDragStart = (e, playerId, slotIndex) => {
    setDraggedPlayer(playerId);
    setDraggedSourceSlot(slotIndex);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, targetSlotIndex) => {
    e.preventDefault();
    executeMove(draggedPlayer, draggedSourceSlot, targetSlotIndex);
    setDraggedPlayer(null);
    setDraggedSourceSlot(null);
  };

  const handleTouchStartLocal = (e, playerId, slotIndex) => {
    const touch = e.touches[0];
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    setDraggedPlayer(playerId);
    setDraggedSourceSlot(slotIndex);
    setFloatingDrag({
      player,
      sourceSlot: slotIndex,
      x: touch.clientX,
      y: touch.clientY
    });
  };

  const assignPlayerToSlot = (slotIndex, playerId) => {
    if (!playerId) {
      const playerToClear = String(slotIndex).startsWith('bench-') 
        ? bench[String(slotIndex).split('-')[1]] 
        : lineup[slotIndex];
      if (playerToClear) {
        executeMove(playerToClear, slotIndex, 'uncalled');
      }
    } else {
      let realSource = 'uncalled';
      Object.keys(lineup).forEach(k => { if (lineup[k] === playerId) realSource = k; });
      Object.keys(bench).forEach(k => { if (bench[k] === playerId) realSource = `bench-${k}`; });
      
      executeMove(playerId, realSource, slotIndex);
    }
    setPickingSlot(null);
  };

  const saveCurrentFormation = async () => {
    if (!user || !newFormationName.trim()) return;
    const newSaved = [...savedFormations, { name: newFormationName, formation, lineup, bench }];
    setSavedFormations(newSaved);
    setNewFormationName('');
    try {
      const tacticsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tactics');
      try {
        await updateDoc(tacticsRef, { savedFormations: newSaved });
      } catch (error) {
        await setDoc(tacticsRef, { formation, lineup, bench, savedFormations: newSaved });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDeleteFormation = async () => {
    if (!user || !formationToDelete) return;
    const newSaved = savedFormations.filter((f) => f.name !== formationToDelete);
    setSavedFormations(newSaved);
    try {
      const tacticsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'tactics');
      try {
        await updateDoc(tacticsRef, { savedFormations: newSaved });
      } catch (error) {
        await setDoc(tacticsRef, { formation, lineup, bench, savedFormations: newSaved });
      }
    } catch (err) {
      console.error(err);
    }
    setFormationToDelete(null);
  };

  const loadSavedFormation = (f) => {
    setFormation(f.formation);
    setLineup(f.lineup);
    setBench(f.bench || {});
    saveTactics(f.formation, f.lineup, f.bench || {});
  };

  let filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  if (filterType === 'rating-desc') filteredPlayers.sort((a, b) => b.rating - a.rating);
  if (filterType === 'rating-asc') filteredPlayers.sort((a, b) => a.rating - b.rating);
  if (filterType === 'value-desc') filteredPlayers.sort((a, b) => (b.marketValue || b.value || 0) - (a.marketValue || a.value || 0));
  if (filterType === 'value-asc') filteredPlayers.sort((a, b) => (a.marketValue || a.value || 0) - (b.marketValue || b.value || 0));
  if (filterType === 'age-desc') filteredPlayers.sort((a, b) => b.age - a.age);
  if (filterType === 'age-asc') filteredPlayers.sort((a, b) => a.age - b.age);
  if (filterType === 'name-asc') filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));

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
            <button onClick={() => setActiveTab('squad')} className={`px-4 py-2 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'squad' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'text-white/40'}`}>
              <Users size={16} /> <span className="hidden sm:inline">Plantilla</span>
            </button>
            <button onClick={() => setActiveTab('tactics')} className={`px-4 py-2 flex items-center gap-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'tactics' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : 'text-white/40'}`}>
              <LayoutDashboard size={16} /> <span className="hidden sm:inline">Táctica</span>
            </button>
          </div>
          <button onClick={handleLogout} className="p-2.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-xl transition-all" title="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="p-2 md:p-4 max-w-lg mx-auto pb-24">
        {activeTab === 'squad' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input type="text" placeholder="Buscar jugador..." className="w-full bg-[#111114] p-4 pl-12 rounded-2xl border border-white/5 outline-none focus:border-green-500 text-xs font-bold text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select className="bg-[#111114] border border-white/5 rounded-2xl px-3 outline-none text-xs font-bold text-white/60 focus:border-green-500" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="rating-desc">Mayor Media</option>
                <option value="rating-asc">Menor Media</option>
                <option value="value-desc">Mayor Valor</option>
                <option value="value-asc">Menor Valor</option>
                <option value="age-desc">Mayor Edad</option>
                <option value="age-asc">Menor Edad</option>
                <option value="name-asc">Nombre (A-Z)</option>
              </select>
            </div>

            <div className="flex justify-between items-center px-2">
              <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">{players.length} Jugadores en Plantilla</span>
            </div>

            <button onClick={() => { setEditingId(null); setNewPlayer({ name: '', rating: '', positions: ['MC'], age: '', preferredFoot: 'Diestro', marketValue: '', type: 'Comprado', value: '', loanDuration: '1 Temporada', originClub: '' }); setShowForm(true); }} className="w-full bg-green-500 text-black p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-400">
              <Plus size={16} /> Fichar Nuevo Jugador
            </button>

            {showForm && (
              <form onSubmit={addOrUpdatePlayer} className="bg-[#18181b] p-5 rounded-[32px] border border-green-500/30 space-y-4 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black italic text-green-500 text-sm uppercase">{editingId ? 'Editar Jugador' : 'Nuevo Jugador'}</h3>
                  <button type="button" onClick={() => setShowForm(false)} className="p-1 text-white/20"><X size={18} /></button>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Nombre</label>
                  <input type="text" placeholder="Ej: Erling Haaland" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 focus:border-green-500 font-bold" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Posiciones (Toca para seleccionar varias)</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                    {ALL_POSITIONS.map(pos => (
                      <button 
                        key={pos} type="button" 
                        onClick={() => togglePosition(pos)} 
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${newPlayer.positions.includes(pos) ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-black/50 text-white/40 border border-white/5'}`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Media</label>
                    <input type="number" placeholder="90" min="1" max="99" className="w-full h-14 bg-white/5 rounded-xl outline-none border border-white/5 text-center font-black text-xl text-white" value={newPlayer.rating} onChange={(e) => setNewPlayer({ ...newPlayer, rating: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Edad</label>
                    <input type="number" placeholder="23" min="15" max="50" className="w-full h-14 bg-white/5 rounded-xl outline-none border border-white/5 text-center font-black text-xl text-white" value={newPlayer.age} onChange={(e) => setNewPlayer({ ...newPlayer, age: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Pierna</label>
                    <select className="w-full h-14 bg-[#18181b] rounded-xl outline-none border border-white/5 text-center font-black text-[10px] text-white" value={newPlayer.preferredFoot} onChange={(e) => setNewPlayer({ ...newPlayer, preferredFoot: e.target.value })}>
                      <option value="Diestro">Diestro</option>
                      <option value="Zurdo">Zurdo</option>
                      <option value="Ambas">Ambas</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Valor de Mercado (€)</label>
                  <input type="text" placeholder="Ej: 80.000.000" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 text-center font-black text-lg text-white" value={newPlayer.marketValue} onChange={(e) => setNewPlayer({ ...newPlayer, marketValue: formatValueInput(e.target.value) })} />
                </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-white/30 ml-1">Tipo de Adquisición</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Cantera'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Cantera' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Cantera</button>
                  <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Cedido'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Cedido' ? 'bg-yellow-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Cedido</button>
                  <button type="button" onClick={() => setNewPlayer({...newPlayer, type: 'Comprado'})} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${newPlayer.type === 'Comprado' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>Comprado</button>
                </div>
              </div>

              {newPlayer.type === 'Comprado' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 ml-1">Precio de Compra (€)</label>
                  <input type="text" placeholder="Ej: 50.000.000" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 text-center font-black text-lg text-white" value={newPlayer.value} onChange={(e) => setNewPlayer({ ...newPlayer, value: formatValueInput(e.target.value) })} />
                </div>
              )}

              {newPlayer.type === 'Cedido' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Duración Cesión</label>
                    <select className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 font-black text-xs text-white" value={newPlayer.loanDuration} onChange={(e) => setNewPlayer({ ...newPlayer, loanDuration: e.target.value })}>
                      <option value="6 Meses">6 Meses</option>
                      <option value="1 Temporada">1 Temporada</option>
                      <option value="2 Temporadas">2 Temporadas</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 ml-1">Club de Origen</label>
                    <input type="text" placeholder="Ej: Real Madrid" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 font-bold text-sm text-white" value={newPlayer.originClub} onChange={(e) => setNewPlayer({ ...newPlayer, originClub: e.target.value })} />
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-green-500 text-black p-4 rounded-xl font-black uppercase text-xs tracking-wider mt-4 hover:bg-green-400">
                {editingId ? 'Guardar Cambios' : 'Añadir a la Plantilla'}
                </button>
              </form>
            )}

            <div className="bg-[#111114] rounded-[24px] md:rounded-[32px] border border-white/10 overflow-hidden divide-y divide-white/5 shadow-2xl">
              {filteredPlayers.length === 0 && (
                <div className="p-16 text-center text-white/10 font-black italic uppercase tracking-widest text-xs">
                  {searchQuery ? 'No se encontraron jugadores' : 'Plantilla Vacía'}
                </div>
              )}
              {filteredPlayers.map((p) => (
                <div key={p.id} className="p-3 md:p-4 flex items-center justify-between group hover:bg-white/[0.01] transition-all">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none ${getCardStyle(p.rating)}`}>
                      <span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5">{p.positions?.[0] || p.pos}</span>
                      <span className="text-lg md:text-xl">{p.rating}</span>
                    </div>
                    <div>
                      <div className="font-black uppercase italic text-sm md:text-base truncate tracking-tighter leading-tight flex items-center gap-2 text-white">
                        {p.name}
                      </div>
                      <div className="text-[8px] md:text-[9px] text-green-500/80 font-black uppercase tracking-widest mb-1">
                        {p.positions?.join(' · ') || p.pos}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[8px] md:text-[9px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{p.age} Años</span>
                        {p.marketValue && (
                          <span className="text-[8px] md:text-[9px] text-white/50 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{abbreviateValue(p.marketValue)}</span>
                        )}
                        {p.type === 'Cedido' && (
                          <span className="text-[7px] md:text-[8px] text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                            Cedido: {p.originClub} ({p.loanDuration})
                          </span>
                        )}
                        {p.type && p.type !== 'Cedido' && (
                          <span className={`text-[7px] md:text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${p.type === 'Cantera' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>
                            {p.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => editPlayer(p)} className="p-1.5 md:p-2 text-white/20 hover:text-green-500 transition-colors bg-white/5 rounded-xl"><Edit2 size={14} /></button>
                    <button onClick={() => setPlayerToDelete(p.id)} className="p-1.5 md:p-2 text-white/20 hover:text-red-500 transition-colors bg-white/5 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tactics' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col gap-3 md:gap-4 mb-2">
              <div className="flex justify-between items-center bg-[#111114] p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-white/5 shadow-2xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Esquema Táctico</span>
                <select value={formation} onChange={(e) => { setFormation(e.target.value); saveTactics(e.target.value, lineup, bench); }} className="bg-transparent text-green-500 font-black uppercase outline-none cursor-pointer text-xs">
                  {Object.keys(FORMATIONS).map((f) => <option key={f} value={f} className="bg-[#111114]">{f}</option>)}
                </select>
              </div>

              <div className="bg-[#111114] p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-white/5 shadow-2xl flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la táctica..."
                  className="flex-1 bg-white/5 p-3 rounded-xl outline-none border border-white/5 focus:border-green-500 text-xs font-bold text-white placeholder:text-white/20"
                  value={newFormationName}
                  onChange={(e) => setNewFormationName(e.target.value)}
                />
                <button onClick={saveCurrentFormation} className="bg-green-500 text-black px-4 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-green-500/20 active:scale-95 transition-all">
                  Guardar
                </button>
                <button onClick={clearTactics} className="bg-red-500/10 text-red-500 px-4 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-red-500/20 transition-all border border-red-500/20 flex items-center gap-2" title="Mandar todos a no convocados">
                  <Trash2 size={16} /> <span className="hidden md:inline">Vaciar Todo</span>
                </button>
              </div>

              {savedFormations.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {savedFormations.map((f, i) => (
                    <div key={i} className="flex-shrink-0 bg-white/5 border border-white/10 rounded-xl p-2 flex items-center gap-3">
                      <button onClick={() => loadSavedFormation(f)} className="text-[10px] font-black uppercase text-white/80 hover:text-green-400 transition-colors">
                        {f.name} ({f.formation})
                      </button>
                      <button onClick={() => setFormationToDelete(f.name)} className="p-1.5 text-white/20 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#1a2e1d] border-4 border-green-500/20 rounded-[32px] md:rounded-[48px] p-6 relative min-h-[500px] md:min-h-[580px] overflow-hidden shadow-inner">
              <div className="absolute inset-4 border-2 border-white/30 rounded-[28px] pointer-events-none"></div>
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-36 md:h-36 border-2 border-white/30 rounded-full pointer-events-none"></div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 md:w-48 h-16 md:h-20 border-b-2 border-x-2 border-white/30 pointer-events-none"></div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 md:w-48 h-16 md:h-20 border-t-2 border-x-2 border-white/30 pointer-events-none"></div>

              {FORMATIONS[formation].map((slot, idx) => {
                const player = players.find((p) => p.id === lineup[idx]);
                const isDragOver = draggedPlayer && draggedSourceSlot !== idx;
                const canDropHere = isDragOver && player && player.positions?.includes(slot.pos); 

                return (
                  <div key={idx} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                    <button 
                      data-slot={idx}
                      onClick={() => {
                        if (player) {
                          setSelectedPlayerInfo(player);
                          setInfoSlot(idx);
                        } else {
                          setPickingSlot(idx);
                        }
                      }} 
                      draggable={!!player}
                      onDragStart={(e) => handleDragStart(e, player?.id, idx)}
                      onTouchStart={(e) => handleTouchStartLocal(e, player?.id, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-2 flex flex-col items-center justify-center font-black transition-all duration-300 shadow-2xl active:scale-90 touch-none ${player ? `bg-[#18181b] ${getCardStyle(player.rating, true)} scale-105` : 'bg-black/80 border-white/10 border-dashed text-white/20 hover:border-white/40'} ${draggedPlayer && !player && FORMATIONS[formation][idx] ? (players.find(p => p.id === draggedPlayer)?.positions?.includes(slot.pos) ? 'border-green-400 bg-green-500/20' : '') : ''}`}
                    >
                      {player ? (
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[7px] md:text-[8px] opacity-70 font-bold mb-0.5 uppercase">{slot.pos}</span>
                          <span className="text-sm md:text-base">{player.rating}</span>
                        </div>
                      ) : <span className="text-[8px] md:text-[9px] uppercase tracking-tighter">{slot.pos}</span>}
                    </button>
                    {player && (
                      <div className="flex flex-col items-center pointer-events-none mt-1 gap-0.5">
                        <span className="text-[7px] md:text-[8px] font-black bg-black/90 text-white/90 px-1.5 md:px-2 py-0.5 rounded-md border border-white/10 shadow-lg whitespace-nowrap uppercase italic max-w-[70px] md:max-w-[80px] truncate">
                          {player.name}
                        </span>
                        {player.positions?.filter(p => p !== slot.pos).length > 0 && (
                          <span className="text-[6px] md:text-[7px] text-green-400 font-black uppercase tracking-widest bg-black/60 px-1.5 py-0.5 rounded">
                            {player.positions.filter(p => p !== slot.pos).join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 bg-[#111114] p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-white/5 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 italic mb-3">Banquillo</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                  const playerId = bench[idx];
                  const player = playerId ? players.find((p) => p.id === playerId) : null;
                  return (
                    <div 
                      key={`bench-wrapper-${idx}`}
                      data-slot={`bench-${idx}`}
                      onClick={() => {
                        if (player) {
                          setSelectedPlayerInfo(player);
                          setInfoSlot(`bench-${idx}`);
                        } else {
                          setPickingSlot(`bench-${idx}`);
                        }
                      }} 
                      draggable={!!player}
                      onDragStart={(e) => handleDragStart(e, player?.id, `bench-${idx}`)}
                      onTouchStart={(e) => handleTouchStartLocal(e, player?.id, `bench-${idx}`)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, `bench-${idx}`)}
                      className={`w-full aspect-square flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer active:cursor-grabbing touch-none transition-all duration-200 ${player ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-black/40 border-white/10 border-dashed hover:border-white/40'} ${draggedPlayer && !player ? 'border-green-400 bg-green-500/10' : ''}`}
                    >
                      {player ? (
                        <>
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-[10px] md:text-xs mb-1 ${getCardStyle(player.rating)}`}>
                            {player.rating}
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold uppercase italic text-white/90 w-full text-center truncate pointer-events-none">{player.name.split(' ').pop()}</span>
                          <span className="text-[7px] text-green-400 font-black uppercase tracking-widest w-full text-center truncate pointer-events-none">{player.positions?.join('·')}</span>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-30 pointer-events-none">
                          <span className="text-xl font-black">+</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mt-4">
              {/* No Convocados */}
              <div 
                data-slot="uncalled"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'uncalled')}
                className={`flex-1 bg-[#111114] p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-white/5 shadow-2xl min-h-[120px] transition-colors ${draggedPlayer ? 'border-dashed border-white/20 bg-white/[0.02]' : ''}`}
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 italic mb-3">No Convocados</h3>
                <div className="flex flex-col gap-2">
                  {players.filter(p => !Object.values(lineup).includes(p.id) && !Object.values(bench).includes(p.id) && (p.transferStatus || 'Activo') === 'Activo').sort((a, b) => b.rating - a.rating).map(p => (
                    <div 
                      key={p.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id, 'uncalled')}
                      onTouchStart={(e) => handleTouchStartLocal(e, p.id, 'uncalled')}
                      onClick={() => { setSelectedPlayerInfo(p); setInfoSlot('uncalled'); }}
                      className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-xl border border-white/5 cursor-pointer active:cursor-grabbing touch-none hover:bg-white/10"
                    >
                      <div className={`w-8 h-8 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(p.rating)}`}>
                        {p.rating}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] md:text-xs font-bold uppercase italic text-white/90 truncate">{p.name}</span>
                        <span className="text-[8px] text-green-400 font-black uppercase tracking-widest truncate">{p.positions?.join(' · ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Para Ceder */}
              <div 
                data-slot="forLoan"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'forLoan')}
                className={`flex-1 bg-[#111114] p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-yellow-500/10 shadow-2xl min-h-[120px] transition-colors ${draggedPlayer ? 'border-dashed border-yellow-500/30 bg-yellow-500/[0.02]' : ''}`}
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60 italic mb-3">Para Ceder</h3>
                <div className="flex flex-col gap-2">
                  {players.filter(p => !Object.values(lineup).includes(p.id) && !Object.values(bench).includes(p.id) && p.transferStatus === 'Cedible').sort((a, b) => b.rating - a.rating).map(p => (
                    <div 
                      key={p.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id, 'forLoan')}
                      onTouchStart={(e) => handleTouchStartLocal(e, p.id, 'forLoan')}
                      onClick={() => { setSelectedPlayerInfo(p); setInfoSlot('forLoan'); }}
                      className="flex items-center gap-3 bg-yellow-500/5 px-3 py-2 rounded-xl border border-yellow-500/10 cursor-pointer active:cursor-grabbing touch-none hover:bg-yellow-500/10"
                    >
                      <div className={`w-8 h-8 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(p.rating)}`}>
                        {p.rating}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] md:text-xs font-bold uppercase italic text-white/90 truncate">{p.name}</span>
                        <span className="text-[8px] text-yellow-500 font-black uppercase tracking-widest truncate">{p.positions?.join(' · ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Para Vender */}
              <div 
                data-slot="forSale"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'forSale')}
                className={`flex-1 bg-[#111114] p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-red-500/10 shadow-2xl min-h-[120px] transition-colors ${draggedPlayer ? 'border-dashed border-red-500/30 bg-red-500/[0.02]' : ''}`}
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/60 italic mb-3">Para Vender</h3>
                <div className="flex flex-col gap-2">
                  {players.filter(p => !Object.values(lineup).includes(p.id) && !Object.values(bench).includes(p.id) && p.transferStatus === 'Transferible').sort((a, b) => b.rating - a.rating).map(p => (
                    <div 
                      key={p.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id, 'forSale')}
                      onTouchStart={(e) => handleTouchStartLocal(e, p.id, 'forSale')}
                      onClick={() => { setSelectedPlayerInfo(p); setInfoSlot('forSale'); }}
                      className="flex items-center gap-3 bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10 cursor-pointer active:cursor-grabbing touch-none hover:bg-red-500/10"
                    >
                      <div className={`w-8 h-8 rounded-lg flex flex-shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(p.rating)}`}>
                        {p.rating}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] md:text-xs font-bold uppercase italic text-white/90 truncate">{p.name}</span>
                        <span className="text-[8px] text-red-400 font-black uppercase tracking-widest truncate">{p.positions?.join(' · ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Drag Avatar for Touch Devices */}
      {floatingDrag && (
        <div 
          style={{ left: floatingDrag.x, top: floatingDrag.y }}
          className={`fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center font-black shadow-2xl bg-[#18181b] ${getCardStyle(floatingDrag.player.rating, true)}`}
        >
          <span className="text-[8px] opacity-70 font-bold mb-0.5 uppercase">{floatingDrag.player.positions?.[0]}</span>
          <span className="text-base">{floatingDrag.player.rating}</span>
        </div>
      )}

      {/* Modal de Selección */}
      {pickingSlot !== null && (
        <div className="fixed inset-0 bg-black/95 z-[100] p-4 md:p-6 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6 mt-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white">Colocar Jugador</h2>
              <p className="text-[9px] md:text-[10px] text-green-500 font-black uppercase tracking-widest">
                Alineación: {String(pickingSlot).startsWith('bench-') ? 'Banquillo' : FORMATIONS[formation][pickingSlot]?.pos}
              </p>
            </div>
            <button onClick={() => setPickingSlot(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/50 hover:text-white"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pb-8 no-scrollbar">
            <button onClick={() => assignPlayerToSlot(pickingSlot, null)} className="w-full p-4 md:p-5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black uppercase text-[10px] tracking-wider border border-red-500/20">
              Mandar a No Convocados
            </button>

            {players.sort((a, b) => b.rating - a.rating).map((p) => {
              const isBenchSlot = String(pickingSlot).startsWith('bench-');
              const slotData = isBenchSlot ? null : FORMATIONS[formation][pickingSlot];
              const canPlay = isBenchSlot || (p.positions && slotData && p.positions.includes(slotData.pos));

              if (!canPlay) return null;

              const isAlreadyIn11 = Object.values(lineup).includes(p.id);
              const isAlreadyInBench = Object.values(bench).includes(p.id);
              const isCurrentSlot = isBenchSlot ? bench[pickingSlot.split('-')[1]] === p.id : lineup[pickingSlot] === p.id;
              
              return (
                <button key={p.id} onClick={() => assignPlayerToSlot(pickingSlot, p.id)} className={`w-full p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4 transition-all border ${isCurrentSlot ? 'border-green-500 bg-green-500/10' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex flex-col items-center justify-center font-black leading-none ${getCardStyle(p.rating)}`}>
                    <span className="text-[7px] md:text-[8px] opacity-70 mb-0.5">{p.positions?.[0]}</span>
                    <span className="text-base md:text-lg">{p.rating}</span>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-black uppercase italic text-sm md:text-base truncate text-white">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                       <span className="text-[8px] md:text-[9px] text-white/30 font-black uppercase">{p.age} Años</span>
                       {(!isCurrentSlot && (isAlreadyIn11 || isAlreadyInBench)) && (
                         <span className="text-[7px] md:text-[8px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase font-black tracking-widest">
                            {isAlreadyIn11 ? 'En el 11' : 'Banquillo'}
                         </span>
                       )}
                    </div>
                  </div>
                  {isCurrentSlot && <Check className="text-green-500" size={18} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Información del Jugador */}
      {selectedPlayerInfo && (
        <div className="fixed inset-0 bg-black/95 z-[150] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedPlayerInfo(null)}>
          <div className="bg-[#111114] border border-white/10 p-6 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedPlayerInfo(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"><X size={18} /></button>
            
            <h3 className="text-center text-[10px] font-black uppercase tracking-widest text-white/40 italic mb-4">Ficha del Jugador</h3>
            
            <div className="p-4 bg-white/5 rounded-[24px] border border-white/5 flex flex-col gap-4">
               <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black leading-none shadow-lg flex-shrink-0 ${getCardStyle(selectedPlayerInfo.rating)}`}>
                    <span className="text-[8px] opacity-70 font-bold mb-0.5">{selectedPlayerInfo.positions?.[0]}</span>
                    <span className="text-xl">{selectedPlayerInfo.rating}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black uppercase italic text-lg truncate tracking-tighter leading-tight text-white">
                      {selectedPlayerInfo.name}
                    </div>
                    <div className="text-[10px] text-green-500/80 font-black uppercase tracking-widest mb-1 mt-0.5 truncate">
                      {selectedPlayerInfo.positions?.join(' · ')}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{selectedPlayerInfo.age} Años</span>
                      <span className="text-[9px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{selectedPlayerInfo.preferredFoot || 'Diestro'}</span>
                      <span className="text-[9px] text-white/50 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{abbreviateValue(selectedPlayerInfo.marketValue || selectedPlayerInfo.value)}</span>
                      
                      {selectedPlayerInfo.type === 'Cedido' && (
                        <span className="text-[8px] text-yellow-500 font-black uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                          Cedido: {selectedPlayerInfo.originClub} ({selectedPlayerInfo.loanDuration})
                        </span>
                      )}
                      {selectedPlayerInfo.type && selectedPlayerInfo.type !== 'Cedido' && (
                        <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${selectedPlayerInfo.type === 'Cantera' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>
                          {selectedPlayerInfo.type}
                        </span>
                      )}
                    </div>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-2 mt-6">
               <button onClick={() => { setActiveTab('squad'); setSelectedPlayerInfo(null); editPlayer(selectedPlayerInfo); }} className="w-full py-4 rounded-2xl bg-blue-500/10 text-blue-500 font-black uppercase text-[10px] hover:bg-blue-500/20 transition-all flex justify-center items-center gap-2 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                  <Edit2 size={14}/> Editar Jugador
               </button>

               {!isUncalledZone(infoSlot) && !String(infoSlot).startsWith('bench-') && [0,1,2,3,4,5,6,7,8].find(i => !bench[i]) !== undefined && (
                  <button onClick={() => { const emptyIdx = [0,1,2,3,4,5,6,7,8].find(i => !bench[i]); assignPlayerToSlot(`bench-${emptyIdx}`, selectedPlayerInfo.id); setSelectedPlayerInfo(null); }} className="w-full py-4 rounded-2xl bg-yellow-500/10 text-yellow-500 font-black uppercase text-[10px] hover:bg-yellow-500/20 border border-yellow-500/20 transition-all flex justify-center items-center gap-2 shadow-lg shadow-yellow-500/10">
                     Mandar al Banquillo
                  </button>
               )}

               {!isUncalledZone(infoSlot) && (
                  <>
                     <button onClick={() => { setPickingSlot(infoSlot); setSelectedPlayerInfo(null); }} className="w-full py-4 rounded-2xl bg-white/10 text-white font-black uppercase text-[10px] hover:bg-white/20 transition-all flex justify-center items-center gap-2">
                        <RefreshCcw size={14}/> Reemplazar Jugador
                     </button>
                     <button onClick={() => { assignPlayerToSlot(infoSlot, null); setSelectedPlayerInfo(null); }} className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-black uppercase text-[10px] hover:bg-red-500/20 border border-red-500/20 transition-all flex justify-center items-center gap-2 shadow-lg shadow-red-500/10">
                        <Trash2 size={14}/> Mandar a No Convocados
                     </button>
                  </>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Modales de Confirmación */}
      {playerToDelete && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111114] border border-white/10 p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-white">¿Borrar Jugador?</h3>
            <p className="text-[10px] text-white/50 mb-6 font-bold uppercase tracking-widest">Esta acción es irreversible y se quitará de tus tácticas.</p>
            <div className="flex gap-3">
              <button onClick={() => setPlayerToDelete(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/50 font-black uppercase text-[10px] hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={confirmDeletePlayer} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all">Sí, Borrar</button>
            </div>
          </div>
        </div>
      )}

      {formationToDelete && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#111114] border border-white/10 p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-white">¿Borrar Formación?</h3>
            <p className="text-[10px] text-white/50 mb-6 font-bold uppercase tracking-widest">Se eliminará "{formationToDelete}" de tus tácticas guardadas.</p>
            <div className="flex gap-3">
              <button onClick={() => setFormationToDelete(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white/50 font-black uppercase text-[10px] hover:bg-white/10 transition-all">Cancelar</button>
              <button onClick={confirmDeleteFormation} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all">Sí, Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}