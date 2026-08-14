import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { playersCol, playerDoc, tacticsDoc, transactionsCol, shortlistCol, shortlistDoc, matchesCol, seasonsCol } from '../utils/firestorePaths';
import { FORMATIONS } from '../constants/formations';
import { isUncalledZone } from '../utils/slots';
import { useAuth } from './AuthContext';
import { useClubs } from './ClubsContext';

const ClubDataContext = createContext(null);

export function ClubDataProvider({ children }) {
  const { user } = useAuth();
  const { activeClubId, adjustBudget, activeClub, incrementSeasonNumber } = useClubs();

  const [players, setPlayers] = useState([]);
  // Distingue "todavía no ha llegado el primer snapshot de jugadores" de "ya llegó y la
  // plantilla está realmente vacía": sin este flag, el asistente de bienvenida (que se
  // activa cuando players.length === 0) podría dispararse un instante en CADA cambio de
  // club, incluso en uno con jugadores, porque el array se resetea a [] de forma síncrona
  // antes de que el listener de Firestore entregue los datos reales.
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [formation, setFormation] = useState('4-3-3');
  const [lineup, setLineup] = useState({});
  const [bench, setBench] = useState({});
  const [savedFormations, setSavedFormations] = useState([]);
  // Espejo síncrono de savedFormations: saveTactics (llamada tras cada movimiento de
  // jugador) escribe este campo de vuelta en el documento con setDoc SIN merge, así que
  // necesita el valor más fresco posible en el momento exacto de la llamada. Leer el estado
  // (savedFormations) desde un closure es insuficiente cuando saveTactics se dispara justo
  // después de guardar/actualizar/renombrar/borrar una táctica desde otro componente (p.ej.
  // loadSavedFormation tras "Guardar como Nueva Formación"): ese closure puede seguir
  // apuntando a la función de un render anterior a que React aplique el setSavedFormations
  // más reciente, y su escritura sin merge revertiría en Firestore la lista recién guardada.
  const savedFormationsRef = useRef([]);
  const setSavedFormationsBoth = (value) => { savedFormationsRef.current = value; setSavedFormations(value); };
  const [activeTacticName, setActiveTacticName] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [matches, setMatches] = useState([]);
  const [seasons, setSeasons] = useState([]);

  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [formationToDelete, setFormationToDelete] = useState(null);
  const [scoutToDelete, setScoutToDelete] = useState(null);

  useEffect(() => {
    if (!user || !activeClubId) {
      setPlayers([]);
      setPlayersLoaded(false);
      setLineup({});
      setBench({});
      setTransactions([]);
      setShortlist([]);
      setMatches([]);
      setSeasons([]);
      return;
    }

    setPlayers([]); setPlayersLoaded(false); setFormation('4-3-3'); setLineup({}); setBench({}); setSavedFormationsBoth([]); setActiveTacticName(null);
    setTransactions([]); setShortlist([]); setMatches([]); setSeasons([]);

    const unsubPlayers = onSnapshot(playersCol(user.uid, activeClubId), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPlayersLoaded(true);
    }, (err) => console.error('Error fetching players:', err));

    const unsubTactics = onSnapshot(tacticsDoc(user.uid, activeClubId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFormation(data.formation || '4-3-3');
        setLineup(data.lineup || {});
        setBench(data.bench || {});
        setSavedFormationsBoth(data.savedFormations || []);
        setActiveTacticName(data.activeTacticName || null);
      } else {
        setFormation('4-3-3'); setLineup({}); setBench({}); setSavedFormationsBoth([]); setActiveTacticName(null);
      }
    });

    const unsubTransactions = onSnapshot(transactionsCol(user.uid, activeClubId), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date));
    }, (err) => console.error('Error fetching transactions:', err));

    const unsubShortlist = onSnapshot(shortlistCol(user.uid, activeClubId), (snap) => {
      setShortlist(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Error fetching shortlist:', err));

    const unsubMatches = onSnapshot(matchesCol(user.uid, activeClubId), (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date));
    }, (err) => console.error('Error fetching matches:', err));

    const unsubSeasons = onSnapshot(seasonsCol(user.uid, activeClubId), (snap) => {
      setSeasons(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.seasonNumber - a.seasonNumber));
    }, (err) => console.error('Error fetching seasons:', err));

    return () => { unsubPlayers(); unsubTactics(); unsubTransactions(); unsubShortlist(); unsubMatches(); unsubSeasons(); };
  }, [user, activeClubId]);

  const logTransaction = async (type, playerName, amount) => {
    if (!user || !activeClubId) return;
    await addDoc(transactionsCol(user.uid, activeClubId), { type, playerName, amount, date: Date.now() });
  };

  const addOrUpdateScout = async (scoutData, editingId) => {
    if (!user || !activeClubId) return;
    const id = editingId || crypto.randomUUID();
    await setDoc(shortlistDoc(user.uid, activeClubId, id), { ...scoutData, createdAt: scoutData.createdAt || Date.now() }, { merge: true });
    return id;
  };

  const deleteScout = async (scoutId) => {
    if (!user || !activeClubId || !scoutId) return;
    try { await deleteDoc(shortlistDoc(user.uid, activeClubId, scoutId)); } catch (err) { console.error(err); }
  };

  const confirmDeleteScout = async () => {
    if (!user || !activeClubId || !scoutToDelete) return;
    try { await deleteDoc(shortlistDoc(user.uid, activeClubId, scoutToDelete)); } catch (err) { console.error(err); }
    setScoutToDelete(null);
  };

  const EVENT_STAT_FIELD = { gol: 'goals', asistencia: 'assists', amarilla: 'yellowCards', roja: 'redCards' };

  const saveMatch = async ({ opponent, scoreFor, scoreAgainst, events, lineupPlayerIds }) => {
    if (!user || !activeClubId) return;
    const seasonNumber = activeClub?.currentSeasonNumber ?? 1;
    await addDoc(matchesCol(user.uid, activeClubId), { opponent, scoreFor, scoreAgainst, events, seasonNumber, date: Date.now() });

    const statsMap = {};
    lineupPlayerIds.forEach((id) => { statsMap[id] = { ...(statsMap[id] || {}), matchesPlayed: 1 }; });
    events.forEach((e) => {
      const field = EVENT_STAT_FIELD[e.type];
      if (!field) return;
      statsMap[e.playerId] = statsMap[e.playerId] || {};
      statsMap[e.playerId][field] = (statsMap[e.playerId][field] || 0) + 1;
    });

    await Promise.all(Object.entries(statsMap).map(([playerId, stats]) => {
      const updates = {};
      Object.entries(stats).forEach(([field, val]) => { updates[`seasonStats.${field}`] = increment(val); });
      return updateDoc(playerDoc(user.uid, activeClubId, playerId), updates);
    }));
  };

  const endSeason = async () => {
    if (!user || !activeClubId || !activeClub) return;
    const seasonNumber = activeClub.currentSeasonNumber ?? 1;
    const seasonMatches = matches.filter((m) => m.seasonNumber === seasonNumber);

    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    seasonMatches.forEach((m) => {
      goalsFor += m.scoreFor; goalsAgainst += m.scoreAgainst;
      if (m.scoreFor > m.scoreAgainst) wins++; else if (m.scoreFor === m.scoreAgainst) draws++; else losses++;
    });

    const goalsByPlayer = {};
    seasonMatches.forEach((m) => {
      (m.events || []).filter((e) => e.type === 'gol').forEach((e) => {
        goalsByPlayer[e.playerId] = (goalsByPlayer[e.playerId] || 0) + 1;
      });
    });
    const topScorers = Object.entries(goalsByPlayer)
      .map(([playerId, goals]) => ({ playerId, goals, name: players.find((p) => p.id === playerId)?.name || 'Desconocido' }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);

    const previousSeason = seasons.find((s) => s.seasonNumber === seasonNumber - 1);

    await addDoc(seasonsCol(user.uid, activeClubId), {
      seasonNumber,
      startedAt: previousSeason?.endedAt || activeClub.createdAt || null,
      endedAt: Date.now(),
      budgetEnd: activeClub.transferBudget || 0,
      squadSnapshot: players.map((p) => ({ playerId: p.id, name: p.name, rating: p.rating, position: p.positions?.[0] || null })),
      topScorers,
      matchesPlayed: seasonMatches.length,
      wins, draws, losses, goalsFor, goalsAgainst,
    });

    await Promise.all(players.map((p) => updateDoc(playerDoc(user.uid, activeClubId, p.id), {
      seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0 },
    })));

    await incrementSeasonNumber();
  };

  // skipFinancialEffects: usado por el asistente de configuración inicial (Create Your Club).
  // Un jugador "Comprado" registrado ahí refleja el estado base previo del club (ya estaba
  // fichado antes de empezar a usar la app), no una compra real hecha dentro de ella — no debe
  // descontar presupuesto ni dejar rastro en el historial de transacciones, que debe empezar
  // completamente limpio y registrar solo los movimientos posteriores.
  const addOrUpdatePlayer = async (playerData, editingId, { skipFinancialEffects = false } = {}) => {
    if (!user || !activeClubId) return;
    const id = editingId || crypto.randomUUID();
    await setDoc(playerDoc(user.uid, activeClubId, id), playerData, { merge: true });
    if (!editingId && !skipFinancialEffects && playerData.type === 'Comprado' && playerData.value > 0) {
      adjustBudget(-playerData.value);
      logTransaction('compra', playerData.name, playerData.value);
    }
    return id;
  };

  const sellPlayer = async (player, salePrice) => {
    if (!user || !activeClubId || !player || player.type === 'Cedido') return;
    await deleteDoc(playerDoc(user.uid, activeClubId, player.id));
    removePlayerFromTactic(player.id);
    adjustBudget(salePrice);
    logTransaction('venta', player.name, salePrice);
  };

  const cedePlayer = async (player, { destinationClub, duration, wagePercentage }) => {
    if (!user || !activeClubId || !player || player.type === 'Cedido') return;
    await updateDoc(playerDoc(user.uid, activeClubId, player.id), {
      transferStatus: 'CedidoFuera',
      outboundLoan: { destinationClub, duration, wagePercentage },
    });
    removePlayerFromTactic(player.id);
    const wageSaved = Math.round((player.wage || 0) * (1 - wagePercentage / 100));
    logTransaction('cesion', player.name, wageSaved);
  };

  const removePlayerFromTactic = (playerId) => {
    const newLineup = { ...lineup }; const newBench = { ...bench }; let changed = false;
    Object.keys(newLineup).forEach((slot) => { if (newLineup[slot] === playerId) { delete newLineup[slot]; changed = true; } });
    Object.keys(newBench).forEach((slot) => { if (newBench[slot] === playerId) { delete newBench[slot]; changed = true; } });
    if (changed) { setLineup(newLineup); setBench(newBench); saveTactics(formation, newLineup, newBench); }
  };

  const confirmDeletePlayer = async () => {
    if (!user || !activeClubId || !playerToDelete) return;
    try {
      await deleteDoc(playerDoc(user.uid, activeClubId, playerToDelete));
      removePlayerFromTactic(playerToDelete);
    } catch (err) { console.error(err); }
    setPlayerToDelete(null);
  };

  const saveTactics = async (newForm, newLineup, newBench, tacticName = activeTacticName) => {
    if (!user || !activeClubId) return;
    try {
      // Sin `merge: true` a propósito: lineup/bench son mapas donde las claves eliminadas
      // (jugador que sale de un slot) deben desaparecer del documento. Con merge, Firestore
      // fusiona los mapas anidados y las claves ausentes en el nuevo objeto NO se borran en el
      // servidor, dejando al jugador "duplicado" en su slot anterior tras el siguiente snapshot.
      await setDoc(tacticsDoc(user.uid, activeClubId), { formation: newForm, lineup: newLineup, bench: newBench ?? bench, savedFormations: savedFormationsRef.current, activeTacticName: tacticName ?? null });
    } catch (err) { console.error('Error al guardar táctica:', err); }
  };

  const clearTactics = () => {
    if (!user || !activeClubId) return;
    setLineup({}); setBench({}); setActiveTacticName(null); saveTactics(formation, {}, {}, null);
  };

  const clearLineup = () => {
    if (!user || !activeClubId) return;
    setLineup({}); setActiveTacticName(null); saveTactics(formation, {}, bench, null);
  };

  const clearBench = () => {
    if (!user || !activeClubId) return;
    setBench({}); setActiveTacticName(null); saveTactics(formation, lineup, {}, null);
  };

  const handleFormationChange = (newForm) => {
    const newLineup = { ...lineup }; const playersToUpdate = [];
    Object.keys(newLineup).forEach((idx) => {
      const player = players.find((p) => p.id === newLineup[idx]); const newSlotData = FORMATIONS[newForm][idx];
      if (!player || !newSlotData || !player.positions.includes(newSlotData.pos)) {
        if (player) playersToUpdate.push(player.id);
        delete newLineup[idx];
      }
    });
    playersToUpdate.forEach((playerId) => {
      updateDoc(playerDoc(user.uid, activeClubId, playerId), { transferStatus: 'Activo' });
    });
    // A diferencia de clearTactics/clearLineup/clearBench (que sí "sueltan" la táctica activa
    // a propósito, como reinicio deliberado), cambiar el esquema NO debe desvincular
    // activeTacticName: si lo hiciera, hasPendingChanges (que exige una táctica activa para
    // comparar) nunca detectaría el cambio y el botón de Guardar no se expandiría. Se omite el
    // 4º argumento a propósito para que saveTactics conserve el activeTacticName vigente.
    setFormation(newForm); setLineup(newLineup); saveTactics(newForm, newLineup, bench);
  };

  const executeMove = (playerId, source, target) => {
    if (!playerId || String(source) === String(target)) return;
    const player = players.find((p) => p.id === playerId); if (!player) return;

    if (!isUncalledZone(target) && !String(target).startsWith('bench-')) {
      const slotData = FORMATIONS[formation][target];
      if (slotData && !player.positions.includes(slotData.pos)) return;
    }

    const newLineup = { ...lineup }; const newBench = { ...bench };
    let displacedPlayerId = null;

    if (!isUncalledZone(target)) {
      if (String(target).startsWith('bench-')) displacedPlayerId = newBench[String(target).split('-')[1]];
      else displacedPlayerId = newLineup[target];
    }

    Object.keys(newLineup).forEach((k) => { if (newLineup[k] === playerId) delete newLineup[k]; });
    Object.keys(newBench).forEach((k) => { if (newBench[k] === playerId) delete newBench[k]; });

    if (!isUncalledZone(target)) {
      if (String(target).startsWith('bench-')) newBench[String(target).split('-')[1]] = playerId;
      else newLineup[target] = playerId;
    } else {
      let newStatus = 'Activo';
      if (target === 'forLoan') newStatus = 'Cedible';
      if (target === 'forSale') newStatus = 'Transferible';
      if (target === 'loanedOut') newStatus = 'CedidoFuera';
      if (newStatus === 'Activo' || player.type !== 'Cedido') {
        updateDoc(playerDoc(user.uid, activeClubId, playerId), { transferStatus: newStatus });
      }
    }

    if (displacedPlayerId && !isUncalledZone(source)) {
      Object.keys(newLineup).forEach((k) => { if (newLineup[k] === displacedPlayerId) delete newLineup[k]; });
      Object.keys(newBench).forEach((k) => { if (newBench[k] === displacedPlayerId) delete newBench[k]; });
      let canSwap = true;
      if (!String(source).startsWith('bench-')) {
        const displacedPlayer = players.find((p) => p.id === displacedPlayerId);
        const sourceSlotData = FORMATIONS[formation][source];
        if (displacedPlayer && sourceSlotData && !displacedPlayer.positions.includes(sourceSlotData.pos)) canSwap = false;
      }
      if (canSwap) {
        if (String(source).startsWith('bench-')) newBench[String(source).split('-')[1]] = displacedPlayerId;
        else newLineup[source] = displacedPlayerId;
      }
    }
    setLineup(newLineup); setBench(newBench); saveTactics(formation, newLineup, newBench);
  };

  const assignPlayerToSlot = (slotIndex, playerId) => {
    if (!playerId) {
      const playerToClear = String(slotIndex).startsWith('bench-') ? bench[String(slotIndex).split('-')[1]] : lineup[slotIndex];
      if (playerToClear) executeMove(playerToClear, slotIndex, 'uncalled');
    } else {
      let realSource = 'uncalled';
      Object.keys(lineup).forEach((k) => { if (lineup[k] === playerId) realSource = k; });
      Object.keys(bench).forEach((k) => { if (bench[k] === playerId) realSource = `bench-${k}`; });
      executeMove(playerId, realSource, slotIndex);
    }
  };

  const saveCurrentFormation = async (name) => {
    if (!user || !activeClubId || !name.trim()) return;
    const newSaved = [...savedFormations, { name, formation, lineup, bench }];
    setSavedFormationsBoth(newSaved);
    await setDoc(tacticsDoc(user.uid, activeClubId), { savedFormations: newSaved }, { merge: true });
  };

  // Sobrescribe la táctica guardada actualmente activa con la alineación/plantilla en curso
  // (a diferencia de saveCurrentFormation, que siempre añade una entrada nueva). Se usa desde
  // el botón "Guardar Cambios" que aparece cuando el once/banquillo/no convocados se separan
  // de lo que había guardado bajo ese nombre.
  const updateActiveTactic = async () => {
    if (!user || !activeClubId || !activeTacticName) return;
    const newSaved = savedFormations.map((f) => (f.name === activeTacticName ? { ...f, formation, lineup, bench } : f));
    setSavedFormationsBoth(newSaved);
    await setDoc(tacticsDoc(user.uid, activeClubId), { savedFormations: newSaved }, { merge: true });
  };

  const renameSavedFormation = async (oldName, newName) => {
    if (!user || !activeClubId || !newName.trim() || oldName === newName.trim()) return;
    const trimmed = newName.trim();
    const newSaved = savedFormations.map((f) => (f.name === oldName ? { ...f, name: trimmed } : f));
    setSavedFormationsBoth(newSaved);
    const renamingActive = activeTacticName === oldName;
    if (renamingActive) setActiveTacticName(trimmed);
    await setDoc(tacticsDoc(user.uid, activeClubId), { savedFormations: newSaved, ...(renamingActive ? { activeTacticName: trimmed } : {}) }, { merge: true });
  };

  const confirmDeleteFormation = async () => {
    if (!user || !activeClubId || !formationToDelete) return;
    const newSaved = savedFormations.filter((f) => f.name !== formationToDelete);
    setSavedFormationsBoth(newSaved);
    const clearingActive = formationToDelete === activeTacticName;
    if (clearingActive) setActiveTacticName(null);
    await setDoc(tacticsDoc(user.uid, activeClubId), { savedFormations: newSaved, ...(clearingActive ? { activeTacticName: null } : {}) }, { merge: true });
    setFormationToDelete(null);
  };

  const loadSavedFormation = (f) => {
    setFormation(f.formation); setLineup(f.lineup); setBench(f.bench || {}); setActiveTacticName(f.name);
    saveTactics(f.formation, f.lineup, f.bench || {}, f.name);
  };

  const setPlayerTransferStatus = async (playerId, status) => {
    if (status !== 'Activo') {
      const player = players.find((p) => p.id === playerId);
      if (player?.type === 'Cedido') return;
    }
    await updateDoc(playerDoc(user.uid, activeClubId, playerId), { transferStatus: status });
    if (status === 'CedidoFuera') removePlayerFromTactic(playerId);
  };

  const updateYouthRating = async (player, newRating) => {
    if (!user || !activeClubId) return;
    const newHistory = [...(player.evolutionHistory || []), { date: Date.now(), rating: player.rating }];
    await updateDoc(playerDoc(user.uid, activeClubId, player.id), { rating: newRating, evolutionHistory: newHistory });
  };

  const value = {
    players, playersLoaded, formation, lineup, bench, savedFormations, activeTacticName, transactions, shortlist, matches, seasons,
    playerToDelete, setPlayerToDelete, formationToDelete, setFormationToDelete,
    scoutToDelete, setScoutToDelete,
    addOrUpdatePlayer, confirmDeletePlayer, removePlayerFromTactic, sellPlayer, cedePlayer,
    saveTactics, clearTactics, clearLineup, clearBench, handleFormationChange, executeMove, assignPlayerToSlot,
    saveCurrentFormation, updateActiveTactic, confirmDeleteFormation, renameSavedFormation, loadSavedFormation, setPlayerTransferStatus,
    addOrUpdateScout, confirmDeleteScout, deleteScout, updateYouthRating, saveMatch, endSeason,
  };

  return <ClubDataContext.Provider value={value}>{children}</ClubDataContext.Provider>;
}

export const useClubData = () => useContext(ClubDataContext);
