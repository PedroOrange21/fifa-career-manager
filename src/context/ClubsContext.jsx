import { createContext, useContext, useEffect, useState } from 'react';
import { onSnapshot, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { clubsCol, clubDoc } from '../utils/firestorePaths';
import { useAuth } from './AuthContext';

const ClubsContext = createContext(null);

const activeCareerStorageKey = (uid) => `fifa-manager:activeCareerId:${uid}`;

export function ClubsProvider({ children }) {
  const { user, loadingApp } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [activeClubId, setActiveClubIdState] = useState(null);
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubToDelete, setClubToDelete] = useState(null);
  const [editingClub, setEditingClub] = useState(null);

  const setActiveClubId = (clubId) => {
    setActiveClubIdState(clubId);
    if (user && clubId) {
      try { localStorage.setItem(activeCareerStorageKey(user.uid), clubId); } catch (err) { console.error(err); }
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubClubs = onSnapshot(clubsCol(user.uid), (snap) => {
      const fetchedClubs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
      setClubs(fetchedClubs);
      setLoadingClubs(false);

      if (fetchedClubs.length > 0) {
        setActiveClubIdState((prev) => {
          if (prev && fetchedClubs.find((c) => c.id === prev)) return prev;
          let stored = null;
          try { stored = localStorage.getItem(activeCareerStorageKey(user.uid)); } catch (err) { console.error(err); }
          if (stored && fetchedClubs.find((c) => c.id === stored)) return stored;
          return fetchedClubs[0].id;
        });
      } else {
        setActiveClubIdState(null);
        if (!loadingApp) setShowClubModal(true);
      }
    }, (err) => console.error('Error fetching clubs:', err));

    return () => unsubClubs();
  }, [user, loadingApp]);

  // "initialWeeklyWageBudget": cifra SEMANAL tal cual la muestra EA Sports FC ("Presup. sem."
  // en Oficina > Economía) — igual que los sueldos de jugadores y objetivos (p.wage/t.wage),
  // así que se compara directamente contra la masa salarial sin ninguna conversión de unidad.
  // Se escribe en el mismo setDoc de creación en vez de con una llamada aparte a setWageBudget
  // justo después, porque esa función depende de "activeClubId" del contexto, que puede no
  // haberse actualizado todavía al club recién creado en ese mismo instante.
  const createClub = async (name, logo, initialBudget = 0, initialWeeklyWageBudget = null) => {
    if (!user || !name.trim()) return null;
    const isFirstClub = clubs.length === 0;
    const clubId = crypto.randomUUID();
    const budget = Number(initialBudget) || 0;
    const weeklyWageBudget = initialWeeklyWageBudget != null ? Number(initialWeeklyWageBudget) : null;
    await setDoc(clubDoc(user.uid, clubId), {
      name: name.trim(),
      logo: logo || null,
      createdAt: Date.now(),
      transferBudget: budget,
      weeklyWageBudget,
      currentSeasonNumber: 1,
      // Los clubes creados a partir de aquí ya registran los sueldos de jugadores/objetivos
      // directamente en semanal (ver ClubDataContext, migración "wageMigrationV1"): se marcan
      // como ya migrados desde el origen para que ese efecto nunca los reconvierta.
      wageMigrationV1: true,
    });
    setClubs((prev) => (prev.find((c) => c.id === clubId) ? prev : [...prev, { id: clubId, name: name.trim(), logo: logo || null, createdAt: Date.now(), transferBudget: budget, weeklyWageBudget, currentSeasonNumber: 1, wageMigrationV1: true }]));
    // No cierra showClubModal aquí: el asistente de creación (OnboardingWizardModal) sigue
    // abierto tras crear el club para encadenar el registro de jugadores, y es él quien decide
    // cuándo cerrarse (Omitir o Entrar a mi Club).
    setActiveClubId(clubId);
    return { clubId, isFirstClub };
  };

  const updateClub = async (clubId, { name, logo }) => {
    if (!user || !clubId || !name.trim()) return;
    await updateDoc(clubDoc(user.uid, clubId), { name: name.trim(), logo: logo || null });
    setEditingClub(null);
  };

  const confirmDeleteClub = async () => {
    if (!user || !clubToDelete) return;
    // Nunca se permite dejar la cuenta sin ningún modo carrera: si por cualquier vía se llega
    // aquí con un único club restante, se aborta el borrado como red de seguridad (la UI ya
    // oculta/deshabilita el botón de eliminar en ese caso).
    if (clubs.length <= 1) { setClubToDelete(null); return; }
    const deletedId = clubToDelete;
    const deletedIdx = clubs.findIndex((c) => c.id === deletedId);
    const remaining = clubs.filter((c) => c.id !== deletedId);
    try {
      await deleteDoc(clubDoc(user.uid, deletedId));
      setClubs(remaining);
      if (activeClubId === deletedId) {
        // Carga automáticamente otro modo carrera existente: el siguiente en la lista tras el
        // eliminado o, si era el último, el primero disponible.
        const nextClub = clubs[deletedIdx + 1] || remaining[0];
        setActiveClubId(nextClub ? nextClub.id : null);
      }
    } catch (err) {
      console.error(err);
    }
    setClubToDelete(null);
  };

  const activeClub = clubs.find((c) => c.id === activeClubId) || null;

  const adjustBudget = async (delta) => {
    if (!user || !activeClubId || !delta) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { transferBudget: increment(delta) });
  };

  const setBudget = async (amount) => {
    if (!user || !activeClubId) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { transferBudget: amount });
  };

  // Presupuesto de Salarios: siempre se guarda en Firestore como cifra SEMANAL
  // (weeklyWageBudget), exactamente la que EA Sports FC muestra en Oficina > Economía como
  // "Presup. sem." — mismo periodo en el que se guardan p.wage/t.wage en el resto de la app,
  // así que no hace falta ninguna conversión de unidad al compararlos. "activeClub.
  // weeklyWageBudget == null" es la señal de "sin definir todavía", distinta de haberlo
  // fijado explícitamente a 0.
  const setWageBudget = async (weeklyAmount) => {
    if (!user || !activeClubId) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { weeklyWageBudget: weeklyAmount });
  };

  const incrementSeasonNumber = async () => {
    if (!user || !activeClubId) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { currentSeasonNumber: increment(1) });
  };

  // Marca el asistente de bienvenida (OnboardingWizard) como resuelto para este club —
  // completado con datos o saltado con "Omitir" — para que no vuelva a aparecer en
  // sesiones futuras aunque la plantilla siga vacía.
  const completeOnboarding = async () => {
    if (!user || !activeClubId) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { onboardingCompleted: true });
  };

  const value = {
    clubs, loadingClubs, activeClubId, setActiveClubId, activeClub,
    showClubModal, setShowClubModal,
    clubToDelete, setClubToDelete,
    editingClub, setEditingClub,
    createClub, updateClub, confirmDeleteClub,
    adjustBudget, setBudget, setWageBudget, incrementSeasonNumber, completeOnboarding,
  };

  return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>;
}

export const useClubs = () => useContext(ClubsContext);
