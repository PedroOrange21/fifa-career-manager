import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Desplegable homogéneo para toda la app: mismo estilo, tipografía e interacción que el
// selector de Pierna hábil del asistente de Fichar Jugador. El panel de opciones se pinta
// con un portal (fuera de cualquier contenedor con overflow-hidden/auto) para que nunca
// quede recortado ni tapado, con posición fixed calculada a partir del propio botón.
export default function Dropdown({ value, options, onChange, placeholder = 'Seleccionar' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className="relative">
      <button ref={btnRef} type="button" onClick={toggle} className="w-full h-[52px] bg-well p-2 rounded-xl outline-none border border-border-subtle flex flex-col items-center justify-center gap-0.5 font-black text-fg touch-manipulation">
        {selected?.icon}
        <span className="text-[8px] uppercase tracking-wide truncate max-w-full px-1">{selected?.label ?? placeholder}</span>
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-y-auto max-h-56 no-scrollbar z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {options.map((opt) => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${value === opt.value ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
