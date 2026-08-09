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

// Normalización "laxa" para el detector de variantes: además de quitar acentos y pasar a
// minúsculas, elimina espacios y puntuación (para que "EE. UU.", "EE.UU." y "eeuu" sean
// la misma clave de búsqueda).
const normalizeLoose = (str) => normalizeText(str).replace(/[^a-z0-9]/g, '');

// aliases: variantes/sinónimos/códigos habituales que el usuario podría escribir y que
// deben detectar el mismo país (no se muestran en ningún desplegable, solo alimentan la
// detección automática de la bandera).
export const COUNTRIES = [
  { name: 'España', code: 'ES', aliases: ['ESP', 'Spain'] },
  { name: 'Argentina', code: 'AR', aliases: ['ARG'] },
  { name: 'Brasil', code: 'BR', aliases: ['BRA', 'Brazil'] },
  { name: 'Francia', code: 'FR', aliases: ['FRA', 'France'] },
  { name: 'Inglaterra', code: 'GB-ENG', aliases: ['ENG', 'England'] },
  { name: 'Escocia', code: 'GB-SCT', aliases: ['SCO', 'Scotland'] },
  { name: 'Gales', code: 'GB-WLS', aliases: ['WAL', 'Wales'] },
  { name: 'Reino Unido', code: 'GB', aliases: ['UK', 'Reino Unido', 'Gran Bretaña', 'Great Britain', 'GBR'] },
  { name: 'Alemania', code: 'DE', aliases: ['GER', 'DEU', 'Germany'] },
  { name: 'Italia', code: 'IT', aliases: ['ITA', 'Italy'] },
  { name: 'Portugal', code: 'PT', aliases: ['POR'] },
  { name: 'Países Bajos', code: 'NL', aliases: ['NED', 'Holanda', 'Holland', 'Netherlands'] },
  { name: 'Bélgica', code: 'BE', aliases: ['BEL', 'Belgium'] },
  { name: 'Croacia', code: 'HR', aliases: ['CRO', 'Croatia'] },
  { name: 'Uruguay', code: 'UY', aliases: ['URU'] },
  { name: 'Colombia', code: 'CO', aliases: ['COL'] },
  { name: 'Chile', code: 'CL', aliases: ['CHI'] },
  { name: 'México', code: 'MX', aliases: ['MEX', 'Mexico'] },
  { name: 'Estados Unidos', code: 'US', aliases: ['USA', 'EEUU', 'EE.UU.', 'EE. UU.', 'US', 'Estados Unidos de America'] },
  { name: 'Japón', code: 'JP', aliases: ['JPN', 'Japon', 'Japan'] },
  { name: 'Corea del Sur', code: 'KR', aliases: ['KOR', 'South Korea'] },
  { name: 'Marruecos', code: 'MA', aliases: ['MAR', 'Morocco'] },
  { name: 'Senegal', code: 'SN', aliases: ['SEN'] },
  { name: 'Nigeria', code: 'NG', aliases: ['NGA'] },
  { name: 'Camerún', code: 'CM', aliases: ['CMR', 'Camerun', 'Cameroon'] },
  { name: 'Ghana', code: 'GH', aliases: ['GHA'] },
  { name: 'Egipto', code: 'EG', aliases: ['EGY', 'Egypt'] },
  { name: 'Argelia', code: 'DZ', aliases: ['ALG', 'Algeria'] },
  { name: 'Túnez', code: 'TN', aliases: ['TUN', 'Tunez', 'Tunisia'] },
  { name: 'Costa de Marfil', code: 'CI', aliases: ['CIV', 'Ivory Coast'] },
  { name: 'Irlanda', code: 'IE', aliases: ['IRL', 'Ireland'] },
  { name: 'Irlanda del Norte', code: 'GB', aliases: ['NIR', 'Northern Ireland'] },
  { name: 'Suiza', code: 'CH', aliases: ['SUI', 'Switzerland'] },
  { name: 'Austria', code: 'AT', aliases: ['AUT'] },
  { name: 'Polonia', code: 'PL', aliases: ['POL', 'Poland'] },
  { name: 'Serbia', code: 'RS', aliases: ['SRB'] },
  { name: 'Dinamarca', code: 'DK', aliases: ['DEN', 'Denmark'] },
  { name: 'Suecia', code: 'SE', aliases: ['SWE', 'Sweden'] },
  { name: 'Noruega', code: 'NO', aliases: ['NOR', 'Norway'] },
  { name: 'Turquía', code: 'TR', aliases: ['TUR', 'Turquia', 'Turkey'] },
  { name: 'Rusia', code: 'RU', aliases: ['RUS', 'Russia'] },
  { name: 'Ucrania', code: 'UA', aliases: ['UKR', 'Ukraine'] },
  { name: 'República Checa', code: 'CZ', aliases: ['CZE', 'Republica Checa', 'Czech Republic'] },
  { name: 'Rumania', code: 'RO', aliases: ['ROU', 'Romania'] },
  { name: 'Hungría', code: 'HU', aliases: ['HUN', 'Hungria', 'Hungary'] },
  { name: 'Grecia', code: 'GR', aliases: ['GRE', 'Greece'] },
  { name: 'Australia', code: 'AU', aliases: ['AUS'] },
  { name: 'Canadá', code: 'CA', aliases: ['CAN', 'Canada'] },
  { name: 'Ecuador', code: 'EC', aliases: ['ECU'] },
  { name: 'Perú', code: 'PE', aliases: ['PER', 'Peru'] },
  { name: 'Paraguay', code: 'PY', aliases: ['PAR'] },
  { name: 'Bolivia', code: 'BO', aliases: ['BOL'] },
  { name: 'Venezuela', code: 'VE', aliases: ['VEN'] },
  { name: 'Costa Rica', code: 'CR', aliases: ['CRC'] },
  { name: 'Panamá', code: 'PA', aliases: ['PAN', 'Panama'] },
  { name: 'Jamaica', code: 'JM', aliases: ['JAM'] },
  { name: 'China', code: 'CN', aliases: ['CHN'] },
  { name: 'Arabia Saudita', code: 'SA', aliases: ['KSA', 'Arabia Saudi', 'Saudi Arabia'] },
  { name: 'Catar', code: 'QA', aliases: ['QAT', 'Qatar'] },
  { name: 'Irán', code: 'IR', aliases: ['IRN', 'Iran'] },
  { name: 'Iraq', code: 'IQ', aliases: ['IRQ'] },
  { name: 'India', code: 'IN', aliases: ['IND'] },
  { name: 'Nueva Zelanda', code: 'NZ', aliases: ['NZL', 'New Zealand'] },
  { name: 'Islandia', code: 'IS', aliases: ['ISL', 'Iceland'] },
  { name: 'Finlandia', code: 'FI', aliases: ['FIN', 'Finland'] },
  { name: 'Eslovaquia', code: 'SK', aliases: ['SVK', 'Slovakia'] },
  { name: 'Eslovenia', code: 'SI', aliases: ['SVN', 'Slovenia'] },
  { name: 'Bosnia y Herzegovina', code: 'BA', aliases: ['BIH', 'Bosnia'] },
  { name: 'Macedonia del Norte', code: 'MK', aliases: ['MKD', 'Macedonia'] },
  { name: 'Montenegro', code: 'ME', aliases: ['MNE'] },
  { name: 'Albania', code: 'AL', aliases: ['ALB'] },
  { name: 'Kosovo', code: 'XK', aliases: ['KVX'] },
  { name: 'Israel', code: 'IL', aliases: ['ISR'] },
  { name: 'Emiratos Árabes Unidos', code: 'AE', aliases: ['UAE', 'Emiratos'] },
  { name: 'Sudáfrica', code: 'ZA', aliases: ['RSA', 'Sudafrica', 'South Africa'] },
  { name: 'República Dem. del Congo', code: 'CD', aliases: ['COD', 'Congo'] },
  { name: 'Mali', code: 'ML', aliases: ['MLI'] },
  { name: 'Burkina Faso', code: 'BF', aliases: ['BFA'] },
  { name: 'Guinea', code: 'GN', aliases: ['GUI'] },
  { name: 'Cabo Verde', code: 'CV', aliases: ['CPV'] },
  { name: 'Gabón', code: 'GA', aliases: ['GAB', 'Gabon'] },
  { name: 'Zambia', code: 'ZM', aliases: ['ZAM'] },
  { name: 'Angola', code: 'AO', aliases: ['ANG'] },
  { name: 'Mozambique', code: 'MZ', aliases: ['MOZ'] },
  { name: 'Honduras', code: 'HN', aliases: ['HON'] },
  { name: 'El Salvador', code: 'SV', aliases: ['SLV'] },
  { name: 'Guatemala', code: 'GT', aliases: ['GUA'] },
  { name: 'Cuba', code: 'CU', aliases: ['CUB'] },
  { name: 'República Dominicana', code: 'DO', aliases: ['DOM', 'Republica Dominicana'] },
  { name: 'Haití', code: 'HT', aliases: ['HAI', 'Haiti'] },
  { name: 'Trinidad y Tobago', code: 'TT', aliases: ['TRI'] },
];

// Índice plano: cada clave (nombre completo o variante, normalizados de forma "laxa")
// apunta al país correspondiente. Se construye una sola vez al cargar el módulo.
const ALIAS_INDEX = new Map();
for (const country of COUNTRIES) {
  const keys = [country.name, ...(country.aliases || [])];
  for (const key of keys) {
    const normalized = normalizeLoose(key);
    if (normalized && !ALIAS_INDEX.has(normalized)) ALIAS_INDEX.set(normalized, country);
  }
}

export const findCountryByName = (name) => {
  const target = normalizeText(name);
  if (!target) return null;
  return COUNTRIES.find((c) => normalizeText(c.name) === target) || null;
};

// Detección automática por coincidencia exacta (nombre completo o cualquier variante
// conocida: código FIFA, siglas, nombre en inglés...), no por coincidencia parcial —
// así "Arg" no confunde con "Argelia" mientras el usuario todavía está escribiendo.
export const detectCountry = (text) => {
  const key = normalizeLoose(text);
  if (!key) return null;
  return ALIAS_INDEX.get(key) || null;
};
