import { useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

export default function TacticsDropdown({
  icon: Icon, value, options, onChange, onEditOption, onDeleteOption,
  placeholder = 'Seleccionar', emptyLabel = 'Sin opciones', wrapperClassName = 'relative', triggerClassName = 'h-8 px-3',
  // Por defecto, pastilla oscura semitransparente: pensada para vivir sobre el césped
  // (verde en claro, verde muy oscuro en dark) de FormationPitch, donde contrasta bien en
  // ambos temas sin necesidad de variantes. Cuando el desplegable vive sobre bg-surface
  // (p.ej. "Plantillas" en SavedFormationsBar), se sobreescribe con tonos del tema.
  triggerColorClassName = 'bg-black/40 text-white/80 hover:bg-black/60 backdrop-blur-sm',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false), open);

  const hasActions = !!(onEditOption || onDeleteOption);

  return (
    <div ref={ref} className={wrapperClassName}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 rounded-full transition-all text-[10px] font-black uppercase tracking-wider ${triggerColorClassName} ${triggerClassName}`}>
        {Icon && <Icon size={12} className="shrink-0" />} <span className="whitespace-nowrap">{value || placeholder}</span>
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-2 ${hasActions ? 'w-52' : 'w-40'} bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 p-1.5 max-h-64 overflow-y-auto no-scrollbar`}>
          {options.length === 0 && <div className="px-3 py-2 text-[10px] text-fg-faint font-bold italic">{emptyLabel}</div>}
          {options.map((opt) => (
            <div key={opt} className={`flex items-center rounded-xl transition-all ${value === opt ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
              <button type="button" onClick={() => { onChange(opt); setOpen(false); }} className="flex-1 min-w-0 text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider truncate">{opt}</button>
              {hasActions && (
                <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
                  {onEditOption && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); onEditOption(opt); }} title="Renombrar" className="p-1.5 rounded-lg text-fg-faint hover:text-green-500 hover:bg-well-strong transition-all"><Pencil size={11} /></button>
                  )}
                  {onDeleteOption && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); onDeleteOption(opt); }} title="Eliminar" className="p-1.5 rounded-lg text-fg-faint hover:text-red-500 hover:bg-well-strong transition-all"><Trash2 size={11} /></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
