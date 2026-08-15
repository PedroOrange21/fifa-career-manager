import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Desplegable homogéneo para toda la app: mismo estilo, tipografía e interacción que el
// selector de Pierna hábil del asistente de Fichar Jugador. El panel de opciones se pinta
// con un portal (fuera de cualquier contenedor con overflow-hidden/auto) para que nunca
// quede recortado ni tapado, con posición fixed calculada a partir del propio botón.
// Cada opción puede traer un "closedIcon" opcional (más grande) para el botón cerrado,
// distinto del "icon" que se usa dentro de la lista de opciones (más pequeño); si no se
// define, el botón cerrado reutiliza el mismo "icon". labelClassName permite ajustar el
// tamaño de fuente del texto visible en el botón cerrado sin afectar a las opciones del
// menú desplegable, que mantienen siempre su propio tamaño fijo.
export default function Dropdown({ value, options, onChange, placeholder = 'Seleccionar', labelClassName = 'text-[8px]' }) {
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

  // e.stopPropagation() en todos los eventos de apertura/selección: el panel de opciones se
  // pinta con un portal directamente en document.body, fuera del árbol DOM de cualquier
  // modal contenedor. Sin cortar la propagación aquí, un modal cuyo fondo cierra al clicar
  // (onClick en el backdrop) puede recibir el clic/touch de una opción recién seleccionada y
  // cerrarse él entero por accidente, además del propio desplegable.
  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };

  const selectOption = (e, optValue) => {
    e.stopPropagation();
    onChange(optValue);
    setOpen(false);
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className="relative">
      <button ref={btnRef} type="button" onClick={toggle} className="w-full h-[52px] bg-well p-2 rounded-xl outline-none border border-border-subtle flex flex-col items-center justify-center gap-0.5 font-black text-fg touch-manipulation">
        {selected?.closedIcon ?? selected?.icon}
        <span className={`${labelClassName} uppercase tracking-wide truncate max-w-full px-1`}>{selected?.label ?? placeholder}</span>
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-y-auto max-h-56 no-scrollbar z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {options.map((opt) => (
            <button key={opt.value} type="button" onClick={(e) => selectOption(e, opt.value)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${value === opt.value ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
