import { Sparkles } from 'lucide-react';

// Botón CTA premium para acciones de IA (Escanear con IA, Escanear Fotos...): fondo oscuro con
// borde degradado animado (violeta/cian/magenta/azul, ver .btn-ai-glow en index.css) y halo
// dinámico, estilo Siri/Gemini/Apple Intelligence. Centralizado aquí para que CUALQUIER acción
// de IA en la web comparta exactamente el mismo tratamiento visual sin repetir la clase a mano.
export default function AIGlowButton({ children, icon: Icon = Sparkles, type = 'button', disabled = false, className = '', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`btn-ai-glow w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest touch-manipulation disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      <Icon size={16} className="ai-sparkle shrink-0" />
      {children}
    </button>
  );
}
