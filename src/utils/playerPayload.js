import { parseValue } from './format';

// Traduce un objeto "prefill" (la misma forma que devuelven mapScanResultToPrefill/
// mapAcademyScanResultToPrefill en geminiPlayerScan.js, o cualquier dato equivalente) al
// payload exacto que espera addOrUpdatePlayer — réplica deliberada de la construcción del
// payload en PlayerForm.jsx (handleConfirm), para que un jugador guardado en lote desde
// BulkScanReviewModal quede indistinguible de uno dado de alta ficha a ficha por el asistente
// clásico. Solo se usa para ALTAS nuevas (nunca edición: no hay editingId ni estado previo que
// preservar), así que a diferencia de PlayerForm no necesita distinguir "crear" de "editar".
export function buildPlayerPayload(data) {
  const type = data.type || 'Comprado';
  const isCantera = type === 'Cantera';
  const isCedido = type === 'Cedido';
  return {
    name: (data.name || '').trim(),
    positions: data.positions || [],
    rating: parseInt(data.rating, 10) || 0,
    age: data.age ? parseInt(data.age, 10) : null,
    preferredFoot: data.preferredFoot || 'Diestro',
    photo: null,
    nationality: (data.nationality || '').trim() || null,
    marketValue: isCantera ? 0 : parseValue(String(data.marketValue || '')),
    type,
    value: type === 'Comprado' ? parseValue(String(data.value || '')) : 0,
    loanDuration: isCedido ? (data.loanDuration || '1 Temporada') : null,
    originClub: isCedido ? ((data.originClub || '').trim() || null) : null,
    sourceClub: !isCantera && (data.sourceClub || '').trim() ? data.sourceClub.trim() : null,
    agreedRole: !isCantera && data.agreedRole ? data.agreedRole : null,
    buyOption: null,
    wagePercentage: isCedido && data.wagePercentage != null ? parseInt(data.wagePercentage, 10) : null,
    transferStatus: 'Activo',
    outboundLoan: null,
    isInitialSquad: !!data.isInitialSquad,
    wage: isCantera ? 0 : parseValue(String(data.wage || '')),
    releaseClause: type === 'Comprado' ? (parseValue(String(data.releaseClause || '')) || null) : null,
    contractYears: type === 'Comprado' && data.contractYears ? parseInt(data.contractYears, 10) : null,
    // Igual que en PlayerForm: se guarda como texto (no parseInt) para conservar rangos como
    // "64-88" tal cual; parsePotentialRange() lo normaliza donde haga falta un número.
    potential: isCantera && data.potential ? String(data.potential).trim() : null,
  };
}
