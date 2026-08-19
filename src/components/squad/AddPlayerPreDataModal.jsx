import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { formatMoneyLiveWithCursor, parseValue } from '../../utils/format';
import Dropdown from '../common/Dropdown';

const FIELD_CLASS = 'w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-black text-base md:text-sm text-fg placeholder:text-fg-faint';

const LOAN_DURATION_OPTIONS = [
  { value: '6 Meses', label: '6 Meses' },
  { value: '1 Temporada', label: '1 Temporada' },
  { value: '2 Temporadas', label: '2 Temporadas' },
];

// Ningún campo de este paso se envía con Enter, igual que en PlayerForm — sin <form>, Enter no
// tendría efecto por defecto, pero se bloquea explícitamente para evitar cualquier avance
// inesperado mientras el usuario escribe.
const blockEnterKey = (e) => { if (e.key === 'Enter') e.preventDefault(); };

// Tercer paso de "Fichar Jugador" (tras fijar Comprado o Cedido en AddPlayerOperationTypeModal,
// antes de AddPlayerChoiceModal): recoge los datos que la IA nunca puede leer de la propia
// tarjeta del jugador —club de procedencia y precio de compra en Comprado; club de origen,
// duración de cesión y salario cubierto en Cedido— ANTES de elegir el método de alta, para que
// tanto el escaneo con IA como el formulario manual los reciban ya integrados (ver
// pendingPreData en PlayerList) en vez de tener que pedirlos de nuevo o resaltarlos en rojo a
// posteriori. No se muestra para "Plantilla Inicial" (PlayerList salta directo al Paso de
// Método) ni para Academia (no pasa por este flujo en absoluto).
export default function AddPlayerPreDataModal({ operationType, onClose, onBack, onContinue }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const isComprado = operationType === 'Comprado';
  const [sourceClub, setSourceClub] = useState('');
  const [value, setValue] = useState('');
  const [loanDuration, setLoanDuration] = useState('1 Temporada');
  const [wagePercentage, setWagePercentage] = useState(0);

  // Precio de Compra sí es obligatorio para poder fichar un "Comprado" (igual que ya exige
  // PlayerForm en su Paso 3); Club de Procedencia/Origen se pide siempre en esta pantalla
  // dedicada, aunque el asistente clásico nunca lo exigiera formalmente, porque es precisamente
  // el dato que este paso existe para capturar.
  const canContinue = sourceClub.trim() !== '' && (!isComprado || parseValue(value) > 0);

  const handleContinue = () => {
    if (!canContinue) return;
    if (isComprado) {
      onContinue({ sourceClub: sourceClub.trim(), value });
    } else {
      // "Club de Procedencia" y "Club de Origen" son el mismo club en una cesión entrante (el
      // que sigue siendo dueño del jugador): un único campo en este paso alimenta ambos campos
      // de PlayerForm, en vez de pedirlo dos veces.
      onContinue({ sourceClub: sourceClub.trim(), originClub: sourceClub.trim(), loanDuration, wagePercentage });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-5 rounded-[32px] w-full max-w-sm shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="p-1 -ml-1 text-fg-faint hover:text-fg transition-colors"><ChevronLeft size={18} /></button>
            <h3 className="font-black italic text-green-500 text-sm uppercase">Fichar Jugador</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>

        <div className="p-3 rounded-2xl bg-well border border-border-subtle mb-4">
          <p className="text-[10px] font-bold text-fg-muted leading-relaxed">
            {isComprado
              ? 'Estos datos no aparecen en la tarjeta del jugador dentro del juego: indícalos ahora, antes de escanear o rellenar el resto de la ficha.'
              : 'Estos datos de la cesión no aparecen en la tarjeta del jugador dentro del juego: indícalos ahora, antes de escanear o rellenar el resto de la ficha.'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1 relative">
            <label className="text-[9px] font-black text-fg-muted ml-1">Club de {isComprado ? 'Procedencia' : 'Procedencia / Origen'} *</label>
            <input autoFocus type="text" placeholder="Ej: Sporting Gijón" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={sourceClub} onChange={(e) => setSourceClub(e.target.value)} />
          </div>

          {isComprado ? (
            <div className="space-y-1 relative">
              <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra / Traspaso (€) *</label>
              <input type="text" inputMode="numeric" placeholder="Ej: 50.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={value} onChange={(e) => formatMoneyLiveWithCursor(e.target, setValue)} />
            </div>
          ) : (
            <>
              <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-fg-muted ml-1">Duración de Cesión</label>
                <Dropdown value={loanDuration} options={LOAN_DURATION_OPTIONS} onChange={setLoanDuration} labelClassName="text-xs" />
              </div>
              <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-fg-muted ml-1">Salario Cubierto / Coste (% Pagado por Nuestro Club)</label>
                <div className="flex items-center gap-3 bg-well p-3 rounded-xl border border-border-subtle">
                  <input type="range" min="0" max="100" step="5" className="flex-1 accent-green-500" value={wagePercentage} onChange={(e) => setWagePercentage(Number(e.target.value))} />
                  <span className="text-xs font-black text-fg w-10 text-right shrink-0">{wagePercentage}%</span>
                </div>
              </div>
            </>
          )}
        </div>

        <button type="button" disabled={!canContinue} onClick={handleContinue} className="w-full mt-5 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:bg-green-500 touch-manipulation">
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
