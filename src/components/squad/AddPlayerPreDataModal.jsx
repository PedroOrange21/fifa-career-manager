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

// Tercer paso de "Fichar Jugador" (tras elegir "Traspaso" en AddPlayerAcquisitionTypeModal,
// antes de AddPlayerChoiceModal): Club de Procedencia y Precio de Compra, AMBOS obligatorios —
// ninguno de los dos aparece nunca en la propia tarjeta del jugador, así que hay que pedirlos
// aquí antes de escanear o rellenar a mano. "Continuar" queda deshabilitado hasta completar los
// dos; una vez indicados, se trasladan como prefill al formulario posterior (Manual o tras el
// escaneo con IA, ver buildPreDataPrefill en PlayerList) para que ese paso económico aparezca
// ya relleno. Nunca se muestra para "Cedido" (un jugador cedido no tiene precio de traspaso ni
// "club de procedencia" en este sentido, tiene su propio Club de Origen dentro del formulario).
export default function AddPlayerPreDataModal({ onClose, onBack, onContinue }) {
  useBodyScrollLock();
  useAutoHideChrome();

  const [sourceClub, setSourceClub] = useState('');
  const [value, setValue] = useState('');

  const canContinue = sourceClub.trim().length > 0 && value.trim().length > 0;
  const handleContinue = () => { if (canContinue) onContinue({ sourceClub: sourceClub.trim(), value }); };

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
            Ninguno de estos dos datos aparece en la tarjeta del jugador — indícalos ahora y quedarán ya rellenados en el paso económico, tanto si escaneas con IA como si rellenas el formulario a mano.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1 relative">
            <label className="text-[9px] font-black text-fg-muted ml-1">Club de Procedencia *</label>
            <input autoFocus type="text" required placeholder="Ej: Sporting Gijón" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={sourceClub} onChange={(e) => setSourceClub(e.target.value)} />
          </div>
          <div className="space-y-1 relative">
            <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra (€) *</label>
            <input type="text" required inputMode="numeric" placeholder="Ej: 50.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={value} onChange={(e) => formatMoneyLiveWithCursor(e.target, setValue)} />
          </div>
        </div>

        <button type="button" onClick={handleContinue} disabled={!canContinue} className="w-full mt-5 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed">
          Continuar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
