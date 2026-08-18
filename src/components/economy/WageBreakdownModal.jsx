import { X, Users2, Edit2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Lista de solo lectura con el sueldo semanal individual de cada jugador que compone la masa
// salarial (ya ordenada de mayor a menor y con el total al final), para que el usuario pueda
// verificar exactamente cómo se forma la cifra mostrada en la tarjeta de Finanzas.
// onEditPlayer (opcional): si se recibe, cada fila muestra un lápiz de edición junto al bloque
// de sueldo (extremo derecho) que abre directamente la ficha de edición del jugador (Paso 4 de
// PlayerForm), ya con el foco puesto en el campo del Sueldo Semanal — evita tener que salir de
// Finanzas y buscar al jugador a mano en Plantilla.
export default function WageBreakdownModal({ players, total, onClose, onEditPlayer }) {
  useBodyScrollLock();
  useAutoHideChrome();

  return (
    <div className="fixed inset-0 bg-black/95 z-[160] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-sm shadow-2xl relative max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex justify-between items-center p-6 pb-4 border-b border-border-subtle">
          <h3 className="font-black italic text-fg text-sm uppercase flex items-center gap-2"><Users2 size={16} className="text-green-500" /> Desglose de Sueldos</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-border-subtle">
          {players.length === 0 && (
            <div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin sueldos que mostrar</div>
          )}
          {players.map((p) => (
            <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm text-fg truncate">{p.name}</div>
                {p.transferStatus === 'CedidoFuera' && (
                  <div className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Cedido · {p.outboundLoan?.wagePercentage ?? 0}% a cargo del club</div>
                )}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right leading-tight">
                  <div className="font-black text-sm text-fg">{formatCurrency(p.effectiveWage)}/sem</div>
                  <div className="font-bold text-[9px] text-fg-faint mt-0.5">{formatCurrency(p.effectiveWage * 52)}/año</div>
                </div>
                {onEditPlayer && (
                  <button
                    type="button"
                    onClick={() => onEditPlayer(p)}
                    title={`Editar sueldo de ${p.name}`}
                    className="p-1.5 rounded-lg text-fg-faint hover:text-green-500 hover:bg-well transition-colors shrink-0 touch-manipulation"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 p-6 pt-4 border-t border-border-subtle flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Total Semanal</span>
          <div className="text-right leading-tight">
            <div className="text-lg font-black italic text-green-500">{formatCurrency(total)}/sem</div>
            <div className="text-[10px] font-bold text-fg-faint mt-0.5">{formatCurrency(total * 52)}/año</div>
          </div>
        </div>
      </div>
    </div>
  );
}
