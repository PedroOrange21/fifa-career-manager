import { createContext, useContext, useEffect, useState } from 'react';
import { onSnapshot, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { clubsCol, clubDoc } from '../utils/firestorePaths';
import { useAuth } from './AuthContext';

const ClubsContext = createContext(null);

export function ClubsProvider({ children }) {
  const { user, loadingApp } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [activeClubId, setActiveClubId] = useState(null);
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubToDelete, setClubToDelete] = useState(null);
  const [editingClub, setEditingClub] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsubClubs = onSnapshot(clubsCol(user.uid), (snap) => {
      const fetchedClubs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt - b.createdAt);
      setClubs(fetchedClubs);
      setLoadingClubs(false);

      if (fetchedClubs.length > 0) {
        setActiveClubId((prev) => (!prev || !fetchedClubs.find((c) => c.id === prev)) ? fetchedClubs[0].id : prev);
      } else {
        setActiveClubId(null);
        if (!loadingApp) setShowClubModal(true);
      }
    }, (err) => console.error('Error fetching clubs:', err));

    return () => unsubClubs();
  }, [user, loadingApp]);

  const createClub = async (name, logo) => {
    if (!user || !name.trim()) return null;
    const isFirstClub = clubs.length === 0;
    const clubId = crypto.randomUUID();
    await setDoc(clubDoc(user.uid, clubId), {
      name: name.trim(),
      logo: logo || null,
      createdAt: Date.now(),
      transferBudget: 0,
      currentSeasonNumber: 1,
    });
    setClubs((prev) => (prev.find((c) => c.id === clubId) ? prev : [...prev, { id: clubId, name: name.trim(), logo: logo || null, createdAt: Date.now(), transferBudget: 0, currentSeasonNumber: 1 }]));
    setShowClubModal(false);
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
    const deletedId = clubToDelete;
    try {
      await deleteDoc(clubDoc(user.uid, deletedId));
      setClubs((prev) => prev.filter((c) => c.id !== deletedId));
      if (activeClubId === deletedId) setActiveClubId(null);
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

  const incrementSeasonNumber = async () => {
    if (!user || !activeClubId) return;
    await updateDoc(clubDoc(user.uid, activeClubId), { currentSeasonNumber: increment(1) });
  };

  const value = {
    clubs, loadingClubs, activeClubId, setActiveClubId, activeClub,
    showClubModal, setShowClubModal,
    clubToDelete, setClubToDelete,
    editingClub, setEditingClub,
    createClub, updateClub, confirmDeleteClub,
    adjustBudget, setBudget, incrementSeasonNumber,
  };

  return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>;
}

export const useClubs = () => useContext(ClubsContext);
