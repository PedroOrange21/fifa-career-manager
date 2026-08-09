import { writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { clubDoc, playerDoc, shortlistDoc } from './firestorePaths';

export const TEST_CLUB_NAME = 'Equipo de Prueba';

// Escudo de prueba generado en local (SVG embebido) para no depender de ninguna URL externa.
const TEST_CLUB_LOGO = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#0a0a0b"/>
    </linearGradient>
  </defs>
  <path d="M50 4 L92 18 V50 C92 76 74 92 50 98 C26 92 8 76 8 50 V18 Z" fill="url(#g)" stroke="#ffffff" stroke-width="3"/>
  <text x="50" y="62" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">EP</text>
</svg>
`)}`;

const player = (overrides) => ({
  age: 24,
  preferredFoot: 'Diestro',
  type: 'Comprado',
  value: 0,
  loanDuration: null,
  originClub: null,
  transferStatus: 'Activo',
  wage: 0,
  potential: null,
  ...overrides,
});

const TEST_PLAYERS = [
  // --- Oro (media >= 75) ---
  player({ name: 'Iker Muralla', positions: ['POR'], rating: 84, age: 31, marketValue: 14000000, type: 'Comprado', value: 12000000, wage: 3000000 }),
  player({ name: 'Marco Ferreira', positions: ['DFC'], rating: 80, age: 27, marketValue: 46000000, type: 'Comprado', value: 42000000, wage: 5500000 }),
  player({ name: 'Lucas Lateral', positions: ['LD'], rating: 76, age: 25, marketValue: 26000000, type: 'Comprado', value: 24000000, wage: 3800000 }),
  player({ name: 'Bruno Izquierdo', positions: ['LI'], rating: 79, age: 28, marketValue: 30000000, type: 'Cedido', loanDuration: '1 Temporada', originClub: 'Real Madrid', wage: 4500000 }),
  player({ name: 'Sergio Pivote', positions: ['MCD'], rating: 81, age: 26, marketValue: 39000000, type: 'Comprado', value: 36000000, wage: 4200000 }),
  player({ name: 'Mediapunta Clase', positions: ['MCO'], rating: 77, age: 29, marketValue: 9000000, type: 'Comprado', value: 8000000, wage: 2200000, transferStatus: 'Cedible' }),
  player({ name: 'Rayo Extremo', positions: ['ED'], rating: 85, age: 23, marketValue: 62000000, type: 'Comprado', value: 58000000, wage: 6200000 }),
  player({ name: 'Máximo Killer', positions: ['DC'], rating: 89, age: 27, marketValue: 100000000, type: 'Comprado', value: 95000000, wage: 9000000 }),

  // --- Plata (media 65-74) ---
  player({ name: 'Sub Portero', positions: ['POR'], rating: 66, age: 20, marketValue: 3000000, type: 'Cantera', potential: 78, wage: 500000 }),
  player({ name: 'Diego Cantera', positions: ['DFC'], rating: 68, age: 19, marketValue: 4000000, type: 'Cantera', potential: 86, wage: 450000 }),
  player({ name: 'Andrés Motor', positions: ['MC'], rating: 74, age: 24, marketValue: 20000000, type: 'Comprado', value: 19000000, wage: 2900000 }),
  player({ name: 'Extremo Cedido Fuera', positions: ['EI'], rating: 71, age: 20, marketValue: 9000000, type: 'Cantera', potential: 82, loanDuration: '6 Meses', wage: 700000, transferStatus: 'CedidoFuera' }),
  player({ name: 'Segundo Punta Cedido', positions: ['SD'], rating: 72, age: 22, marketValue: 11000000, type: 'Cedido', loanDuration: '2 Temporadas', originClub: 'Atlético de Madrid', wage: 1800000 }),

  // --- Bronce (media <= 64) ---
  player({ name: 'Central Veterano', positions: ['DFC'], rating: 63, age: 35, marketValue: 1800000, type: 'Comprado', value: 1500000, wage: 900000, transferStatus: 'Transferible' }),
  player({ name: 'Canterano Manu', positions: ['MC'], rating: 60, age: 17, marketValue: 1200000, type: 'Cantera', potential: 85, wage: 200000 }),
  player({ name: 'Delantero Reserva', positions: ['DC'], rating: 61, age: 32, marketValue: 2200000, type: 'Comprado', value: 2000000, wage: 1100000, transferStatus: 'Transferible' }),
  player({ name: 'Lateral Promesa', positions: ['LD'], rating: 58, age: 16, marketValue: 900000, type: 'Cantera', potential: 80, wage: 150000 }),
];

const scout = (overrides) => ({
  age: 22,
  rating: null,
  potential: null,
  originClub: null,
  estimatedValue: 0,
  notes: '',
  priority: 'Media',
  ...overrides,
});

const TEST_SHORTLIST = [
  scout({ name: 'Kai Talento', positions: ['ED'], position: 'ED', age: 22, rating: 79, potential: 87, originClub: 'Ajax', estimatedValue: 35000000, notes: 'Extremo rápido, muy buen regate al espacio.', priority: 'Alta' }),
  scout({ name: 'Big Center', positions: ['DFC', 'MCD'], position: 'DFC', age: 25, rating: 76, potential: 80, originClub: 'Benfica', estimatedValue: 18000000, notes: 'Central polivalente, buena salida de balón.', priority: 'Media' }),
];

/**
 * Crea (si no existe ya) el club "Equipo de Prueba" con una plantilla completa y variada,
 * más un par de fichas en la libreta de ojeadores, para poder probar de un vistazo todas
 * las funciones de la aplicación. Devuelve el id del club (nuevo o ya existente).
 */
export async function seedTestClub(uid, existingClubs = []) {
  const existing = existingClubs.find((c) => c.name === TEST_CLUB_NAME);
  if (existing) return existing.id;

  const clubId = crypto.randomUUID();
  const batch = writeBatch(db);

  batch.set(clubDoc(uid, clubId), {
    name: TEST_CLUB_NAME,
    logo: TEST_CLUB_LOGO,
    createdAt: Date.now(),
    transferBudget: 50000000,
    currentSeasonNumber: 1,
  });

  TEST_PLAYERS.forEach((p) => {
    batch.set(playerDoc(uid, clubId, crypto.randomUUID()), p);
  });

  TEST_SHORTLIST.forEach((s) => {
    batch.set(shortlistDoc(uid, clubId, crypto.randomUUID()), { ...s, createdAt: Date.now() });
  });

  await batch.commit();
  return clubId;
}
