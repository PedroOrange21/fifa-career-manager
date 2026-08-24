import { useEffect, useRef, useState } from 'react';
import { X, Check, ShieldAlert, RefreshCcw, GraduationCap, CopyX, Trash2, Pencil, ChevronDown, AlertTriangle, ScanLine, Info, ImageOff, Camera, PenLine } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import { getCardStyle } from '../../utils/cardStyle';
import { buildPlayerPayload } from '../../utils/playerPayload';
import { findDuplicatePlayer } from '../../utils/duplicatePlayer';
import { formatValueInput, formatMoneyLiveWithCursor, parseValue } from '../../utils/format';
import { ALL_POSITIONS } from '../../constants/positions';
import Dropdown from '../common/Dropdown';
import ScanPlayerCardModal from './ScanPlayerCardModal';

const POSITION_OPTIONS = ALL_POSITIONS.map((p) => ({ value: p, label: p }));
const TYPE_OPTIONS = [
  { value: 'Inicial', label: 'Ya en el Club' },
  { value: 'Comprado', label: 'Comprado' },
  { value: 'Cedido', label: 'Cedido' },
  // Cesión SALIENTE: el jugador sigue siendo nuestro (se guarda como "Comprado" internamente),
  // pero su transferStatus nace en "CedidoFuera" con el club de destino — ver esCesionSaliente
  // en api/scan-player.js y su mapeo en mapScanResultToPrefill.
  { value: 'CedidoFuera', label: 'Cedido Fuera' },
];

const FIELD_CLASS = 'w-full bg-well-strong p-2 rounded-lg outline-none border border-border-subtle focus:border-green-500 font-bold text-[11px] text-fg placeholder:text-fg-faint';
const FIELD_CLASS_ERROR = 'w-full bg-well-strong p-2 rounded-lg outline-none border border-red-500 focus:border-red-500 font-bold text-[11px] text-fg placeholder:text-fg-faint';

let rowIdCounter = 0;
const nextRowId = () => `row-${Date.now()}-${rowIdCounter++}`;

// Construye una fila editable de la tabla de revisión a partir de un resultado de escaneo, o de
// un hueco vacío para una foto que falló del todo (ver scanStatus 'failed') — en ambos casos
// queda lista para completarse/corregirse a mano antes de guardar. "propertyDefault" decide
// cómo arranca clasificada una tarjeta "Comprado" normal según el punto de entrada: Onboarding
// la preasigna a "Inicial" (Ya en el Club, nunca una compra real dentro de la app); Plantilla la
// deja en "Comprado". Cedido y Cantera siempre respetan lo que ya determinó la IA, el usuario
// puede cambiarlo de todas formas con el selector de tipo.
function buildRow(prefill, { status = 'ok', fileName = '', propertyDefault = 'Comprado', file = null, error = '' } = {}) {
  const isCantera = prefill.type === 'Cantera';
  const isCedido = prefill.type === 'Cedido';
  const isCedidoFuera = prefill.transferStatus === 'CedidoFuera';
  return {
    id: nextRowId(),
    fileName: fileName || prefill.fileName || '',
    scanStatus: status, // 'ok' | 'partial' | 'failed'
    // Solo las filas 'failed' conservan el File original — es lo que permite mostrar la
    // miniatura de la foto que no se pudo leer, tanto en la tarjeta compacta de "Fotos No
    // Reconocidas" como dentro del propio panel de edición al completarla a mano. "error" es el
    // motivo técnico exacto devuelto por el servidor (ver api/scan-player.js, diagnóstico
    // transparente) — se muestra en pequeño bajo la tarjeta en vez de un "no leída" sin más.
    file,
    error,
    previewUrl: file ? URL.createObjectURL(file) : '',
    // "Rellenar a mano" (ver FailedPhotoCard) promueve una fila 'failed' a la lista principal
    // de edición completa sin cambiar su scanStatus (sigue siendo "de origen fallido" a efectos
    // informativos) — mientras sea false, la fila vive en la sección de fotos no reconocidas.
    manualFill: false,
    reclassified: !!prefill.reclassified,
    name: prefill.name || '',
    rating: prefill.rating != null ? String(prefill.rating) : '',
    positions: prefill.positions?.length ? prefill.positions : [],
    age: prefill.age != null ? String(prefill.age) : '',
    nationality: prefill.nationality || '',
    preferredFoot: prefill.preferredFoot || 'Diestro',
    potential: prefill.potential || '',
    marketValue: formatValueInput(String(prefill.marketValue || '')),
    wage: formatValueInput(String(prefill.wage || '')),
    reviewType: isCantera ? 'Cantera' : isCedido ? 'Cedido' : isCedidoFuera ? 'CedidoFuera' : propertyDefault,
    sourceClub: prefill.sourceClub || '',
    value: formatValueInput(String(prefill.value || '')),
    originClub: prefill.originClub || '',
    loanDuration: prefill.loanDuration || '1 Temporada',
    // Cesión saliente: club de destino y duración, separados de originClub/loanDuration (que son
    // de la cesión ENTRANTE) para no mezclar ambas direcciones en la misma fila.
    outboundClub: prefill.outboundLoan?.destinationClub || '',
    outboundDuration: prefill.outboundLoan?.duration || '1 Temporada',
    // Las 'failed' arrancan colapsadas: viven como tarjeta compacta en "Fotos No Reconocidas"
    // (ver FailedPhotoCard) hasta que "Rellenar a Mano" las promueve a la lista principal ya
    // desplegadas — no tiene sentido mostrar de entrada un formulario vacío por cada foto que
    // falló, solo abruma la pantalla.
    expanded: status === 'partial',
  };
}

