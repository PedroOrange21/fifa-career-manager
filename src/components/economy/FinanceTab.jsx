import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, ArrowDownToLine, Users2, Edit2, Check, X, List, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency, formatValueInput, parseValue } from '../../utils/format';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';
import WageBreakdownModal from './WageBreakdownModal';

// Línea de desglose reutilizada dentro del panel expandible de cada transacción.
function DetailLine({ label, value, valueClassName = 'text-fg' }) {
  return (
    <div className="flex justify-between items-center gap-2 text-[10px]">
      <span className="font-bold text-fg-muted">{label}</span>
      <span className={`font-black text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}

// Popover explicativo del icono "ℹ️" de la tarjeta de Presupuesto del Club — mismo patrón de
// bottom-sheet ya usado en Estadísticas (FinanceStatsTab.jsx) para sus propios iconos de
// información, reutilizado aquí para mantener la misma experiencia en toda la sección de
// Finanzas.
function InfoModal({ title, children, onClose }) {
  useBodyScrollLock();
  useAutoHideChrome();
  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-border w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] p-5 md:p-6 max-h-[85dvh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black italic uppercase text-fg flex items-center gap-2 text-sm"><Info size={16} className="text-emerald-500" /> {title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 -mr-1.5 text-fg-faint hover:text-fg transition-colors touch-manipulation"><X size={18} /></button>
        </div>
        <div className="text-[11px] text-fg-muted font-bold leading-relaxed space-y-2.5">{children}</div>
      </div>
    </div>
  );
}

// Sueldo semanal que realmente carga a nuestro club: el total del jugador, salvo que esté
// cedido fuera, caso en el que solo pesa el porcentaje que asumimos nosotros. Se usa tanto
// para el total de la tarjeta como para cada línea del desglose, así ambos números siempre
// cuadran entre sí.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    // Math.round: wage * (pct/100) puede arrastrar imprecisión de coma flotante binaria (p.
    // ej. 0.15 no es exacto en binario), dando restos como "...4999999997" que, sumados entre
    // muchos jugadores, desplazaban la masa salarial y el margen disponible en el Planificador.
    return Math.round((p.wage || 0) * (pct / 100));
  }
  return p.wage || 0;
};

export default function FinanceTab({ onRequestEditPlayerWage, reopenWageBreakdown, onConsumeReopenWageBreakdown }) {
  const { activeClub, setBudget, setWageBudget } = useClubs();
  const { players, transactions } = useClubData();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [weeklyWageBudgetInput, setWeeklyWageBudgetInput] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [showBudgetInfo, setShowBudgetInfo] = useState(false);
  const [showWageBreakdown, setShowWageBreakdown] = useState(false);
  const [expandedTx, setExpandedTx] = useState(null);

  // Al volver de editar un sueldo desde el propio Desglose (ver WageBreakdownModal ->
  // ClubShell.wageEditPlayer), se reabre el modal con los datos ya actualizados (players ya
  // refleja el cambio vía el listener de Firestore) en vez de dejar al usuario en la tarjeta
  // de Finanzas sin más.
  useEffect(() => {
    if (!reopenWageBreakdown) return;
    setShowWageBreakdown(true);
    onConsumeReopenWageBreakdown?.();
  }, [reopenWageBreakdown, onConsumeReopenWageBreakdown]);

  const wageBill = players.reduce((sum, p) => sum + getEffectiveWage(p), 0);
  // De mayor a menor sueldo individual; se excluyen los que no cargan nada al club (p. ej.
  // canteranos sin contrato todavía) para no llenar el desglose de líneas a 0 €.
  const wageBreakdown = players
    .map((p) => ({ ...p, effectiveWage: getEffectiveWage(p) }))
    .filter((p) => p.effectiveWage > 0)
    .sort((a, b) => b.effectiveWage - a.effectiveWage);
  const transferBudget = activeClub?.transferBudget || 0;

  // "weeklyWageBudget == null" (el campo nunca se guardó en Firestore, p. ej. clubes creados
  // antes de esta función) es la señal de "el club todavía no ha definido un Presup. Sem." —
  // distinta de haberlo fijado explícitamente a 0. El Planificador de Fichajes de Objetivos lee
  // este mismo campo para no marcar "excede el margen salarial" cuando no hay ninguno
  // configurado.
  const hasWeeklyWageBudget = activeClub?.weeklyWageBudget != null;
  const weeklyWageBudget = activeClub?.weeklyWageBudget || 0;

  const startEditingBudget = () => {
    setBudgetInput(formatValueInput(String(transferBudget)));
    setWeeklyWageBudgetInput(hasWeeklyWageBudget ? formatValueInput(String(weeklyWageBudget)) : '');
    setBudgetError('');
    setEditingBudget(true);
  };
  // El Presup. Sem. es obligatorio (igual que en el onboarding): no se guarda nada si se deja
  // vacío o en 0, para no dejar al club con un "sin definir" silencioso a mitad de edición.
  const confirmBudget = async (e) => {
    e.preventDefault();
    const weekly = parseValue(weeklyWageBudgetInput);
    if (!weeklyWageBudgetInput.trim() || weekly <= 0) {
      setBudgetError('El Presup. Sem. (salarios) es obligatorio.');
      return;
    }
    await setBudget(parseValue(budgetInput));
    await setWageBudget(weekly);
    setEditingBudget(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-gradient-to-br from-green-500/20 to-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-green-500/30 shadow-2xl relative overflow-hidden">
        <Wallet className="absolute -bottom-4 -right-4 text-green-500/10 w-32 h-32 md:w-40 md:h-40" />
        <div className="flex items-center justify-between mb-2 relative">
          <span className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2"><Wallet size={14} /> Presupuesto del Club</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => setShowBudgetInfo(true)} title="¿Qué es esto?" className="p-1.5 text-fg-faint hover:text-fg transition-colors touch-manipulation"><Info size={13} /></button>
            {!editingBudget && (<button onClick={startEditingBudget} className="p-1.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-lg"><Edit2 size={12} /></button>)}
          </div>
        </div>
        {showBudgetInfo && (
          <InfoModal title="Presupuesto del Club" onClose={() => setShowBudgetInfo(false)}>
            <p>Introduce los valores exactos que aparecen en tu Modo Carrera (Menú Oficina &gt; Economía &gt; Presupuesto): la cifra principal corresponde a "Presupuesto actual" y el importe semanal a "Presup. sem.".</p>
            <p>La app calculará automáticamente tu margen salarial restante.</p>
          </InfoModal>
        )}
        {editingBudget ? (
          <form onSubmit={confirmBudget} className="space-y-3 mt-2 relative">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-fg-faint uppercase tracking-wider ml-1">Presupuesto Actual</label>
              <input autoFocus type="text" className="w-full bg-well p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-center font-black text-lg text-fg" value={budgetInput} onChange={(e) => setBudgetInput(formatValueInput(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-fg-faint uppercase tracking-wider ml-1">Presup. Sem. (Salarios)</label>
              <input type="text" placeholder="Ej: 500.000" className="w-full bg-well p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-center font-black text-lg text-fg" value={weeklyWageBudgetInput} onChange={(e) => { setWeeklyWageBudgetInput(formatValueInput(e.target.value)); setBudgetError(''); }} />
            </div>
            {budgetError && <p className="text-[9px] font-black text-red-400 uppercase tracking-wide">{budgetError}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" className="flex-1 p-3 bg-green-500 text-black rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-wide"><Check size={16} /> Guardar</button>
              <button type="button" onClick={() => setEditingBudget(false)} className="p-3 bg-well text-fg-muted rounded-xl"><X size={16} /></button>
            </div>
          </form>
        ) : (
          <>
            <div className={`text-3xl md:text-4xl font-black italic tracking-tighter relative ${transferBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(transferBudget)}</div>
            <p className="text-[10px] font-bold text-fg-faint mt-1.5 relative">Presup. Sem.: {hasWeeklyWageBudget ? `${formatCurrency(weeklyWageBudget)}/sem` : 'Sin definir'}</p>
          </>
        )}
      </div>

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted flex items-center gap-2"><Users2 size={14} /> Masa Salarial Semanal</span>
          <button type="button" onClick={() => setShowWageBreakdown(true)} title="Ver desglose" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-well text-fg-muted hover:text-fg hover:bg-well-strong transition-colors text-[9px] font-black uppercase tracking-widest">
            <List size={12} /> Ver Desglose
          </button>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-xl md:text-2xl font-black italic tracking-tighter text-fg">{formatCurrency(wageBill)}</div>
          <span className="text-[10px] font-bold text-fg-faint">/sem</span>
        </div>
        <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1">{formatCurrency(wageBill * 52)}/año · Suma de salarios de la plantilla activa</p>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2">Historial de Transacciones</h3>
        <div className="divide-y divide-border-subtle">
          {transactions.length === 0 && (<div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin movimientos todavía</div>)}
          {transactions.map((t) => {
            // Las 4 clases de movimiento tienen ya condiciones/contexto propio que merece un
            // desglose (compra y cesión entrante incluyen la instantánea de fichaje guardada
            // en ClubDataContext; venta y cesión saliente, el reparto económico ya existente).
            const isOpen = expandedTx === t.id;
            const isOutflow = t.type === 'compra' || t.type === 'cesion_entrante';
            // Clases literales completas (no interpoladas) a propósito: el escáner de
            // contenido de Tailwind necesita ver el nombre de la clase entero en el código
            // fuente para generarla — construirlo con un `${...}` dinámico (ej. `bg-${color}-
            // 500/10`) hace que se pierda silenciosamente en el CSS final.
            const iconWrapClass = t.type === 'compra' ? 'bg-red-500/10 text-red-500' : t.type === 'cesion' ? 'bg-blue-500/10 text-blue-500' : t.type === 'cesion_entrante' ? 'bg-purple-500/10 text-purple-500' : 'bg-green-500/10 text-green-500';
            const amountClass = t.type === 'compra' ? 'text-red-500' : t.type === 'cesion' ? 'text-blue-500' : t.type === 'cesion_entrante' ? 'text-purple-500' : 'text-green-500';
            const Icon = t.type === 'compra' ? TrendingDown : t.type === 'cesion' ? ArrowRightLeft : t.type === 'cesion_entrante' ? ArrowDownToLine : TrendingUp;
            return (
              <div key={t.id}>
                <div className="p-3 md:p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconWrapClass}`}><Icon size={16} /></div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-fg truncate">{t.playerName}</div>
                      {/* Formato compacto "Etiqueta · T.X": sustituye la fecha de calendario
                          por la temporada del movimiento (t.seasonNumber, guardado desde
                          logTransaction), integrada en la misma línea sin competir con el
                          importe de la derecha gracias al min-w-0 + truncate del contenedor. */}
                      <div className="text-[9px] text-fg-faint font-black uppercase tracking-widest truncate">
                        {t.type === 'compra' ? 'Fichaje' : t.type === 'venta' ? 'Traspaso' : t.type === 'cesion' ? 'Ahorro salarial' : 'Cesión entrante'} · TEMP {t.seasonNumber || 1}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className={`font-black text-sm ${amountClass}`}>{isOutflow ? '-' : '+'}{formatCurrency(t.amount)}</div>
                    <button type="button" onClick={() => setExpandedTx(isOpen ? null : t.id)} title="Ver desglose" className="p-1 rounded-lg text-fg-faint hover:text-fg hover:bg-well transition-colors">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 md:px-4 md:pb-4 -mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-3 bg-well rounded-xl border border-border-subtle space-y-1.5">
                      {t.type === 'venta' && (
                        <>
                          <DetailLine label="Precio Total" value={formatCurrency(t.totalAmount ?? t.amount)} />
                          <DetailLine label="Añadido a Presupuesto" value={formatCurrency(t.amount)} />
                          <DetailLine label="Retención del Club" value={formatCurrency(t.retainedAmount || 0)} />
                          {t.wageFreed ? (
                            <div className="flex items-start justify-between gap-2 text-[10px]">
                              <span className="font-bold text-fg-muted pt-px">Salario Liberado</span>
                              <span className="text-right leading-tight shrink-0">
                                <span className="block font-black text-fg">{formatCurrency(t.wageFreed)}/sem</span>
                                <span className="block font-bold text-fg-faint text-[9px] mt-0.5">{formatCurrency(t.wageFreed * 52)}/año</span>
                              </span>
                            </div>
                          ) : null}
                          {t.netProfit != null ? <DetailLine label="Beneficio / Pérdida" value={`${t.netProfit >= 0 ? '+' : ''}${formatCurrency(t.netProfit)}`} valueClassName={t.netProfit >= 0 ? 'text-green-500' : 'text-red-500'} /> : null}
                        </>
                      )}
                      {t.type === 'cesion' && (
                        <>
                          <DetailLine label="Club Destino" value={t.club || 'Sin definir'} />
                          <DetailLine label="Duración" value={t.duration || 'Sin definir'} />
                          <DetailLine label="% Pagado por Nosotros" value={`${t.wagePercentage ?? 0}%`} />
                          <div className="flex items-start justify-between gap-2 text-[10px]">
                            <span className="font-bold text-fg-muted pt-px">Ahorro Semanal</span>
                            <span className="text-right leading-tight shrink-0">
                              <span className="block font-black text-fg">{formatCurrency(t.amount)}/sem</span>
                              <span className="block font-bold text-fg-faint text-[9px] mt-0.5">{formatCurrency(t.amount * 52)}/año</span>
                            </span>
                          </div>
                          {t.buyOption ? <DetailLine label="Opción de Compra" value={formatCurrency(t.buyOption)} /> : null}
                        </>
                      )}
                      {(t.type === 'compra' || t.type === 'cesion_entrante') && (
                        <>
                          <DetailLine label="Precio de Traspaso Pagado" value={`-${formatCurrency(t.amount)}`} />
                          <DetailLine label={t.type === 'compra' ? 'Club de Procedencia' : 'Club de Origen'} value={(t.type === 'compra' ? t.sourceClub : t.club) || 'Sin definir'} />
                          <DetailLine label="Rol Pactado" value={t.agreedRole || 'Sin definir'} />
                          {/* Dos filas superpuestas (semana arriba, año abajo en formato más
                              sutil) en vez de un único valor inline, mismo patrón que el resto
                              de la app. */}
                          {t.wageMonthly ? (
                            <div className="flex items-start justify-between gap-2 text-[10px]">
                              <span className="font-bold text-fg-muted pt-px">Impacto Salarial</span>
                              <span className="text-right leading-tight shrink-0">
                                <span className="block font-black text-fg">+{formatCurrency(t.wageMonthly)}/sem</span>
                                <span className="block font-bold text-fg-faint text-[9px] mt-0.5">+{formatCurrency(t.wageMonthly * 52)}/año</span>
                              </span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showWageBreakdown && (
        <WageBreakdownModal
          players={wageBreakdown}
          total={wageBill}
          onClose={() => setShowWageBreakdown(false)}
          onEditPlayer={onRequestEditPlayerWage ? (p) => { setShowWageBreakdown(false); onRequestEditPlayerWage(p); } : null}
        />
      )}
    </div>
  );
}
