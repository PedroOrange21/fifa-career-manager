// Sistema global anti-duplicados por IA: usado por cualquier sección con escaneo (Onboarding,
// Plantilla, Academia) para evitar dar de alta dos veces al mismo jugador — ya sea porque ya
// existe en la base de datos, o porque la propia cola de un escaneo múltiple incluye la misma
// tarjeta fotografiada más de una vez. Compara nombre (normalizado, sin acentos ni mayúsculas),
// edad y posición principal: si los tres coinciden con alguien ya existente, se considera
// duplicado.

// Quita acentos/diacríticos y normaliza mayúsculas/espacios, para que "José López" y "jose
// LOPEZ " se reconozcan como el mismo nombre. El rango ̀-ͯ son las marcas
// diacríticas combinantes que separa normalize('NFD') (acentos, tildes, diéresis...).
export const normalizePlayerName = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ');

const primaryPositionOf = (p) => (p?.positions?.[0] || p?.primaryPosition || '').toUpperCase();

// candidate: objeto "prefill" (name, age, positions/primaryPosition). existingList: jugadores
// ya guardados y/o el resto de la cola actual, en el mismo formato. Nombre y posición deben
// coincidir siempre; la edad solo descarta el duplicado si AMBOS lados la tienen y no
// coinciden (evita falsos negativos cuando a alguno le falta ese dato).
export function findDuplicatePlayer(candidate, existingList) {
  const name = normalizePlayerName(candidate?.name);
  if (!name) return null;
  const age = candidate?.age ? parseInt(candidate.age, 10) : null;
  const position = primaryPositionOf(candidate);

  return (existingList || []).find((p) => {
    if (normalizePlayerName(p?.name) !== name) return false;
    const pAge = p?.age != null && p.age !== '' ? parseInt(p.age, 10) : null;
    if (age != null && pAge != null && age !== pAge) return false;
    const pPosition = primaryPositionOf(p);
    if (position && pPosition && position !== pPosition) return false;
    return true;
  }) || null;
}
