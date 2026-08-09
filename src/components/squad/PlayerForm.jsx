import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Camera, RefreshCcw, User, ChevronLeft, ChevronRight, Check, Globe2, Footprints } from 'lucide-react';
import { ALL_POSITIONS } from '../../constants/positions';
import { flagEmoji, findCountryByName, searchCountries } from '../../constants/countries';
import { formatValueInput, parseValue } from '../../utils/format';
import { resizeImageToDataUrl } from '../../utils/image';
import { getCardStyle } from '../../utils/cardStyle';
import { useClubData } from '../../context/ClubDataContext';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { useUiChrome } from '../../context/UiChromeContext';

const STEP_TITLES = ['Identidad', 'Atributos', 'Términos Económicos', 'Revisión Final'];
const TOTAL_STEPS = STEP_TITLES.length;

const FOOT_OPTIONS = [
  { value: 'Diestro', label: 'Diestro', icon: <Footprints size={16} /> },
  { value: 'Zurdo', label: 'Zurdo', icon: <Footprints size={16} className="scale-x-[-1]" /> },
  { value: 'Ambas', label: 'Ambas', icon: (<span className="flex items-center -space-x-1"><Footprints size={13} className="scale-x-[-1]" /><Footprints size={13} /></span>) },
];

// Campos de texto/número compactos, uniformes en toda la tarjeta: 16px (text-base) en
// móvil para evitar el auto-zoom de Safari/Chrome, algo más compactos en escritorio.
const FIELD_BASE = 'w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-black text-base md:text-sm text-fg placeholder:text-fg-faint';
const FIELD_CLASS = `${FIELD_BASE} text-center`;
const SELECT_CLASS = 'w-full h-[52px] bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-center font-black text-base md:text-sm text-fg';

// Evita el auto-zoom agresivo de iOS/Android: por debajo de 16px el navegador móvil
// hace zoom al enfocar el campo. Al perder el foco, recuperamos la posición/escala original.
const resetMobileViewport = () => window.scrollTo(0, 0);

// Ningún campo de este asistente se envía con Enter: no hay <form>, así que Enter no
// tendría efecto por defecto, pero lo bloqueamos explícitamente para que nunca dispare
// un avance de paso ni ninguna acción inesperada mientras el usuario escribe.
const blockEnterKey = (e) => { if (e.key === 'Enter') e.preventDefault(); };

const splitName = (fullName) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

const toFormState = (p) => {
  const { firstName, lastName } = splitName(p?.name);
  const positions = p?.positions || (p?.pos ? [p.pos] : []);
  return {
    firstName, lastName,
    photo: p?.photo || '',
    nationality: p?.nationality || '',
    primaryPosition: positions[0] || '',
    secondaryPositions: positions.slice(1) || [],
    rating: p?.rating ? String(p.rating) : '',
    age: p?.age ? String(p.age) : '',
    preferredFoot: p?.preferredFoot || 'Diestro',
    type: p?.type || 'Comprado',
    marketValue: formatValueInput(String(p?.marketValue || p?.value || '')),
    value: formatValueInput(String(p?.value || '')),
    loanDuration: p?.loanDuration || '1 Temporada',
    originClub: p?.originClub || '',
    potential: p?.potential || '',
    wage: formatValueInput(String(p?.wage || '')),
    releaseClause: formatValueInput(String(p?.releaseClause || '')),
    contractYears: p?.contractYears || '',
  };
};

const emptyPlayer = toFormState(null);
const playerToFormState = toFormState;

// Bloquea el "scroll chaining" hacia la página de fondo cuando el usuario arrastra sobre
// el backdrop del modal (la zona sin contenido scrolleable, fuera de la tarjeta). Usa un
// listener nativo con { passive: false } porque React registra los onTouchMove sintéticos
// como pasivos por defecto y no deja llamar a preventDefault() desde la prop JSX. Solo actúa
// si el toque empezó exactamente sobre el backdrop (e.target === el), nunca si empezó dentro
// de la tarjeta, para no interferir con su scroll interno (overflow-y-auto propio).
function usePreventBackdropTouch(active) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const handleTouchMove = (e) => { if (e.target === el) e.preventDefault(); };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [active]);
  return ref;
}

