import { useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

// Dispositivos con ratón real: el texto se revela con :hover (CSS) y un solo clic ejecuta.
// Dispositivos táctiles: no hay hover real, así que se exige un primer toque para desplegar
// el texto (arma la confirmación) y un segundo toque para ejecutar; tocar fuera lo contrae.
const HAS_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export default function ClearButton({ onConfirm, label, className = '' }) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setConfirming(false), confirming);

  const handleClick = () => {
    if (HAS_HOVER) { onConfirm(); return; }
    if (confirming) { onConfirm(); setConfirming(false); }
    else { setConfirming(true); }
  };

  return (
    <div ref={ref} className={`group/clear ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        title={label}
        className={`flex items-center h-9 pl-2.5 pr-2.5 rounded-full transition-colors duration-300 ${confirming ? 'bg-red-500 text-white' : 'bg-black/40 text-white/40 hover:bg-red-500/20 hover:text-red-400'}`}
      >
        <Eraser size={14} className="shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${confirming ? 'max-w-[160px] ml-2' : 'max-w-0 ml-0 group-hover/clear:max-w-[160px] group-hover/clear:ml-2'}`}>
          {label}
        </span>
      </button>
    </div>
  );
}
