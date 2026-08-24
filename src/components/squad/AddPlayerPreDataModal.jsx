import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { formatMoneyLiveWithCursor } from '../../utils/format';

const FIELD_CLASS = 'w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-black text-base md:text-sm text-fg placeholder:text-fg-faint';

// Ningún campo de este paso se envía con Enter, igual que en PlayerForm — sin <form>, Enter no
// tendría efecto por defecto, pero se bloquea explícitamente para evitar cualquier avance
// inesperado mientras el usuario escribe.
const blockEnterKey = (e) => { if (e.key === 'Enter') e.preventDefault(); };

// Paso 4 de "Fichar Jugador" (tras elegir "Comprado / Traspaso" en
// AddPlayerAcquisitionTypeModal, antes de AddPlayerChoiceModal): un único campo opcional, el
// Precio de Compra/Traspaso — el resto de datos (club de procedencia, años de contrato...) se
// completan más adelante, al escanear con IA o rellenar a mano. "Continuar" siempre está
// activo: el precio es opcional, no bloquea el avance. Nunca se muestra para "Cedido" (una
// cesión no tiene precio de traspaso que precargar, ver selectAcquisitionType en PlayerList),
// "Ya en el Club" ni Academia.
export default function AddPlayerPreDataModal({ onClose, onBack, onContinue }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const [value, setValue] = useState('');

  const handleContinue = () => onContinue(value ? { value } : {});

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
            Si sabes ya el precio de traspaso, indícalo ahora — este dato no aparece en la tarjeta del jugador. Si no lo sabes todavía, puedes dejarlo en blanco y completarlo después.
          </p>
        </div>

        <div className="space-y-1 relative">
          <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra / Traspaso (€) — opcional</label>
          <input autoFocus type="text" inputMode="numeric" placeholder="Ej: 50.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={value} onChange={(e) => formatMoneyLiveWithCursor(e.target, setValue)} />
        </div>

        <button type="button" onClick={handleContinue} className="w-full mt-5 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all touch-manipulation">
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
