import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onSnapshot, setDoc, addDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { playersCol, playerDoc, tacticsDoc, transactionsCol, targetsCol, targetDoc, matchesCol, seasonsCol, clubDoc } from '../utils/firestorePaths';
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
  const [targets, setTargets] = useState([]);
  // Igual que playersLoaded: distingue "todavía no llegó el primer snapshot de objetivos" de
  // "ya llegó y la lista está realmente vacía", necesario para que la migración de sueldos
  // (ver más abajo) no dé por migrados los objetivos antes de haber recibido sus datos reales.
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [matches, setMatches] = useState([]);
  const [seasons, setSeasons] = useState([]);

  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [formationToDelete, setFormationToDelete] = useState(null);
  const [targetToDelete, setTargetToDelete] = useState(null);

  // Ventana de "Deshacer" genérica, reutilizada por cualquier acción crítica/irreversible
  // (eliminar jugador, finalizar cesión, vender jugador, eliminar objetivo de Mercado):
  // { kind: 'player'|'target', id, label, deadline, timer, finalize } o null. El elemento se
  // oculta de "players"/"targets" (expuestos más abajo) desde el instante de la confirmación,
  // pero la escritura real en Firestore no ocurre hasta que expira el temporizador sin que se
  // pulse "Deshacer". pendingUndoRef espeja el estado para que el setTimeout (closure fijado
  // en el momento de crearse) siempre pueda comprobar/limpiar la entrada vigente, sin depender
  // de un valor de "pendingUndo" potencialmente obsoleto capturado en su propio closure. Solo
  // se admite una acción pendiente a la vez: iniciar una nueva consolida inmediatamente
  // cualquier otra que estuviera esperando.
  const [pendingUndo, setPendingUndo] = useState(null);
  const pendingUndoRef = useRef(null);
  const UNDO_WINDOW_MS = 5500;

  // Guarda de la migración de sueldos a semanal (ver efecto más abajo): evita que se dispare
  // más de una vez por club dentro de la misma sesión mientras la migración asíncrona está en
  // curso (los propios updateDoc de la migración hacen que players/targets cambien y el efecto
  // se reevalúe, pero no debe volver a lanzar el proceso).
  const wageMigrationClubIdRef = useRef(null);

  // "onCancel" (opcional, quinto argumento): a diferencia de eliminar un jugador/objetivo
  // (donde el elemento sigue intacto en Firestore hasta que expira la ventana, así que
  // "Deshacer" no tiene que restaurar nada más que dejar de ocultarlo), vaciar el Once/
  // Banquillo muta el estado local de inmediato (setLineup({})/setBench({})) para que la
  // pizarra se vea vacía al instante. "onCancel" deshace exactamente esa mutación local si se
  // pulsa "Deshacer" antes de que expire la ventana.
  const scheduleUndo = (kind, id, label, finalize, onCancel) => {
    if (pendingUndoRef.current) {
      clearTimeout(pendingUndoRef.current.timer);
      pendingUndoRef.current.finalize();
    }
    const timer = setTimeout(() => {
      pendingUndoRef.current = null;
      setPendingUndo(null);
      finalize();
    }, UNDO_WINDOW_MS);
    const entry = { kind, id, label, deadline: Date.now() + UNDO_WINDOW_MS, timer, finalize, onCancel };
    pendingUndoRef.current = entry;
    setPendingUndo(entry);
  };

  const cancelPendingUndo = () => {
    const entry = pendingUndoRef.current;
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingUndoRef.current = null;
    setPendingUndo(null);
    entry.onCancel?.();
  };

  useEffect(() => {
    // Un cambio de club/usuario a media espera de "Deshacer" consolida de inmediato la acción
    // pendiente (con el uid/club capturados en su momento, no los nuevos) en vez de perderla
    // en silencio o dejarla disparar más tarde contra el club equivocado. Se comprueba antes
    // que nada, incluido el cierre de sesión.
    if (pendingUndoRef.current) {
      clearTimeout(pendingUndoRef.current.timer);
      pendingUndoRef.current.finalize();
      pendingUndoRef.current = null;
      setPendingUndo(null);
    }

    if (!user || !activeClubId) {
      setPlayers([]);
      setPlayersLoaded(false);
      setLineup({});
      setBench({});
      setTransactions([]);
      setTargets([]);
      setTargetsLoaded(false);
      setMatches([]);
      setSeasons([]);
      return;
    }

    setPlayers([]); setPlayersLoaded(false); setFormation('4-3-3'); setLineup({}); setBench({}); setSavedFormationsBoth([]); setActiveTacticName(null);
    setTransactions([]); setTargets([]); setTargetsLoaded(false); setMatches([]); setSeasons([]);

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

    const unsubTargets = onSnapshot(targetsCol(user.uid, activeClubId), (snap) => {
      setTargets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTargetsLoaded(true);
    }, (err) => console.error('Error fetching targets:', err));

    const unsubMatches = onSnapshot(matchesCol(user.uid, activeClubId), (snap) => {
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date));
    }, (err) => console.error('Error fetching matches:', err));

    const unsubSeasons = onSnapshot(seasonsCol(user.uid, activeClubId), (snap) => {
      setSeasons(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.seasonNumber - a.seasonNumber));
    }, (err) => console.error('Error fetching seasons:', err));

    return () => { unsubPlayers(); unsubTactics(); unsubTransactions(); unsubTargets(); unsubMatches(); unsubSeasons(); };
  }, [user, activeClubId]);

  // Migración única de sueldos (mensual -> semanal): p.wage/t.wage se guardaban en mensual en
  // toda la app hasta el cambio que introdujo el sueldo semanal como unidad canónica (ver
  // utils/format.js). Los clubes creados ANTES de ese cambio se quedaron con importes
  // mensuales ya guardados en Firestore bajo el mismo campo "wage" — al leerlos ahora como si
  // ya fueran semanales, la Masa Salarial (Finanzas) y el Planificador de Fichajes (Objetivos)
  // inflan la cifra real (un sueldo mensual de 3.000.000 € se mostraba como 3.000.000 €/sem en
  // vez de convertirse a ~692.000 €/sem). Este efecto detecta un club sin la marca
  // "wageMigrationV1" (los clubes nuevos ya la traen puesta desde ClubsContext.createClub, así
  // que nunca pasan por aquí) y convierte una única vez cada wage existente multiplicándolo
  // por 12/52, dejando marcado el club para no repetir la conversión en sesiones futuras.
  useEffect(() => {
    if (!user || !activeClubId || !activeClub || activeClub.wageMigrationV1) return;
    if (!playersLoaded || !targetsLoaded) return;
    if (wageMigrationClubIdRef.current === activeClubId) return;
    wageMigrationClubIdRef.current = activeClubId;
    const uid = user.uid;
    const clubId = activeClubId;
    (async () => {
      try {
        await Promise.all([
          ...players.filter((p) => p.wage > 0).map((p) => updateDoc(playerDoc(uid, clubId, p.id), { wage: Math.round(p.wage * 12 / 52) })),
          ...targets.filter((t) => t.wage > 0).map((t) => updateDoc(targetDoc(uid, clubId, t.id), { wage: Math.round(t.wage * 12 / 52) })),
        ]);
        await setDoc(clubDoc(uid, clubId), { wageMigrationV1: true }, { merge: true });
      } catch (err) {
        console.error('Error migrando sueldos a semanal:', err);
        // Permite reintentar en un efecto posterior (p. ej. tras recuperar conexión) en vez de
        // dejar el club atascado sin la marca para siempre dentro de la misma sesión.
        if (wageMigrationClubIdRef.current === clubId) wageMigrationClubIdRef.current = null;
      }
    })();
  }, [user, activeClubId, activeClub, playersLoaded, targetsLoaded, players, targets]);

  // club: opcional — solo se conoce para las cesiones (destinationClub). Las compras/ventas no
  // registran un club "contrario" en el modelo de datos actual, así que ese campo queda vacío
  // y la vista de Operaciones lo omite con gracia en vez de inventar un dato inexistente.
  // extra: campos adicionales opcionales (p. ej. en una venta, el importe total del traspaso y
  // lo retenido por la directiva) — "amount" sigue siendo siempre el impacto real en el
  // presupuesto de fichajes, para que las estadísticas financieras que suman "amount" reflejen
  // dinero realmente disponible, no el total bruto acordado.
  // seasonNumber: temporada en curso en el momento del movimiento, para poder agrupar el
  // historial por temporadas (en vez de por mes) en Estadísticas Financieras.
  const logTransaction = async (type, playerName, amount, club = null, extra = null) => {
    if (!user || !activeClubId) return;
    await addDoc(transactionsCol(user.uid, activeClubId), { type, playerName, amount, club, date: Date.now(), seasonNumber: activeClub?.currentSeasonNumber || 1, ...(extra || {}) });
  };

  // Lista de Seguimiento / Objetivos de Mercado (pestaña "Objetivos" de Mercado): jugadores
  // externos a seguir, con foto, club actual, posiciones, pierna buena, valor/sueldo estimado
  // y estado (Seguimiento/Negociando/Prioritario/Descartado).
  const addOrUpdateTarget = async (targetData, editingId) => {
    if (!user || !activeClubId) return;
    const id = editingId || crypto.randomUUID();
    await setDoc(targetDoc(user.uid, activeClubId, id), { ...targetData, createdAt: targetData.createdAt || Date.now() }, { merge: true });
    return id;
  };

  const deleteTarget = async (targetId) => {
    if (!user || !activeClubId || !targetId) return;
    try { await deleteDoc(targetDoc(user.uid, activeClubId, targetId)); } catch (err) { console.error(err); }
  };

  // "Eliminar Objetivo" también pasa por la ventana de "Deshacer": el objetivo desaparece de
  // "targets" (ver filtro en el value expuesto más abajo) desde ya, pero el borrado real no se
  // ejecuta hasta que expira la espera sin cancelarse.
  const confirmDeleteTarget = () => {
    if (!user || !activeClubId || !targetToDelete) return;
    const target = targets.find((t) => t.id === targetToDelete);
    const id = targetToDelete;
    setTargetToDelete(null);
    if (!target) return;
    const uid = user.uid;
    const clubId = activeClubId;
    scheduleUndo('target', id, `Objetivo ${target.name} eliminado`, async () => {
      try { await deleteDoc(targetDoc(uid, clubId, id)); } catch (err) { console.error(err); }
    });
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

  // Sobrescribe (nunca suma) las estadísticas de temporada indicadas: a diferencia de saveMatch
  // (que va SUMANDO goles/asistencias partido a partido según se juegan dentro de la app), un
  // escaneo de la pantalla "Centro de Plantilla > Estadísticas" del propio juego ya trae los
  // TOTALES reales de la temporada — reemplazarlos es lo correcto, acumularlos duplicaría todo
  // lo que ya se hubiera registrado a mano vía el módulo de Partido. "rating" es opcional: solo
  // se manda cuando el escaneo también trae la media/OVR final actualizada del jugador.
  const updatePlayerStats = async (playerId, patch) => {
    if (!user || !activeClubId || !playerId || !patch) return;
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    const { rating, ...statsPatch } = patch;
    const updates = { seasonStats: { ...(player.seasonStats || {}), ...statsPatch } };
    if (rating != null && rating > 0) updates.rating = rating;
    await updateDoc(playerDoc(user.uid, activeClubId, playerId), updates);
  };

  // Resolución de una cesión ENTRANTE (jugador type 'Cedido' que juega para nosotros pero es
  // propiedad de otro club) al terminar la temporada — Paso 3 del Asistente de Fin de
  // Temporada: 'buy' ejecuta la opción de compra pactada (o el valor de mercado si no se fijó
  // ninguna) y el jugador pasa a ser nuestro ("Comprado" de verdad, con año de contrato por
  // defecto si no se conocía ninguno); 'return' es exactamente "Finalizar Cesión" (ver
  // startEndLoan más abajo), el jugador vuelve a su club de origen.
  const resolveIncomingLoan = async (player, decision) => {
    if (!user || !activeClubId || !player || player.type !== 'Cedido') return;
    if (decision === 'return') { startEndLoan(player); return; }
    const price = player.buyOption || player.marketValue || 0;
    await updateDoc(playerDoc(user.uid, activeClubId, player.id), {
      type: 'Comprado',
      value: price,
      sourceClub: player.originClub || player.sourceClub || null,
      originClub: null,
      loanDuration: null,
      wagePercentage: null,
      buyOption: null,
      contractYears: player.contractYears || 3,
    });
    if (price) adjustBudget(-price);
    logTransaction('compra', player.name, price, null, { fromLoan: true, originClub: player.originClub || null });
  };

  const renewContract = async (playerId, extraYears = 2) => {
    if (!user || !activeClubId || !playerId) return;
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    await updateDoc(playerDoc(user.uid, activeClubId, playerId), { contractYears: (player.contractYears || 0) + extraYears });
  };

  // titles/leaguePosition/prizeMoney: Balance y Palmarés del Paso 1 del Asistente de Fin de
  // Temporada — puramente informativos en el snapshot salvo prizeMoney, que sí suma al
  // presupuesto de traspasos real. Cada jugador se lleva además una entrada nueva en su propio
  // careerHistory (crecimiento de OVR y valor de mercado respecto a como empezó la temporada,
  // ver seasonStartRating/seasonStartMarketValue) y avanza un año de vida real: +1 edad, -1 año
  // de contrato (nunca por debajo de 0), estadísticas de temporada a 0 y una nueva foto de
  // partida (seasonStartRating/seasonStartMarketValue) para la temporada que empieza ahora.
  const endSeason = async ({ titles = [], leaguePosition = null, prizeMoney = 0 } = {}) => {
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

    if (prizeMoney) adjustBudget(prizeMoney);

    await addDoc(seasonsCol(user.uid, activeClubId), {
      seasonNumber,
      startedAt: previousSeason?.endedAt || activeClub.createdAt || null,
      endedAt: Date.now(),
      budgetEnd: (activeClub.transferBudget || 0) + (prizeMoney || 0),
      squadSnapshot: players.map((p) => ({ playerId: p.id, name: p.name, rating: p.rating, position: p.positions?.[0] || null })),
      topScorers,
      matchesPlayed: seasonMatches.length,
      wins, draws, losses, goalsFor, goalsAgainst,
      titles, leaguePosition, prizeMoney,
    });

    await Promise.all(players.map((p) => {
      const stats = p.seasonStats || {};
      const careerEntry = {
        seasonId: seasonNumber,
        seasonNumber,
        initialOvr: p.seasonStartRating ?? p.rating,
        finalOvr: p.rating,
        ovrGrowth: p.rating - (p.seasonStartRating ?? p.rating),
        matchesPlayed: stats.matchesPlayed || 0,
        goals: stats.goals || 0,
        assists: stats.assists || 0,
        averageRating: stats.averageRating || 0,
        marketValueEnd: p.marketValue || 0,
      };
      return updateDoc(playerDoc(user.uid, activeClubId, p.id), {
        age: (p.age || 0) + 1,
        contractYears: p.contractYears != null ? Math.max(0, p.contractYears - 1) : null,
        seasonStats: { matchesPlayed: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0, competitionBreakdown: null },
        seasonStartRating: p.rating,
        seasonStartMarketValue: p.marketValue || 0,
        careerHistory: [...(p.careerHistory || []), careerEntry],
      });
    }));

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
    if (!editingId && !skipFinancialEffects) {
      // Instantánea de contexto (procedencia, rol pactado, posición/media al fichar) guardada
      // en la propia transacción, para que el desglose del historial siga siendo consultable
      // más adelante aunque el jugador cambie de datos o abandone el club.
      const snapshot = {
        sourceClub: playerData.sourceClub || null,
        agreedRole: playerData.agreedRole || null,
        position: playerData.positions?.[0] || null,
        rating: playerData.rating ?? null,
      };
      if (playerData.type === 'Comprado' && playerData.value > 0) {
        adjustBudget(-playerData.value);
        logTransaction('compra', playerData.name, playerData.value, null, { ...snapshot, wageMonthly: playerData.wage || 0 });
      } else if (playerData.type === 'Cedido') {
        // Una cesión entrante no tiene coste de traspaso en este modelo (no se descuenta
        // presupuesto), pero sí un impacto salarial recurrente: el % que asumimos del sueldo
        // total del jugador, ya calculado igual que en la propia ficha de detalle.
        const wageMonthly = Math.round((playerData.wage || 0) * ((playerData.wagePercentage || 0) / 100));
        logTransaction('cesion_entrante', playerData.name, 0, playerData.originClub || null, { ...snapshot, wageMonthly });
      }
    }
    return id;
  };

  // Borrado diferido de un jugador con ventana de "Deshacer": uid/clubId quedan fijados en el
  // propio cierre del temporizador (no se leen de closures externos en el momento de
  // disparar), para que el borrado siga apuntando al club correcto aunque el usuario haya
  // cambiado de club mientras tanto (ver limpieza en el useEffect de reinicio). "onFinalize"
  // es opcional, para efectos adicionales exclusivos de una acción concreta (venta: acreditar
  // el importe y registrar la transacción).
  const deferPlayerRemoval = (player, label, onFinalize) => {
    if (!user || !activeClubId || !player) return;
    const uid = user.uid;
    const clubId = activeClubId;
    scheduleUndo('player', player.id, label, async () => {
      try {
        await deleteDoc(playerDoc(uid, clubId, player.id));
        if (clubId === activeClubId) removePlayerFromTactic(player.id);
        if (onFinalize) await onFinalize(uid, clubId);
      } catch (err) { console.error(err); }
    });
  };

  // allocationPercent: porcentaje del traspaso que la directiva libera de inmediato al
  // presupuesto de fichajes (por defecto 80%); el resto queda "retenido" por la directiva —
  // simplemente no se suma al presupuesto disponible, modelando fondos del club que no van a
  // reinversión inmediata en el mercado. explicitBudgetAmount: cuando el modal permite fijar
  // directamente la cifra disponible en euros (en vez de un %), se pasa aquí ya calculada para
  // que el presupuesto final cuadre exacto con lo introducido, sin el redondeo que introduciría
  // recalcularlo a partir de allocationPercent.
  const sellPlayer = (player, salePrice, allocationPercent = 80, explicitBudgetAmount = null) => {
    if (!player || player.type === 'Cedido') return;
    const budgetAmount = explicitBudgetAmount != null
      ? Math.max(0, Math.min(salePrice, explicitBudgetAmount))
      : Math.round(salePrice * (allocationPercent / 100));
    const retainedAmount = salePrice - budgetAmount;
    const effectivePercent = salePrice > 0 ? Math.round((budgetAmount / salePrice) * 100) : allocationPercent;
    // Rentabilidad respecto al coste de fichaje original: un canterano promovido (marcado con
    // "fromAcademy" al subirlo al primer equipo, ver PromoteToFirstTeamModal) nunca tuvo precio
    // de compra, así que el 100% del traspaso cuenta como beneficio.
    const originalCost = player.fromAcademy ? 0 : (player.value || 0);
    const netProfit = salePrice - originalCost;
    deferPlayerRemoval(player, `Jugador ${player.name} vendido`, async () => {
      adjustBudget(budgetAmount);
      logTransaction('venta', player.name, budgetAmount, null, {
        totalAmount: salePrice, retainedAmount, allocationPercent: effectivePercent, wageFreed: player.wage || 0, originalCost, netProfit,
        // Instantánea de posición/media al momento de la venta, para poder listar el jugador
        // en el desglose de la tarjeta de Beneficio por Traspasos aunque ya no esté en la
        // plantilla.
        position: player.positions?.[0] || null, rating: player.rating ?? null,
      });
    });
  };

  const cedePlayer = async (player, { destinationClub, duration, wagePercentage, buyOption = null }) => {
    if (!user || !activeClubId || !player || player.type === 'Cedido') return;
    await updateDoc(playerDoc(user.uid, activeClubId, player.id), {
      transferStatus: 'CedidoFuera',
      outboundLoan: { destinationClub, duration, wagePercentage, buyOption: buyOption || null },
    });
    removePlayerFromTactic(player.id);
    const wageSaved = Math.round((player.wage || 0) * (1 - wagePercentage / 100));
    // Se guarda una instantánea de las condiciones pactadas (duración, % asumido, cláusula de
    // compra) directamente en la transacción, para que el desglose del historial siga siendo
    // consultable aunque el jugador ya haya vuelto o se haya vendido después.
    logTransaction('cesion', player.name, wageSaved, destinationClub || null, { duration, wagePercentage, buyOption: buyOption || null, wageTotal: player.wage || 0 });
  };

  // Finalizar una cesión ENTRANTE (jugador tipo 'Cedido' que llega a nuestro club): mismo
  // borrado diferido, con su propia etiqueta para el toast.
  const startEndLoan = (player) => deferPlayerRemoval(player, `Cesión de ${player.name} finalizada`);

  const removePlayerFromTactic = (playerId) => {
    const newLineup = { ...lineup }; const newBench = { ...bench }; let changed = false;
    Object.keys(newLineup).forEach((slot) => { if (newLineup[slot] === playerId) { delete newLineup[slot]; changed = true; } });
    Object.keys(newBench).forEach((slot) => { if (newBench[slot] === playerId) { delete newBench[slot]; changed = true; } });
    if (changed) { setLineup(newLineup); setBench(newBench); saveTactics(formation, newLineup, newBench); }
  };

  // Ruta compartida por "Eliminar Jugador" (Plantilla/Academia) Y "Finalizar Cesión" desde la
  // Ficha del Jugador (PlayerInfoModal, que reutiliza este mismo flujo): la etiqueta del toast
  // se decide sola según el tipo del jugador, sin que cada punto de entrada tenga que saberlo.
  const confirmDeletePlayer = () => {
    if (!playerToDelete) return;
    const player = players.find((p) => p.id === playerToDelete);
    setPlayerToDelete(null);
    if (!player) return;
    deferPlayerRemoval(player, player.type === 'Cedido' ? `Cesión de ${player.name} finalizada` : `Jugador ${player.name} eliminado`);
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

  // Vaciar Once/Banquillo con ventana de "Deshacer" (mismo UndoToast que eliminar jugador): la
  // pizarra se ve vacía al instante, pero el guardado real en Firestore se retrasa hasta que
  // expira la ventana sin que se pulse "Deshacer" — en cuyo caso "onCancel" restaura la
  // alineación/suplentes previos tal cual estaban, sin haber tocado Firestore en ningún momento.
  const clearLineup = () => {
    if (!user || !activeClubId) return;
    const prevLineup = lineup;
    const prevTacticName = activeTacticName;
    setLineup({}); setActiveTacticName(null);
    scheduleUndo(
      'lineup-clear', 'lineup', 'Once inicial vaciado',
      async () => { await saveTactics(formation, {}, bench, null); },
      () => { setLineup(prevLineup); setActiveTacticName(prevTacticName); },
    );
  };

  const clearBench = () => {
    if (!user || !activeClubId) return;
    const prevBench = bench;
    const prevTacticName = activeTacticName;
    setBench({}); setActiveTacticName(null);
    scheduleUndo(
      'bench-clear', 'bench', 'Banquillo vaciado',
      async () => { await saveTactics(formation, lineup, {}, null); },
      () => { setBench(prevBench); setActiveTacticName(prevTacticName); },
    );
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
    await updateDoc(playerDoc(user.uid, activeClubId, player.id), { rating: newRating });
  };

  // Mientras hay una acción pendiente de consolidar (ventana de "Deshacer"), el jugador u
  // objetivo implicado se oculta de "players"/"targets" en todas partes (Plantilla, Táctica,
  // Academia, Mercado...) aunque su borrado real en Firestore todavía no se haya ejecutado.
  const visiblePlayers = pendingUndo?.kind === 'player' ? players.filter((p) => p.id !== pendingUndo.id) : players;
  const visibleTargets = pendingUndo?.kind === 'target' ? targets.filter((t) => t.id !== pendingUndo.id) : targets;

  const value = {
    players: visiblePlayers, playersLoaded, formation, lineup, bench, savedFormations, activeTacticName, transactions, targets: visibleTargets, matches, seasons,
    playerToDelete, setPlayerToDelete, formationToDelete, setFormationToDelete,
    targetToDelete, setTargetToDelete,
    pendingUndo, cancelPendingUndo, startEndLoan,
    addOrUpdatePlayer, confirmDeletePlayer, removePlayerFromTactic, sellPlayer, cedePlayer,
    saveTactics, clearTactics, clearLineup, clearBench, handleFormationChange, executeMove, assignPlayerToSlot,
    saveCurrentFormation, updateActiveTactic, confirmDeleteFormation, renameSavedFormation, loadSavedFormation, setPlayerTransferStatus,
    updateYouthRating, saveMatch, endSeason, updatePlayerStats, resolveIncomingLoan, renewContract,
    addOrUpdateTarget, confirmDeleteTarget, deleteTarget,
  };

  return <ClubDataContext.Provider value={value}>{children}</ClubDataContext.Provider>;
}

export const useClubData = () => useContext(ClubDataContext);