const buildRowsFromResults = (results, mode, propertyDefault) => {
  const ok = (results?.succeeded || []).map((r) => buildRow(r, { status: r.name?.trim() ? 'ok' : 'partial', fileName: r.fileName, propertyDefault }));
  const bad = (results?.failed || []).map((f) => buildRow({ type: mode === 'academia' ? 'Cantera' : 'Comprado', positions: [] }, { status: 'failed', fileName: f.fileName, propertyDefault, file: f.file || null, error: f.error || '' }));
  return [...ok, ...bad];
};

// Campos obligatorios por tipo de fila, usados tanto para el resaltado en rojo como para
// bloquear "Confirmar y Guardar Todo" hasta que se completen — Cantera y "Ya en el Club" nunca
// exigen club de procedencia ni precio (ver requisitos del sistema).
const getRowErrors = (r) => {
  const errors = {};
  if (!r.name.trim()) errors.name = true;
  if (r.reviewType === 'Comprado') {
    if (!r.sourceClub.trim()) errors.sourceClub = true;
    if (!r.value || parseValue(r.value) <= 0) errors.value = true;
  }
  if (r.reviewType === 'Cedido' && !r.originClub.trim()) errors.originClub = true;
  if (r.reviewType === 'CedidoFuera' && !r.outboundClub.trim()) errors.outboundClub = true;
  return errors;
};

