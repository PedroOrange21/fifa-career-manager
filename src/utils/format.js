export const formatValueInput = (val) => {
  if (!val) return '';
  const num = val.replace(/\./g, '').replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('es-ES');
};

export const parseValue = (val) => {
  if (!val) return 0;
  return Number(String(val).replace(/\./g, ''));
};

export const formatCurrency = (val) => {
  const num = parseValue(String(val ?? 0));
  return num.toLocaleString('es-ES') + ' €';
};

export const abbreviateValue = (val) => {
  if (!val) return '0 €';
  const num = parseValue(String(val));
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill €';
  if (num >= 1000) return (num / 1000).toFixed(0) + ' Mil €';
  return val + ' €';
};

export const abbreviateName = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]} ${parts.slice(1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')}`;
};

// El Potencial de un canterano admite tanto un número único ("88") como un rango de texto
// ("64-88"): esta función normaliza cualquiera de los dos formatos (número, string numérico o
// string de rango) devolviendo min/max/display (texto exacto a mostrar) y sortValue (la media
// del rango, o el propio número si no es un rango), usado en listas/filtros/ordenaciones para
// no romperlas con un valor no numérico. Devuelve null si el valor está vacío o no es válido.
export const parsePotentialRange = (potential) => {
  if (potential === null || potential === undefined || potential === '') return null;
  const str = String(potential).trim();
  const rangeMatch = str.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    if (isNaN(min) || isNaN(max)) return null;
    return { min, max, display: `${min}-${max}`, sortValue: Math.round((min + max) / 2) };
  }
  const num = parseInt(str, 10);
  if (isNaN(num)) return null;
  return { min: num, max: num, display: String(num), sortValue: num };
};

export const isValidPotentialInput = (val) => {
  if (!val) return true;
  const parsed = parsePotentialRange(val);
  if (!parsed) return false;
  return parsed.min >= 1 && parsed.max <= 99 && parsed.min <= parsed.max;
};

export const formatLoanDuration = (duration) => {
  if (duration === '1 Temporada') return '1T';
  if (duration === '2 Temporadas') return '2T';
  if (duration === '6 Meses') return '6M';
  return duration;
};
