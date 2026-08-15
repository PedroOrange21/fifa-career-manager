import { useLegal } from '../../context/LegalContext';

// Pie de página global: enlaces legales + créditos de autoría. Se renderiza al final del
// contenido de cada pantalla (dentro del <main> de ClubShell y en AuthScreen), nunca fijo,
// para no competir con la barra de navegación inferior fija en móvil.
export default function Footer() {
  const { openPrivacy, openTerms } = useLegal();

  return (
    <footer className="w-full mt-10 pt-5 pb-4 border-t border-border-subtle flex flex-col items-center gap-2 text-center">
      <div className="flex items-center gap-3 text-[9px] font-black text-fg-faint uppercase tracking-widest">
        <button type="button" onClick={openPrivacy} className="hover:text-fg-muted transition-colors">Política de Privacidad</button>
        <span className="opacity-40">·</span>
        <button type="button" onClick={openTerms} className="hover:text-fg-muted transition-colors">Términos de Servicio</button>
      </div>
      <p className="text-[9px] font-bold text-fg-faint/70">Creado y desarrollado por Pedro Orange</p>
    </footer>
  );
}
