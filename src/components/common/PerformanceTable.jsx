// Columnas de rendimiento estilo EA Sports FC (mismos nombres de campo que ya usa seasonStats/
// competitionBreakdown/careerHistory en toda la app, ver ClubDataContext/geminiPlayerScan):
// compartidas por la Ficha del Jugador (Temporada Actual + cada temporada del Historial de
// Carrera) y por el Detalle de Temporada archivada (tabla individual por jugador).
export const PERFORMANCE_COLUMNS = [
  ['matchesPlayed', 'PJ'], ['goals', 'G'], ['assists', 'A'],
  ['cleanSheets', 'PI'], ['yellowCards', 'TA'], ['redCards', 'TR'],
];

// Tabla genérica: una fila por "rows" (competiciones o jugadores, según el llamador) más una
// fila final de Totales — "totals" siempre se calcula sobre el agregado real (nunca sumando las
// filas mostradas, que pueden venir vacías o incompletas). "labelKey" decide qué campo de cada
// fila se muestra en la primera columna (por defecto "competition"; el Detalle de Temporada la
// pasa como "name" para listar jugadores en vez de competiciones) y "labelHeader" el título de
// esa columna.
export default function PerformanceTable({ rows, totals, labelKey = 'competition', labelHeader = 'Competición' }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full text-[9px] whitespace-nowrap">
        <thead>
          <tr className="bg-well-strong text-fg-faint uppercase font-black tracking-wide">
            <th className="text-left px-2.5 py-2">{labelHeader}</th>
            {PERFORMANCE_COLUMNS.map(([key, label]) => <th key={key} className="px-1.5 py-2">{label}</th>)}
            <th className="px-1.5 py-2">MED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((r, i) => (
            <tr key={i} className="text-fg font-bold">
              <td className="px-2.5 py-2 text-left truncate max-w-[100px]">{r[labelKey]}</td>
              {PERFORMANCE_COLUMNS.map(([key]) => <td key={key} className="px-1.5 py-2 text-center">{r[key] ?? 0}</td>)}
              <td className="px-1.5 py-2 text-center text-green-500">{r.averageRating || '—'}</td>
            </tr>
          ))}
          {totals && (
            <tr className="bg-well-strong font-black text-fg">
              <td className="px-2.5 py-2 text-left uppercase text-[8px] tracking-wide">Totales</td>
              {PERFORMANCE_COLUMNS.map(([key]) => <td key={key} className="px-1.5 py-2 text-center">{totals[key] ?? 0}</td>)}
              <td className="px-1.5 py-2 text-center text-green-500">{totals.averageRating || '—'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