// Fila completa de la tabla de revisión: vista compacta (badge + nombre + estado) siempre
// visible, con un panel de edición desplegable (lápiz) para corregir cualquier dato leído por
// la IA, completar una lectura parcial/fallida a mano, o cambiar el tipo de operación con sus
// campos correspondientes. Definida fuera del componente principal (identidad estable entre
// renders) para no perder el foco de los inputs en cada pulsación de tecla.
function ReviewTableRow({ r, mode, isOut, isDuplicate, existingMatch, onToggleExclude, onToggleExpand, onUpdate, onRemove, onRetry }) {
  const errors = getRowErrors(r);
  const hasErrors = Object.keys(errors).length > 0;
  const primaryPosition = r.positions?.[0] || '';

  return (
    <div className={`transition-opacity ${isOut ? 'opacity-40' : ''}`}>
      <div className="w-full px-3 py-2.5 flex items-center gap-2.5">
        <button type="button" onClick={() => onToggleExclude(r.id)} disabled={r.scanStatus === 'failed' && r.name.trim() === ''} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors touch-manipulation ${isOut ? 'border-border-subtle' : 'border-green-500 bg-green-500'}`}>
          {!isOut && <Check size={12} className="text-black" />}
        </button>
        <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(parseInt(r.rating) || 0)}`}>
          <span className="text-[6px] opacity-70 font-bold">{primaryPosition || '—'}</span><span className="text-[11px]">{r.rating || '—'}</span>
        </div>
        <button type="button" onClick={() => onToggleExpand(r.id)} className="min-w-0 flex-1 text-left touch-manipulation">
          <div className="text-xs font-black text-fg truncate">{r.name || 'Sin nombre — toca para completar'}</div>
          {isDuplicate ? (
            <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-wide truncate">Jugador ya registrado / omitido por duplicado</div>
          ) : r.scanStatus === 'failed' ? (
            <div className="text-[9px] font-bold text-red-400 uppercase tracking-wide truncate">⚠️ Imagen no reconocida — completa a mano</div>
          ) : r.scanStatus === 'partial' ? (
            <div className="text-[9px] font-bold text-yellow-500 uppercase tracking-wide truncate">⚠️ Lectura parcial — revisa los datos</div>
          ) : r.reclassified ? (
            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide truncate">Canterano detectado (se moverá a Academia)</div>
          ) : (
            <div className="text-[9px] font-bold text-fg-faint uppercase tracking-wide truncate">
              {mode === 'academia' || r.reviewType === 'Cantera' ? `${primaryPosition || '—'} · Pot. ${r.potential || '—'} · ${r.age || '—'} Años` : `${primaryPosition || '—'} · ${TYPE_OPTIONS.find((t) => t.value === r.reviewType)?.label || r.reviewType} · ${r.age || '—'} Años`}
            </div>
          )}
        </button>
        <button type="button" onClick={() => onToggleExpand(r.id)} title="Editar fila" className={`shrink-0 p-1.5 rounded-lg transition-colors touch-manipulation ${hasErrors ? 'text-red-400' : 'text-fg-faint hover:text-fg'}`}>
          {hasErrors ? <AlertTriangle size={14} /> : <Pencil size={14} />}
        </button>
        <button type="button" onClick={() => onRemove(r.id)} title="Eliminar fila" className="shrink-0 p-1.5 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation">
          <Trash2 size={14} />
        </button>
      </div>

      {r.expanded && (
        <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {isDuplicate && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2 rounded-lg flex gap-1.5 text-yellow-500 text-[9px] font-bold items-start">
              <CopyX size={12} className="shrink-0 mt-0.5" /><span>Coincide con «{existingMatch.name}», ya en tu plantilla ({existingMatch.positions?.[0] || '—'}{existingMatch.age ? `, ${existingMatch.age} años` : ''}). Se dejará sin marcar salvo que la incluyas a propósito.</span>
            </div>
          )}
          {r.scanStatus === 'failed' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {r.previewUrl ? (
                  <img src={r.previewUrl} alt="Foto original no reconocida" className="w-14 h-14 rounded-lg object-cover border border-border-subtle shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-well-strong border border-border-subtle flex items-center justify-center shrink-0 text-fg-faint"><ImageOff size={18} /></div>
                )}
                <button type="button" onClick={() => onRetry(r.id)} className="flex-1 h-14 rounded-lg border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest touch-manipulation">
                  <RefreshCcw size={12} /> Reintentar Escaneo
                </button>
              </div>
              {/* Diagnóstico transparente: el motivo técnico exacto devuelto por el servidor. */}
              {r.error && <p className="text-[8px] font-bold text-fg-faint ml-1">{r.error}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Nombre</label>
              <input type="text" className={errors.name ? FIELD_CLASS_ERROR : FIELD_CLASS} value={r.name} onChange={(e) => onUpdate(r.id, { name: e.target.value })} placeholder="Nombre del jugador" />
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Posición</label>
              <Dropdown value={primaryPosition} options={POSITION_OPTIONS} onChange={(v) => onUpdate(r.id, { positions: [v, ...r.positions.slice(1).filter((p) => p !== v)] })} labelClassName="text-[10px]" placeholder="Posición" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Media (OVR)</label>
              <input type="number" inputMode="numeric" min="1" max="99" className={FIELD_CLASS} value={r.rating} onChange={(e) => onUpdate(r.id, { rating: e.target.value })} placeholder="Ej: 78" />
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Edad</label>
              <input type="number" inputMode="numeric" min="14" max="50" className={FIELD_CLASS} value={r.age} onChange={(e) => onUpdate(r.id, { age: e.target.value })} placeholder="Ej: 23" />
            </div>
          </div>

          {r.reviewType === 'Cantera' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Potencial</label>
                <input type="text" className={FIELD_CLASS} value={r.potential} onChange={(e) => onUpdate(r.id, { potential: e.target.value })} placeholder="Ej: 75-94" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Valor Mercado (€)</label>
                <input type="text" inputMode="numeric" className={FIELD_CLASS} value={r.marketValue} onChange={(e) => formatMoneyLiveWithCursor(e.target, (v) => onUpdate(r.id, { marketValue: v }))} placeholder="Ej: 2.000.000" />
              </div>
            </div>
          ) : (
            <>
              {/* Selector de tipo: solo para filas de Primer Equipo (Cantera nunca cambia de
                  tipo aquí — un canterano reclasificado siempre se guarda en Academia). */}
              <div className="space-y-0.5">
                <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Tipo de Operación</label>
                <div className="flex gap-1.5">
                  {TYPE_OPTIONS.map((t) => (
                    <button key={t.value} type="button" onClick={() => onUpdate(r.id, { reviewType: t.value })} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${r.reviewType === t.value ? (t.value === 'Cedido' ? 'bg-yellow-600 text-white border-yellow-600' : t.value === 'Inicial' ? 'bg-zinc-500 text-white border-zinc-500' : t.value === 'CedidoFuera' ? 'bg-purple-600 text-white border-purple-600' : 'bg-blue-600 text-white border-blue-600') : 'bg-well text-fg-muted border-border-subtle'}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Valor Mercado (€)</label>
                  <input type="text" inputMode="numeric" className={FIELD_CLASS} value={r.marketValue} onChange={(e) => formatMoneyLiveWithCursor(e.target, (v) => onUpdate(r.id, { marketValue: v }))} placeholder="Ej: 20.000.000" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Sueldo Semanal (€)</label>
                  <input type="text" inputMode="numeric" className={FIELD_CLASS} value={r.wage} onChange={(e) => formatMoneyLiveWithCursor(e.target, (v) => onUpdate(r.id, { wage: v }))} placeholder="Ej: 100.000" />
                </div>
              </div>
              {r.reviewType === 'Comprado' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Club de Procedencia {errors.sourceClub && <span className="text-red-400">· Requerido</span>}</label>
                    <input type="text" className={errors.sourceClub ? FIELD_CLASS_ERROR : FIELD_CLASS} value={r.sourceClub} onChange={(e) => onUpdate(r.id, { sourceClub: e.target.value })} placeholder="Ej: Sporting Gijón" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Precio Traspaso (€) {errors.value && <span className="text-red-400">· Requerido</span>}</label>
                    <input type="text" inputMode="numeric" className={errors.value ? FIELD_CLASS_ERROR : FIELD_CLASS} value={r.value} onChange={(e) => formatMoneyLiveWithCursor(e.target, (v) => onUpdate(r.id, { value: v }))} placeholder="Ej: 5.000.000" />
                  </div>
                </div>
              )}
              {r.reviewType === 'Cedido' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Club de Origen {errors.originClub && <span className="text-red-400">· Requerido</span>}</label>
                    <input type="text" className={errors.originClub ? FIELD_CLASS_ERROR : FIELD_CLASS} value={r.originClub} onChange={(e) => onUpdate(r.id, { originClub: e.target.value })} placeholder="Ej: Real Madrid" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Duración Cesión</label>
                    <input type="text" className={FIELD_CLASS} value={r.loanDuration} onChange={(e) => onUpdate(r.id, { loanDuration: e.target.value })} placeholder="Ej: 11 Meses" />
                  </div>
                </div>
              )}
              {r.reviewType === 'CedidoFuera' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Club Destino {errors.outboundClub && <span className="text-red-400">· Requerido</span>}</label>
                    <input type="text" className={errors.outboundClub ? FIELD_CLASS_ERROR : FIELD_CLASS} value={r.outboundClub} onChange={(e) => onUpdate(r.id, { outboundClub: e.target.value })} placeholder="Ej: Almería" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black text-fg-muted ml-1 uppercase">Duración Cesión</label>
                    <input type="text" className={FIELD_CLASS} value={r.outboundDuration} onChange={(e) => onUpdate(r.id, { outboundDuration: e.target.value })} placeholder="Ej: 11 Meses" />
                  </div>
                </div>
              )}
            </>
          )}
          <button type="button" onClick={() => onToggleExpand(r.id)} className="w-full flex items-center justify-center gap-1 py-1.5 text-[8px] font-black uppercase tracking-widest text-fg-faint hover:text-fg-secondary transition-colors touch-manipulation">
            Listo <ChevronDown size={11} className="rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}

// Grupo de filas con cabecera opcional (usado para separar Primer Equipo / Academia cuando un
// lote sale mixto — ver requisito de "organiza la revisión por secciones").
function ReviewSection({ title, icon: Icon, rows, mode, duplicateOf, existingMatches, excluded, onToggleExclude, onToggleExpand, onUpdate, onRemove, onRetry }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-fg-muted">
          {Icon && <Icon size={12} className="shrink-0" />} {title} ({rows.length})
        </div>
      )}
      <div className="bg-well rounded-2xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
        {rows.map((r) => (
          <ReviewTableRow
            key={r.id}
            r={r}
            mode={mode}
            isOut={excluded.has(r.id)}
            isDuplicate={!!duplicateOf[r.id]}
            existingMatch={existingMatches[r.id]}
            onToggleExclude={onToggleExclude}
            onToggleExpand={onToggleExpand}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}

// Tarjeta compacta de una foto que la IA no pudo leer en absoluto: miniatura de la foto
// original (para que el usuario identifique a qué jugador correspondía) + tres acciones — nunca
// arranca con un formulario vacío desplegado, eso queda solo para cuando el usuario elige
// "Rellenar a Mano" (que la promueve a la lista principal de edición completa, ver
// handleManualFill). Vive en su propia sección "Fotos No Reconocidas" al fondo de la revisión,
// separada de los jugadores ya leídos con éxito.
function FailedPhotoCard({ r, onRetry, onManualFill, onRemove }) {
  return (
    <div className="bg-well rounded-2xl border border-red-500/20 p-3 flex items-center gap-3">
      {r.previewUrl ? (
        <img src={r.previewUrl} alt="Foto no reconocida" className="w-14 h-14 rounded-xl object-cover border border-border-subtle shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-well-strong border border-border-subtle flex items-center justify-center shrink-0 text-fg-faint"><ImageOff size={20} /></div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[9px] font-black text-red-400 uppercase tracking-wide truncate">⚠️ Foto No Reconocida</p>
        {/* Diagnóstico transparente: el motivo técnico exacto devuelto por el servidor (ver
            api/scan-player.js), para saber qué respondió Google en vez de un "no leída" a
            secas. */}
        {r.error && <p className="text-[8px] font-bold text-fg-faint truncate">{r.error}</p>}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onRetry(r.id)} title="Repetir foto" className="flex-1 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-widest touch-manipulation">
            <Camera size={11} /> Repetir
          </button>
          <button type="button" onClick={() => onManualFill(r.id)} title="Rellenar a mano" className="flex-1 py-1.5 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-widest touch-manipulation">
            <PenLine size={11} /> A Mano
          </button>
          <button type="button" onClick={() => onRemove(r.id)} title="Descartar" className="shrink-0 p-2 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Paso final de la carga masiva con IA (varias fotos escaneadas en cola por
// scanPlayerCardsQueue, ver ScanPlayerCardModal): tabla de revisión INTERACTIVA con lo que
// Gemini extrajo de cada foto — reutilizada por PlayerList, AcademyTab y los dos bloques de
// carga masiva de OnboardingWizard, cada uno con su propio "propertyDefault"/
// "skipInitialTransaction" según el punto de entrada (ver comentario de buildRow más arriba).
// - mode: 'primerEquipo' | 'academia' — decide si puede haber sección de Academia separada
//   (lote mixto) y qué campos secundarios se muestran en modo lectura.
// - results: { succeeded: [prefill, ...], failed: [{fileName, error}, ...] }. Los fallos
//   también se convierten en filas editables (scanStatus: 'failed'), no se pierden en un
//   simple contador: el usuario puede completarlas a mano o borrarlas con la papelera.
// - propertyDefault: 'Inicial' (Ya en el Club) o 'Comprado' — clasificación inicial de las
//   filas de Primer Equipo que la IA detectó como "en propiedad" (ni cesión ni Academia).
// - skipInitialTransaction: idéntico al de PlayerForm, pasado tal cual a addOrUpdatePlayer.
// - academyStepHint: texto opcional añadido entre paréntesis al aviso de canteranos
//   redirigidos a Academia (ej. "podrás revisarlo en el Paso 5"), usado por OnboardingWizard
//   para referenciar su propio paso — el resto de puntos de entrada lo dejan sin definir.
// - confirmLabel: texto del botón final, "Confirmar y Guardar Todo" por defecto; OnboardingWizard
//   pasa "Confirmar y Guardar Plantilla" para su propia carga inicial.
export default function BulkScanReviewModal({ mode = 'primerEquipo', results, propertyDefault = 'Comprado', skipInitialTransaction = false, academyStepHint = '', confirmLabel = 'Confirmar y Guardar Todo', onClose, onSaved }) {
  useBodyScrollLock();
  useAutoHideChrome();
  const { players, addOrUpdatePlayer } = useClubData();
  // 'addMore' (seguir escaneando más fotos, se anexan como filas nuevas) o { retryRowId } (re-
  // escanear UNA foto que falló, sustituye esa fila concreta manteniendo su id) — nunca ambos a
  // la vez, así que basta un único slot en vez de dos banderas independientes.
  const [rescanTarget, setRescanTarget] = useState(null);

  // Un único cálculo inicial (rows + duplicados detectados de entrada) para que ambos estados
  // arranquen sincronizados con los mismos ids de fila — construir "rows" dos veces por
  // separado generaría ids distintos entre sí (nextRowId() es un contador global).
  const [initial] = useState(() => {
    const allRows = buildRowsFromResults(results, mode, propertyDefault);
    const dupSet = new Set();
    allRows.forEach((r, i) => {
      if (r.scanStatus === 'failed') return;
      if (findDuplicatePlayer(r, [...players, ...allRows.slice(0, i)])) dupSet.add(r.id);
    });
    return { rows: allRows, excluded: dupSet };
  });
  const [rows, setRows] = useState(initial.rows);
  const [excluded, setExcluded] = useState(initial.excluded);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [saveError, setSaveError] = useState('');
  // Aviso de guardado parcial (ver handleSaveAll): { savedCount, remainingCount } cuando quedan
  // fotos sin resolver tras confirmar, o null el resto del tiempo.
  const [rescuePrompt, setRescuePrompt] = useState(null);

  // Las miniaturas de las filas fallidas son Object URLs (ver buildRow): se liberan al
  // desmontar el modal para no acumular memoria en una sesión con muchas fotos. rowsRef se
  // mantiene sincronizado con el último "rows" en cada render para que el cleanup (que solo se
  // registra una vez, al montar) libere siempre el estado real en el momento del desmontaje, no
  // una foto fija del primer render.
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => () => {
    rowsRef.current.forEach((r) => { if (r.previewUrl) URL.revokeObjectURL(r.previewUrl); });
  }, []);

  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggleExpand = (id) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, expanded: !r.expanded } : r)));
  const toggleExclude = (id) => setExcluded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const removeRow = (id) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
    setExcluded((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };
  // Igual que removeRow, pero para varias filas de golpe tras un guardado (ver handleSaveAll):
  // una fila "Rellenar a Mano" ya guardada puede seguir arrastrando su previewUrl original, hay
  // que liberarlo aquí también para no dejarlo colgado en memoria.
  const removeSavedRows = (ids) => {
    setRows((prev) => {
      prev.forEach((r) => { if (ids.includes(r.id) && r.previewUrl) URL.revokeObjectURL(r.previewUrl); });
      return prev.filter((r) => !ids.includes(r.id));
    });
  };
  // "Rellenar a Mano" (ver FailedPhotoCard): promueve la fila fallida a la lista principal, ya
  // desplegada para escribir directamente — sigue siendo scanStatus 'failed' (para conservar el
  // aviso "completa a mano" dentro de su propio panel), pero manualFill:true la saca de la
  // sección de fotos no reconocidas y la deja participar en el guardado como cualquier otra.
  const handleManualFill = (id) => updateRow(id, { manualFill: true, expanded: true });

  // "Añadir más fotos/jugadores": anexa las filas del nuevo escaneo a las ya existentes (nunca
  // las sustituye) para poder seguir cargando capturas antes de confirmar todo junto. Los
  // duplicados del nuevo lote (contra la plantilla real y contra TODAS las filas ya en la
  // tabla, incluida la recién añadida) se excluyen automáticamente, igual que en la carga
  // inicial.
  const handleAddMoreExtracted = (batchResults) => {
    setRescanTarget(null);
    const newRows = buildRowsFromResults(batchResults, mode, propertyDefault);
    const dupIds = new Set();
    newRows.forEach((r, i) => {
      if (r.scanStatus === 'failed') return;
      if (findDuplicatePlayer(r, [...players, ...rows, ...newRows.slice(0, i)])) dupIds.add(r.id);
    });
    setRows((prev) => [...prev, ...newRows]);
    if (dupIds.size) setExcluded((prev) => new Set([...prev, ...dupIds]));
  };

  // "Reintentar Escaneo" en una fila fallida: re-escanea UNA foto y sustituye esa fila en su
  // sitio (mismo id, así conserva su posición y su estado de exclusión) en vez de añadir una
  // fila nueva. Si el reintento TAMBIÉN falla, se actualiza igualmente con la foto y el motivo
  // técnico nuevos (nunca se deja el mensaje de error obsoleto del intento anterior) — sigue en
  // 'failed', se puede reintentar de nuevo o completar a mano.
  const handleRetryExtracted = (rowId, batchResults) => {
    setRescanTarget(null);
    const succeededRow = batchResults.succeeded?.[0];
    const failedRow = batchResults.failed?.[0];
    if (!succeededRow && !failedRow) return;
    const fresh = succeededRow
      ? buildRow(succeededRow, { status: succeededRow.name?.trim() ? 'ok' : 'partial', fileName: succeededRow.fileName, propertyDefault })
      : buildRow({ type: mode === 'academia' ? 'Cantera' : 'Comprado', positions: [] }, { status: 'failed', fileName: failedRow.fileName, propertyDefault, file: failedRow.file || null, error: failedRow.error || '' });
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      if (r.previewUrl) URL.revokeObjectURL(r.previewUrl); // La miniatura de la foto anterior ya no hace falta: el reintento trajo una nueva.
      return { ...fresh, id: rowId };
    }));
  };

  const retryModeFor = (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    return mode === 'academia' || row?.reviewType === 'Cantera' ? 'academia' : 'primerEquipo';
  };

  // Duplicados recalculados en cada render (cola dinámica: el usuario puede editar un nombre y
  // convertirlo en duplicado, o al revés) — barato para los lotes de decenas de fotos típicos
  // de esta pantalla, nunca cientos.
  const duplicateOf = {};
  const existingMatches = {};
  rows.forEach((r, i) => {
    if (r.scanStatus === 'failed') return;
    const match = findDuplicatePlayer(r, [...players, ...rows.slice(0, i)]);
    if (match) { duplicateOf[r.id] = true; existingMatches[r.id] = match; }
  });

  // Una fila 'failed' sin "Rellenar a Mano" todavía no tiene ningún dato aprovechable: vive en
  // su propia tarjeta compacta al fondo (unresolvedFailedRows), fuera de las secciones
  // editables normales y fuera del guardado — así nunca bloquea "Confirmar y Guardar" ni exige
  // completarla antes de poder guardar el resto de la plantilla (ver requisito de guardado
  // parcial en handleSaveAll).
  const unresolvedFailedRows = rows.filter((r) => r.scanStatus === 'failed' && !r.manualFill);
  const mainRows = rows.filter((r) => !(r.scanStatus === 'failed' && !r.manualFill));

  const primerEquipoRows = mainRows.filter((r) => r.reviewType !== 'Cantera');
  const academiaRows = mainRows.filter((r) => r.reviewType === 'Cantera');
  const isMixedBatch = mode === 'primerEquipo' && primerEquipoRows.length > 0 && academiaRows.length > 0;

  const includedRows = mainRows.filter((r) => !excluded.has(r.id));
  const blockingRows = includedRows.filter((r) => Object.keys(getRowErrors(r)).length > 0);
  const partialCount = rows.filter((r) => r.scanStatus === 'partial').length;
  const duplicateCount = Object.keys(duplicateOf).length;
  const reclassifiedCount = rows.filter((r) => r.reclassified).length;
  const canSave = includedRows.length > 0 && blockingRows.length === 0 && !saving;

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    setSaveProgress({ done: 0, total: includedRows.length });
    let saved = 0;
    const savedIds = [];
    try {
      for (const r of includedRows) {
        const isInitial = r.reviewType === 'Inicial';
        // Cesión SALIENTE: se guarda como "Comprado" (el jugador sigue siendo nuestro) con
        // transferStatus/outboundLoan aparte — ver buildPlayerPayload y cedePlayer(), mismo
        // formato que una cesión hecha a mano desde la Plantilla.
        const isCedidoFuera = r.reviewType === 'CedidoFuera';
        const payload = buildPlayerPayload({
          type: (isInitial || isCedidoFuera) ? 'Comprado' : r.reviewType,
          name: r.name,
          rating: r.rating,
          positions: r.positions,
          age: r.age,
          nationality: r.nationality,
          preferredFoot: r.preferredFoot,
          potential: r.potential,
          marketValue: r.marketValue,
          wage: r.wage,
          sourceClub: isInitial ? 'En el club desde el inicio' : (r.reviewType === 'Comprado' ? r.sourceClub : r.reviewType === 'Cedido' ? r.originClub : isCedidoFuera ? (r.sourceClub || 'En el club desde el inicio') : ''),
          value: r.reviewType === 'Comprado' ? r.value : '',
          originClub: r.reviewType === 'Cedido' ? r.originClub : '',
          loanDuration: r.reviewType === 'Cedido' ? r.loanDuration : '',
          isInitialSquad: isInitial,
          transferStatus: isCedidoFuera ? 'CedidoFuera' : undefined,
          outboundLoan: isCedidoFuera ? { destinationClub: r.outboundClub.trim(), duration: r.outboundDuration || '1 Temporada' } : undefined,
        });
        // eslint-disable-next-line no-await-in-loop
        await addOrUpdatePlayer(payload, undefined, { skipFinancialEffects: skipInitialTransaction });
        saved += 1;
        savedIds.push(r.id);
        setSaveProgress({ done: saved, total: includedRows.length });
      }
      onSaved?.(saved);
      // Guardado parcial y rescate: si quedan fotos sin resolver en "Fotos No Reconocidas", no
      // se cierra el modal — se quitan de la tabla las filas YA guardadas (para que reintentar
      // más tarde no vuelva a guardarlas ni las duplique) y se avisa, dejando elegir entre
      // resolver el resto ahora mismo o terminar.
      if (unresolvedFailedRows.length > 0) {
        removeSavedRows(savedIds);
        setSaving(false);
        setRescuePrompt({ savedCount: saved, remainingCount: unresolvedFailedRows.length });
        return;
      }
      onClose();
    } catch (err) {
      console.error('Error guardando jugadores en lote:', err);
      removeSavedRows(savedIds);
      setSaveError(`Se guardaron ${saved} de ${includedRows.length} antes de fallar. Puedes reintentar con los que falten.`);
      setSaving(false);
    }
  };

  const title = mode === 'academia' ? 'Canteranos Detectados' : 'Jugadores Detectados';

  return (
    <>
    <div className="fixed inset-0 bg-black/95 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={saving ? undefined : onClose}>
      <div className="bg-surface border border-border rounded-[32px] w-full max-w-md shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex justify-between items-center px-5 pt-5 pb-3 border-b border-border-subtle">
          <h3 className="font-black italic text-blue-400 text-sm uppercase flex items-center gap-2">
            {mode === 'academia' && <GraduationCap size={16} className="shrink-0" />} {title}
          </h3>
          {!saving && (
            <button type="button" onClick={onClose} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
          )}
        </div>

        <div className="px-5 pt-4 flex-1 overflow-y-auto no-scrollbar space-y-3">
          <p className="text-[10px] font-bold text-fg-muted">
            Se detectaron <span className="text-fg font-black">{rows.length}</span> tarjeta{rows.length === 1 ? '' : 's'}. Edita cualquier dato con el lápiz, descarta filas con la papelera y confirma el resto en un solo paso.
          </p>

          {unresolvedFailedRows.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
              <ShieldAlert size={14} className="shrink-0" /><span>{unresolvedFailedRows.length} foto{unresolvedFailedRows.length === 1 ? '' : 's'} no reconocida{unresolvedFailedRows.length === 1 ? '' : 's'} al fondo — repítela{unresolvedFailedRows.length === 1 ? '' : 's'}, rellénala{unresolvedFailedRows.length === 1 ? '' : 's'} a mano o descártala{unresolvedFailedRows.length === 1 ? '' : 's'}. No bloquean el guardado del resto.</span>
            </div>
          )}
          {partialCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex gap-2 text-yellow-500 text-[10px] font-black items-center">
              <AlertTriangle size={14} className="shrink-0" /><span>{partialCount} lectura{partialCount === 1 ? '' : 's'} parcial{partialCount === 1 ? '' : 'es'}: revisa los datos incompletos.</span>
            </div>
          )}
          {duplicateCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex gap-2 text-yellow-500 text-[10px] font-black items-center">
              <CopyX size={14} className="shrink-0" /><span>{duplicateCount} jugador{duplicateCount === 1 ? '' : 'es'} duplicado{duplicateCount === 1 ? '' : 's'} omitido{duplicateCount === 1 ? '' : 's'}.</span>
            </div>
          )}
          {reclassifiedCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex gap-2 text-emerald-400 text-[10px] font-black items-center">
              <Info size={14} className="shrink-0" /><span>Se ha{reclassifiedCount === 1 ? '' : 'n'} detectado {reclassifiedCount} canterano{reclassifiedCount === 1 ? '' : 's'} que se ha{reclassifiedCount === 1 ? '' : 'n'} añadido automáticamente a tu Academia{academyStepHint ? ` (${academyStepHint})` : ''}.</span>
            </div>
          )}
          {blockingRows.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
              <AlertTriangle size={14} className="shrink-0" /><span>{blockingRows.length} fila{blockingRows.length === 1 ? '' : 's'} con campos obligatorios sin completar (en rojo).</span>
            </div>
          )}
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex gap-2 text-red-400 text-[10px] font-black items-center">
              <ShieldAlert size={14} className="shrink-0" /><span>{saveError}</span>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="p-8 text-center text-[10px] font-bold text-fg-faint uppercase tracking-widest">Sin resultados aprovechables</div>
          ) : (
            <>
              {mainRows.length > 0 && (
                isMixedBatch ? (
                  <>
                    <ReviewSection title="Primer Equipo" rows={primerEquipoRows} mode={mode} duplicateOf={duplicateOf} existingMatches={existingMatches} excluded={excluded} onToggleExclude={toggleExclude} onToggleExpand={toggleExpand} onUpdate={updateRow} onRemove={removeRow} onRetry={(id) => setRescanTarget({ retryRowId: id })} />
                    <ReviewSection title="Academia" icon={GraduationCap} rows={academiaRows} mode={mode} duplicateOf={duplicateOf} existingMatches={existingMatches} excluded={excluded} onToggleExclude={toggleExclude} onToggleExpand={toggleExpand} onUpdate={updateRow} onRemove={removeRow} onRetry={(id) => setRescanTarget({ retryRowId: id })} />
                  </>
                ) : (
                  <ReviewSection rows={mainRows} mode={mode} duplicateOf={duplicateOf} existingMatches={existingMatches} excluded={excluded} onToggleExclude={toggleExclude} onToggleExpand={toggleExpand} onUpdate={updateRow} onRemove={removeRow} onRetry={(id) => setRescanTarget({ retryRowId: id })} />
                )
              )}

              {/* Bloque inferior, separado de los jugadores ya leídos: una tarjeta compacta por
                  cada foto que la IA no pudo leer en absoluto, con su propia miniatura y las
                  tres acciones (Repetir / A Mano / Descartar) — ver FailedPhotoCard. */}
              {unresolvedFailedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-widest text-red-400">
                    <ShieldAlert size={12} className="shrink-0" /> Fotos No Reconocidas ({unresolvedFailedRows.length})
                  </div>
                  <div className="space-y-2">
                    {unresolvedFailedRows.map((r) => (
                      <FailedPhotoCard key={r.id} r={r} onRetry={(id) => setRescanTarget({ retryRowId: id })} onManualFill={handleManualFill} onRemove={removeRow} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <button type="button" onClick={() => setRescanTarget('addMore')} className="w-full py-3 rounded-2xl border border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest touch-manipulation">
            <ScanLine size={13} /> Añadir Más Fotos / Jugadores
          </button>
        </div>

        <footer className="shrink-0 bg-surface border-t border-border-subtle px-5 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={!canSave} onClick={handleSaveAll} className="flex-1 w-full py-4 rounded-xl bg-green-500 text-black font-black uppercase text-xs flex items-center justify-center gap-2 text-center hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:bg-green-500 touch-manipulation">
            {saving ? (<><RefreshCcw size={16} className="shrink-0 animate-spin" /> Guardando {saveProgress.done} de {saveProgress.total}...</>) : (<><Check size={16} className="shrink-0" /> {confirmLabel} ({includedRows.length})</>)}
          </button>
        </footer>
      </div>
    </div>

    {rescanTarget && (
      <ScanPlayerCardModal
        mode={rescanTarget === 'addMore' ? mode : retryModeFor(rescanTarget.retryRowId)}
        forceBatch
        onClose={() => setRescanTarget(null)}
        onBatchExtracted={rescanTarget === 'addMore' ? handleAddMoreExtracted : (batchResults) => handleRetryExtracted(rescanTarget.retryRowId, batchResults)}
      />
    )}

    {/* Guardado parcial: los jugadores leídos ya se guardaron en Firebase antes de llegar aquí
        (ver handleSaveAll) — este aviso solo decide si el usuario se queda a resolver las fotos
        que faltan (el modal sigue abierto, con esas fotos ya fuera de la tabla) o termina ya. */}
    {rescuePrompt && (
      <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-surface border border-border w-full max-w-sm rounded-[28px] p-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 text-green-500 font-black text-sm uppercase mb-2"><Check size={18} className="shrink-0" /> Guardado Parcial</div>
          <p className="text-xs font-bold text-fg-muted leading-relaxed mb-4">
            Se han guardado {rescuePrompt.savedCount} jugador{rescuePrompt.savedCount === 1 ? '' : 'es'}. Tienes {rescuePrompt.remainingCount} foto{rescuePrompt.remainingCount === 1 ? '' : 's'} pendiente{rescuePrompt.remainingCount === 1 ? '' : 's'}. ¿Quieres reintentarlas ahora o terminar?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-well-strong text-fg font-black uppercase text-[10px] hover:brightness-125 transition-all touch-manipulation">Terminar</button>
            <button type="button" onClick={() => setRescuePrompt(null)} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black uppercase text-[10px] hover:bg-blue-400 transition-all touch-manipulation">Reintentar Ahora</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
