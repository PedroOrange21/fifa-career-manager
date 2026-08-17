import { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Check } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { usePreventBackdropTouch } from '../../hooks/usePreventBackdropTouch';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { parseValue } from '../../utils/format';

const CONTRACT_YEARS_CHOICES = [1, 2, 3, 4, 5];
const DEFAULT_CONTRACT_YEARS = '3';

// Ningún campo de esta tarjeta se envía con Enter (no hay <form>, igual que en PlayerForm):
// se bloquea explícitamente para que nunca dispare un cierre ni acción inesperada.
const blockEnterKey = (e) => { if (e.key === 'Enter') e.preventDefault(); };

// Formateo de miles en vivo, directo y sin manipulación manual del cursor (que en algunos
// navegadores móviles puede interactuar mal con el teclado numérico y sentirse como "saltos"):
// se limpia todo lo que no sea dígito y se reformatea con separador de miles es-ES en cada
// pulsación, ej. 5000 -> "5.000". parseValue() limpia los puntos de nuevo al guardar, para no
// persistir NaN en la base de datos.
const formatMoneyLive = (raw) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // useGrouping: true explícito: el valor por defecto ("auto") omite el punto de miles en
  // números de exactamente 4 cifras (ej. 5000 -> "5000") en navegadores recientes, verificado
  // en local — justo el rango típico de un sueldo mensual.
  return Number(digits).toLocaleString('es-ES', { useGrouping: true });
};

