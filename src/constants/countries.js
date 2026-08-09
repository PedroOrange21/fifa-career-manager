// Lista de nacionalidades habituales en fútbol, con su código ISO 3166-1 alpha-2 para
// generar la bandera como emoji (sin depender de imágenes externas ni conexión a internet).
// Inglaterra/Escocia/Gales usan la secuencia Unicode de "tag" de sus banderas de nación
// constituyente en vez de un código de país real.
const HOME_NATION_FLAGS = {
  'GB-ENG': String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f),
  'GB-SCT': String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f),
  'GB-WLS': String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0077, 0xe006c, 0xe0073, 0xe007f),
};

export const flagEmoji = (code) => {
  if (!code) return '';
  if (HOME_NATION_FLAGS[code]) return HOME_NATION_FLAGS[code];
  return code
    .toUpperCase()
    .split('')
    .map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
    .join('');
};

const DIACRITICS_RE = /[̀-ͯ]/g;
export const normalizeText = (str) =>
  (str || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim();

export const COUNTRIES = [
  { name: 'España', code: 'ES' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Brasil', code: 'BR' },
  { name: 'Francia', code: 'FR' },
  { name: 'Inglaterra', code: 'GB-ENG' },
  { name: 'Escocia', code: 'GB-SCT' },
  { name: 'Gales', code: 'GB-WLS' },
  { name: 'Alemania', code: 'DE' },
  { name: 'Italia', code: 'IT' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Países Bajos', code: 'NL' },
  { name: 'Bélgica', code: 'BE' },
  { name: 'Croacia', code: 'HR' },
  { name: 'Uruguay', code: 'UY' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Chile', code: 'CL' },
  { name: 'México', code: 'MX' },
  { name: 'Estados Unidos', code: 'US' },
  { name: 'Japón', code: 'JP' },
  { name: 'Corea del Sur', code: 'KR' },
  { name: 'Marruecos', code: 'MA' },
  { name: 'Senegal', code: 'SN' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Camerún', code: 'CM' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Egipto', code: 'EG' },
  { name: 'Argelia', code: 'DZ' },
  { name: 'Túnez', code: 'TN' },
  { name: 'Costa de Marfil', code: 'CI' },
  { name: 'Irlanda', code: 'IE' },
  { name: 'Irlanda del Norte', code: 'GB' },
  { name: 'Suiza', code: 'CH' },
  { name: 'Austria', code: 'AT' },
  { name: 'Polonia', code: 'PL' },
  { name: 'Serbia', code: 'RS' },
  { name: 'Dinamarca', code: 'DK' },
  { name: 'Suecia', code: 'SE' },
  { name: 'Noruega', code: 'NO' },
  { name: 'Turquía', code: 'TR' },
  { name: 'Rusia', code: 'RU' },
  { name: 'Ucrania', code: 'UA' },
  { name: 'República Checa', code: 'CZ' },
  { name: 'Rumania', code: 'RO' },
  { name: 'Hungría', code: 'HU' },
  { name: 'Grecia', code: 'GR' },
  { name: 'Australia', code: 'AU' },
  { name: 'Canadá', code: 'CA' },
  { name: 'Ecuador', code: 'EC' },
  { name: 'Perú', code: 'PE' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Bolivia', code: 'BO' },
  { name: 'Venezuela', code: 'VE' },
  { name: 'Costa Rica', code: 'CR' },
  { name: 'Panamá', code: 'PA' },
  { name: 'Jamaica', code: 'JM' },
  { name: 'China', code: 'CN' },
  { name: 'Arabia Saudita', code: 'SA' },
  { name: 'Catar', code: 'QA' },
  { name: 'Irán', code: 'IR' },
  { name: 'Iraq', code: 'IQ' },
  { name: 'India', code: 'IN' },
  { name: 'Nueva Zelanda', code: 'NZ' },
  { name: 'Islandia', code: 'IS' },
  { name: 'Finlandia', code: 'FI' },
  { name: 'Eslovaquia', code: 'SK' },
  { name: 'Eslovenia', code: 'SI' },
  { name: 'Bosnia y Herzegovina', code: 'BA' },
  { name: 'Macedonia del Norte', code: 'MK' },
  { name: 'Montenegro', code: 'ME' },
  { name: 'Albania', code: 'AL' },
  { name: 'Kosovo', code: 'XK' },
  { name: 'Israel', code: 'IL' },
  { name: 'Emiratos Árabes Unidos', code: 'AE' },
  { name: 'Sudáfrica', code: 'ZA' },
  { name: 'República Dem. del Congo', code: 'CD' },
  { name: 'Mali', code: 'ML' },
  { name: 'Burkina Faso', code: 'BF' },
  { name: 'Guinea', code: 'GN' },
  { name: 'Cabo Verde', code: 'CV' },
  { name: 'Gabón', code: 'GA' },
  { name: 'Zambia', code: 'ZM' },
  { name: 'Angola', code: 'AO' },
  { name: 'Mozambique', code: 'MZ' },
  { name: 'Honduras', code: 'HN' },
  { name: 'El Salvador', code: 'SV' },
  { name: 'Guatemala', code: 'GT' },
  { name: 'Cuba', code: 'CU' },
  { name: 'República Dominicana', code: 'DO' },
  { name: 'Haití', code: 'HT' },
  { name: 'Trinidad y Tobago', code: 'TT' },
];

export const findCountryByName = (name) => {
  const target = normalizeText(name);
  if (!target) return null;
  return COUNTRIES.find((c) => normalizeText(c.name) === target) || null;
};

export const searchCountries = (query, limit = 8) => {
  const target = normalizeText(query);
  if (!target) return [];
  return COUNTRIES.filter((c) => normalizeText(c.name).includes(target)).slice(0, limit);
};