export default function PlayerForm({ editingPlayer, prefill, sourceScoutId, onClose }) {
  const { addOrUpdatePlayer, deleteScout } = useClubData();
  const { hide: hideChrome, show: showChrome } = useUiChrome();
  useEffect(() => {
    hideChrome();
    return () => showChrome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState(() => toFormState(editingPlayer || prefill || null));
  const initialFormRef = useRef(form);
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showFootMenu, setShowFootMenu] = useState(false);
  const [showNatMenu, setShowNatMenu] = useState(false);
  const [natMenuRect, setNatMenuRect] = useState(null);
  const fileInputRef = useRef(null);
  const footMenuRef = useRef(null);
  const natInputWrapRef = useRef(null);
  const natDropdownRef = useRef(null);
  const natInputRef = useRef(null);
  useOnClickOutside(footMenuRef, () => setShowFootMenu(false), showFootMenu);
  const backdropRef = usePreventBackdropTouch(true);
  const discardBackdropRef = usePreventBackdropTouch(showDiscardConfirm);

  // El desplegable de nacionalidad se pinta con un portal (fuera de la tarjeta, que tiene
  // overflow-hidden para mantener cabecera/pie estáticos) para que nunca quede recortado,
  // sea cual sea la posición del campo dentro del paso. Por eso el "click fuera" necesita
  // comprobar dos refs (el campo Y el propio portal) en vez de uno solo.
  useEffect(() => {
    if (!showNatMenu) return;
    const handler = (e) => {
      if (natInputWrapRef.current?.contains(e.target)) return;
      if (natDropdownRef.current?.contains(e.target)) return;
      setShowNatMenu(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showNatMenu]);

  const selectedCountry = findCountryByName(form.nationality);
  const natMatches = showNatMenu ? searchCountries(form.nationality) : [];
  const openNatMenu = () => {
    const rect = natInputRef.current?.getBoundingClientRect();
    if (rect) setNatMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setShowNatMenu(true);
  };
  const selectNationality = (country) => {
    set({ nationality: country.name });
    setShowNatMenu(false);
    natInputRef.current?.blur();
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // --- Selección de posiciones: onClick directo, sin interceptar el evento. ---
  const selectPrimary = (pos) => {
    set({ primaryPosition: pos, secondaryPositions: pos === 'POR' ? [] : form.secondaryPositions.filter((p) => p !== 'POR' && p !== pos) });
  };
  const toggleSecondary = (pos) => {
    if (pos === form.primaryPosition || pos === 'POR' || form.primaryPosition === 'POR') return;
    set({ secondaryPositions: form.secondaryPositions.includes(pos) ? form.secondaryPositions.filter((p) => p !== pos) : [...form.secondaryPositions, pos] });
  };

  // Formatea los campos monetarios (puntos de miles) sin que el cursor salte al final
  // del texto al editar un dígito en medio del número.
  const formatMoneyField = (field) => (e) => {
    const input = e.target;
    const raw = input.value;
    const cursorPos = input.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/\D/g, '').length;
    const formatted = formatValueInput(raw);
    set({ [field]: formatted });
    requestAnimationFrame(() => {
      if (!input.isConnected) return;
      let seen = 0; let pos = formatted.length;
      if (digitsBeforeCursor === 0) { pos = 0; }
      else {
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) seen++;
          if (seen === digitsBeforeCursor) { pos = i + 1; break; }
        }
      }
      try { input.setSelectionRange(pos, pos); } catch (err) { /* input puede haber perdido el foco */ }
    });
  };

  const handlePhotoChange = async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200, 0.8);
      set({ photo: dataUrl });
    } catch (err) {
      console.error(err);
      setFormError('No se pudo procesar la foto. Inténtalo con otra imagen.');
    } finally {
      setIsUploadingPhoto(false);
      // Permite volver a elegir el mismo archivo más tarde si el usuario lo desea.
      input.value = '';
    }
  };

  const validateStep = (s) => {
    if (s === 1) {
      if (!form.firstName.trim()) return 'El nombre es obligatorio.';
    }
    if (s === 2) {
      if (!form.primaryPosition) return 'Selecciona la posición principal.';
      if (!form.rating || isNaN(form.rating) || form.rating < 1 || form.rating > 99) return 'Media entre 1 y 99.';
      if (!form.age || isNaN(form.age) || form.age < 15 || form.age > 50) return 'Edad entre 15 y 50.';
    }
    if (s === 3) {
      if (!form.marketValue || parseValue(form.marketValue) <= 0) return 'Valor de mercado obligatorio.';
      if (form.type === 'Comprado' && (!form.value || parseValue(form.value) <= 0)) return 'Precio de compra obligatorio.';
      if (form.type === 'Cedido' && !form.originClub.trim()) return 'Club de origen obligatorio.';
      if (form.type === 'Cantera' && form.potential && (isNaN(form.potential) || form.potential < 1 || form.potential > 99)) return 'Potencial entre 1 y 99.';
    }
    return '';
  };

  // --- Navegación: exclusivamente por los botones Anterior/Siguiente del pie. ---
  const goNext = () => {
    const err = validateStep(step);
    if (err) { setFormError(err); return; }
    setFormError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };
  const goPrev = () => { setFormError(''); setStep((s) => Math.max(1, s - 1)); };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setFormError(err); setStep(s); return; }
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      const fullName = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}`;
      await addOrUpdatePlayer({
        name: fullName,
        positions: [form.primaryPosition, ...form.secondaryPositions],
        rating: parseInt(form.rating), age: parseInt(form.age),
        preferredFoot: form.preferredFoot || 'Diestro',
        photo: form.photo || null,
        nationality: form.nationality.trim() || null,
        marketValue: parseValue(form.marketValue), type: form.type,
        value: form.type === 'Comprado' ? parseValue(form.value) : 0,
        loanDuration: form.type === 'Cedido' ? form.loanDuration : null,
        originClub: form.type === 'Cedido' ? form.originClub.trim() : null,
        transferStatus: 'Activo',
        wage: parseValue(form.wage),
        releaseClause: parseValue(form.releaseClause) || null,
        contractYears: form.contractYears ? parseInt(form.contractYears) : null,
        potential: form.type === 'Cantera' && form.potential ? parseInt(form.potential) : null,
      }, editingPlayer?.id);
      if (!editingPlayer && sourceScoutId) {
        try { await deleteScout(sourceScoutId); } catch (err) { console.error(err); }
      }
      onClose();
    } catch (err) {
      setFormError('Error de base de datos.');
      setIsSubmitting(false);
    }
  };

  // --- Cierre: única y exclusivamente disparado por el botón X. ---
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  const handleCloseClick = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };

  const fullNamePreview = `${form.firstName.trim()}${form.lastName.trim() ? ` ${form.lastName.trim()}` : ''}` || 'Nuevo Jugador';

  const contractYearOptions = form.type === 'Cedido'
    ? [{ value: '1', label: 'Cesión 1 Año (1 Temporada)' }, { value: '2', label: 'Cesión 2 Años (2 Temporadas)' }]
    : [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Año${n > 1 ? 's' : ''}` }));

  return (
    <>
      {/* Backdrop: no tiene su propio scroll (no es contenido scrolleable), así que un
          touchmove que empiece aquí se bloquea (usePreventBackdropTouch) para que no arrastre
          la página de la plantilla que sigue debajo — sin tocar document.body en ningún
          momento, para no desajustar las coordenadas táctiles en Safari iOS. */}
      <div ref={backdropRef} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overscroll-contain">
        {/* Tarjeta compacta: flex-col + overflow-hidden en el propio contenedor, para que
            cabecera y pie queden completamente estáticos y solo el cuerpo central (flex-1
            overflow-y-auto) haga scroll, incluso si el teclado se despliega en móvil. */}
        <div className="bg-surface border border-border rounded-[32px] w-full max-w-sm shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden">
          <div className="shrink-0 bg-surface flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
            <h3 className="font-black italic text-green-500 text-sm uppercase">{editingPlayer ? 'Editar Jugador' : 'Fichar Jugador'}</h3>
            <button type="button" onClick={handleCloseClick} className="p-1 text-fg-faint hover:text-fg transition-colors touch-manipulation">
              <X size={18} />
            </button>
          </div>

          <div onScroll={() => setShowNatMenu(false)} className="px-5 pt-4 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
            <div className="mb-4">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
                  <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${n <= step ? 'bg-green-500' : 'bg-well-strong'}`} />
                ))}
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-fg-muted text-center mt-2">Paso {step} de {TOTAL_STEPS} · {STEP_TITLES[step - 1]}</p>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-3 flex gap-2 text-red-400 text-[10px] font-black items-center animate-pulse">
                <ShieldAlert size={14} className="shrink-0" /><span>{formError}</span>
              </div>
            )}

            {/* Solo se monta en el DOM el paso activo: nada oculto por CSS. */}
            <div key={step} className="space-y-4 pb-4 animate-in fade-in slide-in-from-right-4 duration-300">
              {step === 1 && (
                <>
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="relative group cursor-pointer" onClick={() => { if (!isUploadingPhoto) fileInputRef.current?.click(); }}>
                      {form.photo ? (
                        <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full border-2 border-border object-cover shadow-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-well border-2 border-dashed border-border flex flex-col items-center justify-center text-fg-muted hover:border-green-500 hover:text-green-500 transition-all">
                          <User size={26} />
                        </div>
                      )}
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
                      <button type="button" disabled={isUploadingPhoto} className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation">
                        {isUploadingPhoto ? <RefreshCcw size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
                      </button>
                    </div>
                    <span className="text-[9px] text-fg-faint font-black uppercase tracking-widest">Foto / Avatar (opcional)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Nombre *</label>
                      <input type="text" required autoComplete="off" placeholder="Erling" onKeyDown={blockEnterKey} className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Apellido</label>
                      <input type="text" autoComplete="off" placeholder="Haaland" onKeyDown={blockEnterKey} className="w-full bg-well p-4 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1 relative" ref={natInputWrapRef}>
                    <label className="text-[9px] font-black text-fg-muted ml-1">Nacionalidad</label>
                    <div className="relative">
                      {selectedCountry ? (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none">{flagEmoji(selectedCountry.code)}</span>
                      ) : (
                        <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" size={16} />
                      )}
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Ej: Noruega"
                        onKeyDown={blockEnterKey}
                        className="w-full bg-well p-4 pl-11 rounded-xl outline-none border border-border-subtle focus:border-green-500 font-bold placeholder:text-fg-faint text-fg text-base md:text-sm"
                        ref={natInputRef}
                        value={form.nationality}
                        onChange={(e) => { set({ nationality: e.target.value }); openNatMenu(); }}
                        onFocus={openNatMenu}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-fg-muted ml-1">Posición Principal *</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                      {ALL_POSITIONS.map((pos) => (
                        <button key={pos} type="button" onClick={() => selectPrimary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.primaryPosition === pos ? 'bg-green-500 text-black shadow-lg shadow-green-500/30' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.primaryPosition && form.primaryPosition !== 'POR' && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Posiciones Secundarias</label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-well rounded-xl border border-border-subtle">
                        {ALL_POSITIONS.filter((pos) => pos !== 'POR' && pos !== form.primaryPosition).map((pos) => (
                          <button key={pos} type="button" onClick={() => toggleSecondary(pos)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.secondaryPositions.includes(pos) ? 'bg-green-500/80 text-black shadow-lg shadow-green-500/20' : 'bg-well-strong text-fg-muted border border-border-subtle'}`}>
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Media *</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" required placeholder="90" min="1" max="99" onBlur={resetMobileViewport} onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.rating} onChange={(e) => set({ rating: e.target.value })} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Edad *</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" required placeholder="23" min="15" max="50" onBlur={resetMobileViewport} onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.age} onChange={(e) => set({ age: e.target.value })} />
                    </div>
                    <div className="space-y-1 relative" ref={footMenuRef}>
                      <label className="text-[9px] font-black text-fg-muted ml-1">Pierna</label>
                      <button type="button" onClick={() => setShowFootMenu((o) => !o)} className="w-full h-[52px] bg-well p-2 rounded-xl outline-none border border-border-subtle flex flex-col items-center justify-center gap-0.5 font-black text-fg touch-manipulation">
                        {FOOT_OPTIONS.find((f) => f.value === form.preferredFoot)?.icon}
                        <span className="text-[8px] uppercase tracking-wide">{form.preferredFoot}</span>
                      </button>
                      {showFootMenu && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-[45] animate-in fade-in slide-in-from-top-2 duration-150 p-1">
                          {FOOT_OPTIONS.map((opt) => (
                            <button key={opt.value} type="button" onClick={() => { set({ preferredFoot: opt.value }); setShowFootMenu(false); }} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[9px] font-black uppercase transition-all touch-manipulation ${form.preferredFoot === opt.value ? 'bg-green-500/10 text-green-500' : 'text-fg-secondary hover:bg-well'}`}>
                              {opt.icon} {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-fg-muted ml-1">Tipo de Adquisición</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => set({ type: 'Cantera', contractYears: '' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${form.type === 'Cantera' ? 'bg-emerald-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cantera</button>
                      <button type="button" onClick={() => set({ type: 'Cedido', contractYears: '' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${form.type === 'Cedido' ? 'bg-yellow-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Cedido</button>
                      <button type="button" onClick={() => set({ type: 'Comprado', contractYears: '' })} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all touch-manipulation ${form.type === 'Comprado' ? 'bg-blue-600 text-white' : 'bg-well text-fg-muted hover:bg-well-strong'}`}>Comprado</button>
                    </div>
                  </div>
                  {form.type === 'Cantera' && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Potencial (1-99)</label>
                      <input type="number" min="1" max="99" placeholder="Ej: 88" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.potential} onChange={(e) => set({ potential: e.target.value })} />
                    </div>
                  )}
                  {form.type === 'Comprado' && (
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Precio de Compra (€) *</label>
                      <input type="text" inputMode="numeric" required placeholder="Ej: 50.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.value} onChange={formatMoneyField('value')} />
                    </div>
                  )}
                  {form.type === 'Cedido' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Duración Cesión</label>
                        <select className={SELECT_CLASS} value={form.loanDuration} onChange={(e) => set({ loanDuration: e.target.value })}>
                          <option value="6 Meses">6 Meses</option>
                          <option value="1 Temporada">1 Temporada</option>
                          <option value="2 Temporadas">2 Temporadas</option>
                        </select>
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black text-fg-muted ml-1">Club de Origen *</label>
                        <input type="text" required placeholder="Ej: Real Madrid" onKeyDown={blockEnterKey} className={FIELD_BASE} value={form.originClub} onChange={(e) => set({ originClub: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Valor de Mercado (€) *</label>
                      <input type="text" inputMode="numeric" required placeholder="Ej: 80.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.marketValue} onChange={formatMoneyField('marketValue')} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Sueldo Anual (€)</label>
                      <input type="text" inputMode="numeric" placeholder="Ej: 5.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.wage} onChange={formatMoneyField('wage')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Cláusula (€)</label>
                      <input type="text" inputMode="numeric" placeholder="Ej: 150.000.000" onKeyDown={blockEnterKey} className={FIELD_CLASS} value={form.releaseClause} onChange={formatMoneyField('releaseClause')} />
                    </div>
                    <div className="space-y-1 relative">
                      <label className="text-[9px] font-black text-fg-muted ml-1">Años Contrato</label>
                      <select className={SELECT_CLASS} value={form.contractYears} onChange={(e) => set({ contractYears: e.target.value })}>
                        <option value="">Seleccionar</option>
                        {contractYearOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <div className="flex flex-col items-center">
                  <div className={`relative w-52 rounded-[28px] p-5 shadow-2xl border-2 border-black/10 ${getCardStyle(parseInt(form.rating) || 0)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-4xl font-black">{form.rating}</span>
                        <span className="text-[10px] font-black uppercase mt-1 tracking-wider">{form.primaryPosition}</span>
                      </div>
                      {form.nationality && (
                        <div className="flex items-center gap-1 bg-black/10 pl-1 pr-2 py-1 rounded-full max-w-[110px]">
                          <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px] leading-none shrink-0 overflow-hidden">{selectedCountry ? flagEmoji(selectedCountry.code) : '🌍'}</span>
                          <span className="text-[8px] font-black uppercase truncate">{form.nationality}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center my-3">
                      {form.photo ? (
                        <img src={form.photo} alt="Foto" className="w-20 h-20 rounded-full object-cover border-4 border-black/10 shadow-lg" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-black/10 flex items-center justify-center border-4 border-black/10"><User size={30} /></div>
                      )}
                    </div>
                    <div className="text-center font-black uppercase italic text-sm tracking-tight border-t border-black/10 pt-2 truncate">{fullNamePreview}</div>
                    {form.secondaryPositions.length > 0 && <div className="text-center text-[9px] font-bold uppercase opacity-70 mt-0.5 truncate">{form.secondaryPositions.join(' · ')}</div>}
                  </div>

                  <div className="w-full mt-4 bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
                    <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Edad</span><span className="text-xs font-black text-fg">{form.age} Años</span></div>
                    <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Adquisición</span><span className="text-xs font-black text-fg">{form.type}{form.type === 'Cedido' && form.originClub ? ` · ${form.originClub}` : ''}</span></div>
                    <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Valor de Mercado</span><span className="text-xs font-black text-green-500">{form.marketValue || '0'} €</span></div>
                    {form.wage && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Sueldo Anual</span><span className="text-xs font-black text-fg">{form.wage} €</span></div>}
                    {form.releaseClause && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Cláusula</span><span className="text-xs font-black text-fg">{form.releaseClause} €</span></div>}
                    {form.contractYears && <div className="flex justify-between px-4 py-2.5"><span className="text-[9px] font-black uppercase text-fg-muted">Contrato</span><span className="text-xs font-black text-fg">{form.contractYears} Años</span></div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {step > 1 && (
              <button type="button" onClick={goPrev} className="flex-1 py-4 rounded-xl bg-well-strong text-fg font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:brightness-125 transition-all touch-manipulation">
                <ChevronLeft size={16} /> Anterior
              </button>
            )}
            {step < TOTAL_STEPS && (
              <button type="button" onClick={goNext} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all touch-manipulation">
                Siguiente <ChevronRight size={16} />
              </button>
            )}
            {step === TOTAL_STEPS && (
              <button type="button" disabled={isSubmitting} onClick={handleConfirm} className="flex-1 py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50 touch-manipulation">
                {isSubmitting ? 'Guardando...' : (<><Check size={16} /> Confirmar Fichaje</>)}
              </button>
            )}
          </footer>
        </div>
      </div>

      {/* Portal: el desplegable de nacionalidad se pinta fuera de la tarjeta (que tiene
          overflow-hidden) para que nunca quede recortado, con posición fixed calculada a
          partir del propio input. Se cierra automáticamente si el usuario hace scroll dentro
          del paso, para no quedar desalineado del campo. */}
      {showNatMenu && natMatches.length > 0 && natMenuRect && createPortal(
        <div
          ref={natDropdownRef}
          style={{ position: 'fixed', top: natMenuRect.top, left: natMenuRect.left, width: natMenuRect.width }}
          className="bg-surface border border-border rounded-xl shadow-2xl overflow-y-auto max-h-48 no-scrollbar z-[300] animate-in fade-in slide-in-from-top-2 duration-150 p-1"
        >
          {natMatches.map((country) => (
            <button key={country.code} type="button" onClick={() => selectNationality(country)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-fg-secondary hover:bg-well transition-all touch-manipulation">
              <span className="text-base leading-none w-5 text-center shrink-0">{flagEmoji(country.code)}</span> {country.name}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Confirmación de descarte simple, sin bloqueo de scroll del body: su propio backdrop
          usa el mismo guard de touchmove (discardBackdropRef) para no arrastrar la página
          de fondo mientras está abierta. */}
      {showDiscardConfirm && (
        <div ref={discardBackdropRef} className="fixed inset-0 bg-black/90 z-[250] flex items-center justify-center p-4 overscroll-contain">
          <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm text-center shadow-2xl">
            <ShieldAlert className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black uppercase italic mb-2 text-fg">¿Deseas salir?</h3>
            <p className="text-[10px] text-fg-muted mb-6 font-bold uppercase tracking-widest">Se perderán los datos introducidos del jugador.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDiscardConfirm(false)} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all touch-manipulation">Cancelar</button>
              <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl bg-red-500 text-black font-black uppercase text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all touch-manipulation">Salir y Descartar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { emptyPlayer, playerToFormState };
