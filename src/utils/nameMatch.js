// Emparejamiento aproximado de nombres: usado por el escaneo masivo de Estadísticas (ver
// StatsImportReviewModal) para localizar a qué jugador YA EXISTENTE de la plantilla corresponde
// cada foto escaneada — la IA lee el nombre tal como aparece en el juego (a veces abreviado,
// con acentos distintos o mayúsculas/minúsculas distintas a como se guardó al fichar), así que
// una comparación exacta fallaría con demasiada frecuencia. No es una distancia de edición
// completa (Levenshtein): normaliza acentos/mayúsculas y compara por igualdad, contención y
// solapamiento de palabras — suficiente para nombres de futbolistas, mucho más barato de
// calcular sobre una plantilla de unas pocas decenas de jugadores.
// Rango Unicode de marcas diacríticas combinadas (acentos sueltos tras normalize('NFD')),
// construido con RegExp(string) en vez de un literal /.../ para que la secuencia de escape
// ̀-ͯ quede guardada como texto plano en el archivo, nunca como caracteres combinados
// literales que un editor/algún paso de guardado podría transcribir de forma inconsistente.
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

const normalize = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(DIACRITICS_RE, '')
  .replace(/[^a-z0-9\s]/g, '')
  .trim();

const MATCH_THRESHOLD = 40;

export function findBestPlayerMatch(name, players) {
  const target = normalize(name);
  if (!target) return null;
  let best = null;
  let bestScore = 0;
  players.forEach((p) => {
    const candidate = normalize(p.name);
    if (!candidate) return;
    let score = 0;
    if (candidate === target) {
      score = 100;
    } else if (candidate.includes(target) || target.includes(candidate)) {
      score = 70;
    } else {
      const targetTokens = target.split(/\s+/).filter(Boolean);
      const candidateTokens = candidate.split(/\s+/).filter(Boolean);
      const overlap = targetTokens.filter((t) => candidateTokens.includes(t)).length;
      const denom = Math.max(targetTokens.length, candidateTokens.length, 1);
      score = overlap > 0 ? (overlap / denom) * 60 : 0;
    }
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
