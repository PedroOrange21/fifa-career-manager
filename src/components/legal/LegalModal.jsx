import { X, ShieldCheck, FileText } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

const LAST_UPDATED = '15 de agosto de 2026';

function Section({ title, children }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-green-500">{title}</h4>
      <div className="text-xs text-fg-secondary leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. Qué datos tratamos">
        <p>Al crear una cuenta guardamos tu correo electrónico, el nombre de entrenador que elijas y, si la subes, una foto de perfil. Estos datos se gestionan a través de Firebase Authentication (Google) y no se comparten con terceros con fines publicitarios.</p>
      </Section>
      <Section title="2. Datos de tus partidas (Modo Carrera)">
        <p>Toda la información de tus clubes, jugadores, tácticas, fichajes y finanzas se almacena en una base de datos (Firestore) asociada únicamente a tu cuenta, para que puedas continuar tu progreso desde cualquier dispositivo en el que inicies sesión.</p>
      </Section>
      <Section title="3. Cookies y almacenamiento local">
        <p>Usamos <strong className="text-fg">localStorage</strong> del navegador (no cookies de rastreo publicitario) para recordar tu sesión iniciada, el club activo seleccionado y tus preferencias de apariencia (tema claro/oscuro). Esta información permanece en tu propio dispositivo y es necesaria para el funcionamiento básico de la aplicación.</p>
      </Section>
      <Section title="4. Conservación y eliminación">
        <p>Puedes eliminar un club (Modo Carrera) en cualquier momento desde su menú de edición, lo que borra permanentemente todos sus datos asociados. Si deseas eliminar por completo tu cuenta y todos tus datos, puedes solicitarlo contactando con el desarrollador.</p>
      </Section>
      <Section title="5. Tus derechos">
        <p>Puedes acceder, corregir o eliminar tus datos personales en cualquier momento desde la sección de Perfil, o solicitando su eliminación completa como se indica arriba.</p>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="1. Descripción del servicio">
        <p>Esta aplicación es un simulador de gestión deportiva (Modo Carrera) de uso personal y recreativo, sin ánimo de lucro ni afiliación con ninguna liga, club o competición real.</p>
      </Section>
      <Section title="2. Uso aceptable">
        <p>Te comprometes a usar la aplicación de forma responsable, sin intentar vulnerar su seguridad ni acceder a datos de otros usuarios. Eres responsable de mantener la confidencialidad de tu cuenta.</p>
      </Section>
      <Section title="3. Contenido generado por el usuario">
        <p>Los nombres de club, jugadores y las imágenes que subas son de tu responsabilidad. No debes introducir contenido ofensivo, ilegal o que infrinja derechos de terceros.</p>
      </Section>
      <Section title="4. Disponibilidad del servicio">
        <p>La aplicación se ofrece "tal cual", sin garantías de disponibilidad continua. Puede sufrir interrupciones, cambios o actualizaciones sin previo aviso, y no nos hacemos responsables de la pérdida de datos derivada de fallos técnicos ajenos a un uso normal.</p>
      </Section>
      <Section title="5. Cambios en estos términos">
        <p>Estos términos pueden actualizarse ocasionalmente. El uso continuado de la aplicación tras un cambio implica la aceptación de los nuevos términos.</p>
      </Section>
    </>
  );
}

export default function LegalModal({ type, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const isPrivacy = type === 'privacy';

  return (
    <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-lg shadow-2xl max-h-[85dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <h3 className="font-black italic text-green-500 text-sm uppercase flex items-center gap-2">
            {isPrivacy ? <ShieldCheck size={16} className="shrink-0" /> : <FileText size={16} className="shrink-0" />}
            {isPrivacy ? 'Política de Privacidad y Cookies' : 'Términos y Condiciones de Uso'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors touch-manipulation"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4 pb-5 flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-fg-faint">Última actualización: {LAST_UPDATED}</p>
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="w-full py-3.5 rounded-xl bg-green-500 text-black font-black uppercase text-xs hover:bg-green-400 transition-all touch-manipulation">Entendido</button>
        </footer>
      </div>
    </div>
  );
}