// Misma estructura de contenedor/overlay/tarjeta que "Fichar Jugador" (PlayerForm.jsx): backdrop
// con guard de touchmove, tarjeta flex-col con cabecera y pie fijos y solo el cuerpo central con
// scroll propio, y confirmación de descarte con su propio backdrop — el mismo patrón que ya
// funciona sin problemas de desplazamiento ni cierres accidentales en móvil.
//
// Firma del primer contrato profesional al promover a un canterano: ficha con Sueldo Mensual,
// Años de Contrato y Cláusula de Rescisión (opcional), igual que un jugador "Comprado" normal.
// Al confirmar, el jugador se convoca al banquillo (si hay hueco), pasa a tipo "Comprado" (ya
// no participa de las reglas de Cantera) y pierde su rango de potencial numérico, que deja de
// aplicar una vez es un profesional del primer equipo con contrato propio.
export default function PromoteToFirstTeamModal({ player, onClose }) {
  useAutoHideChrome();
  const { bench, assignPlayerToSlot, addOrUpdatePlayer } = useClubData();
  const [wage, setWage] = useState('');
  const [contractYears, setContractYears] = useState(DEFAULT_CONTRACT_YEARS);
  const [releaseClause, setReleaseClause] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const backdropRef = usePreventBackdropTouch(true);
  const discardBackdropRef = usePreventBackdropTouch(showDiscardConfirm);

  const handleConfirm = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting) return;
    if (!wage || parseValue(wage) <= 0) { setError('El sueldo mensual es obligatorio.'); return; }
    if (!contractYears) { setError('Selecciona los años de contrato.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      const alreadyCalledUp = Object.values(bench).includes(player.id);
      if (!alreadyCalledUp) {
        const emptyBenchIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !bench[i]);
        if (emptyBenchIdx !== undefined) assignPlayerToSlot(`bench-${emptyBenchIdx}`, player.id);
      }
      await addOrUpdatePlayer({
        type: 'Comprado',
        value: 0,
        wage: parseValue(wage),
        contractYears: parseInt(contractYears),
        releaseClause: parseValue(releaseClause) || null,
        potential: null,
        // Marca de procedencia: sin coste de fichaje real, para que una futura venta calcule
        // el beneficio sobre 0 € en vez de confundirlo con un fichaje gratuito genérico.
        fromAcademy: true,
      }, player.id);
      onClose();
    } catch (err) {
      console.error(err);
      setError('No se pudo completar la promoción. Inténtalo de nuevo.');
      setIsSubmitting(false);
    }
  };

  // --- Cierre: única y exclusivamente disparado por el botón X (mismo patrón que PlayerForm). ---
  // stopPropagation + preventDefault: aísla el toque de la "X" del resto de la tarjeta para
  // que, aunque el dedo se deslice ligeramente al soltar, el evento no llegue a reinterpretarse
  // sobre ningún otro control cercano (p. ej. los botones de Años de Contrato).
  const isDirty = !!wage || !!releaseClause || contractYears !== DEFAULT_CONTRACT_YEARS;
  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };

  // Misma protección para cada botón de Años de Contrato: un solo toque selecciona la opción
  // sin que el evento se propague a controles vecinos.
  const selectContractYears = (e, n) => {
    e.preventDefault();
    e.stopPropagation();
    setContractYears(String(n));
  };

  return (
    <>
      {/* Backdrop: no tiene su propio scroll (no es contenido scrolleable), así que un
          touchmove que empiece aquí se bloquea (usePreventBackdropTouch) para que no arrastre
          la página de la Academia que sigue debajo — sin tocar document.body en ningún
          momento, para no desajustar las coordenadas táctiles en Safari iOS. */}
      <div ref={backdropRef} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overscroll-contain">
        {/* Tarjeta compacta: flex-col + overflow-hidden en el propio contenedor, para que
            cabecera y pie queden completamente estáticos y solo el cuerpo central (flex-1
            overflow-y-auto) haga scroll, incluso si el teclado se despliega en móvil. */}
        <div className="bg-surface border border-border rounded-[32px] w-full max-w-sm shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <div className="shrink-0 bg-surface flex justify-between items-center gap-3 px-5 pt-5 pb-3 border-b border-border-subtle">
            <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2 min-w-0 truncate"><ShieldCheck size={16} className="shrink-0" /> Contrato Profesional</h3>
            {/* Área de toque ampliada (p-2.5, radio propio) y separada del título con gap-3:
                evita que un toque impreciso sobre la "X" roce el contenido vecino. */}
            <button type="button" onClick={handleCloseClick} className="shrink-0 p-2.5 -mr-1 rounded-full text-fg-faint hover:text-fg hover:bg-well transition-colors touch-manipulation">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 pt-4 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
            <div className="space-y-4 pb-4">
              <p className="text-[10px] text-fg-muted font-bold">Sube a {player.name} al primer equipo con su primer contrato profesional.</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse">
                  <ShieldAlert size={14} className="shrink-0" /><span>{error}</span>
                </div>
              )}

              <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-fg-muted ml-1">Sueldo Mensual (€) *</label>
                <input autoFocus type="text" inputMode="numeric" required placeholder="Ej: 500.000" onKeyDown={blockEnterKey} className="w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-blue-400 font-black text-base md:text-sm text-fg text-center placeholder:text-fg-faint" value={wage} onChange={(e) => setWage(formatMoneyLive(e.target.value))} />
              </div>
              {/* Botones fijos en vez de un desplegable: sin portal ni listeners globales de
                  "clic fuera", así que no hay ningún elemento que pueda quedar interceptando
                  los toques del resto de la tarjeta en móvil. e.stopPropagation() +
                  e.preventDefault() en cada uno aísla el toque para que un solo golpe
                  seleccione una única opción sin rebotar sobre botones vecinos. */}
              <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-fg-muted ml-1">Años de Contrato *</label>
                <div className="grid grid-cols-5 gap-2">
                  {CONTRACT_YEARS_CHOICES.map((n) => (
                    <button key={n} type="button" onClick={(e) => selectContractYears(e, n)} className={`py-3.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${contractYears === String(n) ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/30' : 'bg-well text-fg-muted hover:bg-well-strong border border-border-subtle'}`}>
                      {n} Año{n > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 relative">
                <label className="text-[9px] font-black text-fg-muted ml-1">Cláusula de Rescisión (€) — Opcional</label>
                <input type="text" inputMode="numeric" placeholder="Ej: 150.000.000" onKeyDown={blockEnterKey} className="w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-blue-400 font-black text-base md:text-sm text-fg text-center placeholder:text-fg-faint" value={releaseClause} onChange={(e) => setReleaseClause(formatMoneyLive(e.target.value))} />
              </div>
            </div>
          </div>

          <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" disabled={isSubmitting} onClick={handleConfirm} className="flex-1 w-full py-4 rounded-xl bg-blue-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 text-center hover:bg-blue-400 transition-all disabled:opacity-50 touch-manipulation">
              {isSubmitting ? 'Guardando...' : (<><Check size={16} className="shrink-0" /> Confirmar Promoción</>)}
            </button>
          </footer>
        </div>
      </div>

      {/* Confirmación de descarte simple, sin bloqueo de scroll del body: su propio backdrop
          usa el mismo guard de touchmove (discardBackdropRef) para no arrastrar la página
          de fondo mientras está abierta. */}
      {showDiscardConfirm && (
        <div ref={discardBackdropRef} className="fixed inset-0 bg-black/90 z-[250] flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-fg">¿Deseas salir?</h3>
            <p className="text-[10px] text-fg-muted mb-6 font-bold uppercase tracking-widest">Se perderán los datos del contrato introducidos.</p>
            <div className="flex gap-3">
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDiscardConfirm(false); }} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all touch-manipulation">Cancelar</button>
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all touch-manipulation">Salir y Descartar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
