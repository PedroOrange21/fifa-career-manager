// useGrouping: true se pasa explícitamente en todos los toLocaleString('es-ES') de este
// archivo: el valor por defecto ("auto") de Intl.NumberFormat en navegadores recientes puede
// omitir el punto de miles precisamente en números de 4 cifras (ej. 5000 -> "5000" en vez de
// "5.000"), un caso límite verificado en local que rompía el formateo justo en los importes
// más habituales al escribir un sueldo o presupuesto.
export const formatValueInput = (val) => {
  if (!val) return '';
  const num = val.replace(/\./g, '').replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('es-ES', { useGrouping: true });
};

export const parseValue = (val) => {
  if (!val) return 0;
  return Number(String(val).replace(/\./g, ''));
};

// Formatea un input de dinero con puntos de miles en tiempo real (cada tecleo) SIN que el
// cursor salte al final del texto al editar un dígito en medio del número — el mismo problema
// que ya se resolvió puntualmente en el asistente de "Fichar Jugador" (formatMoneyField),
// ahora extraído aquí para poder reutilizarlo en cualquier campo monetario de la app (p. ej.
// el precio de venta del modal de Vender Jugador) sin duplicar la lógica de reposicionamiento
// del cursor. "input" es el elemento <input> nativo (event.target); "onFormatted" recibe el
// valor ya formateado para guardarlo en el estado del campo.
export const formatMoneyLiveWithCursor = (input, onFormatted) => {
  const raw = input.value;
  const cursorPos = input.selectionStart ?? raw.length;
  const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/\D/g, '').length;
  const formatted = formatValueInput(raw);
  onFormatted(formatted);
  requestAnimationFrame(() => {
    if (!input.isConnected) return;
    let seen = 0; let pos = formatted.length;
    if (digitsBeforeCursor === 0) { pos = 0; }
    else {
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) seen++;
        if (seen === digitsBeforeCursor) { pos = i + 1; break; }
      }
    }
    try { input.setSelectionRange(pos, pos); } catch (err) { /* input puede haber perdido el foco */ }
  });
};

// "val" normalmente es un número ya calculado (suma de sueldos, presupuesto, importe*% ...),
// no una cadena formateada con puntos de miles — por eso NO debe pasar por parseValue()
// (pensada para leer cadenas "1.234.567" de un <input>, donde el punto es separador de miles).
// Convertirlo primero a String() y luego quitarle los puntos con parseValue trataba el punto
// DECIMAL de un float (p. ej. 9230.769230769231, típico de un cálculo de % de sueldo sin
// redondear) como si fuera separador de miles, concatenando toda la parte decimal al entero y
// disparando importes absurdos (9230.769230769231 -> "9230769230769231"). Math.round() antes
// de formatear evita ese caso por completo, venga el valor ya limpio o no.
export const formatCurrency = (val) => {
  const num = Math.round(typeof val === 'number' ? val : parseValue(String(val ?? 0)));
  return num.toLocaleString('es-ES', { useGrouping: true }) + ' €';
};

export const abbreviateValue = (val) => {
  if (!val) return '0 €';
  const num = Math.round(typeof val === 'number' ? val : parseValue(String(val)));
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill €';
  if (num >= 1000) return (num / 1000).toFixed(0) + ' Mil €';
  return num + ' €';
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
