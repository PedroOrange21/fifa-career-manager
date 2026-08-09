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

export const formatLoanDuration = (duration) => {
  if (duration === '1 Temporada') return '1T';
  if (duration === '2 Temporadas') return '2T';
  if (duration === '6 Meses') return '6M';
  return duration;
};
