import { collection, doc } from 'firebase/firestore';
import { db, appId } from '../firebase';

export const clubsCol = (uid) => collection(db, 'artifacts', appId, 'users', uid, 'clubs');
export const clubDoc = (uid, clubId) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId);

export const playersCol = (uid, clubId) => collection(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'players');
export const playerDoc = (uid, clubId, playerId) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'players', playerId);

export const tacticsDoc = (uid, clubId) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'settings', 'tactics');

export const transactionsCol = (uid, clubId) => collection(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'transactions');
export const transactionDoc = (uid, clubId, id) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'transactions', id);

export const shortlistCol = (uid, clubId) => collection(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'shortlist');
export const shortlistDoc = (uid, clubId, id) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'shortlist', id);

export const matchesCol = (uid, clubId) => collection(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'matches');
export const matchDoc = (uid, clubId, id) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'matches', id);

export const seasonsCol = (uid, clubId) => collection(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'seasons');
export const seasonDoc = (uid, clubId, id) => doc(db, 'artifacts', appId, 'users', uid, 'clubs', clubId, 'seasons', id);
