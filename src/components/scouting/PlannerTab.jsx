import { useState } from 'react';
import { Wallet, TrendingDown, TrendingUp, Scale, CheckCircle2, AlertTriangle, Check, Gift, ChevronDown, ChevronUp, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useClubs } from '../../context/ClubsContext';
import { getCardStyle } from '../../utils/cardStyle';
import { formatCurrency, formatValueInput, parseValue, weeklyWageBudgetFromTransfer } from '../../utils/format';

// Idéntico a FinanceTab.jsx/FinanceStatsTab.jsx/MarketTab.jsx (duplicado a propósito, mismo
// patrón ya usado en el resto de la app): sueldo semanal que realmente carga al club, salvo
// cedidos fuera, donde solo pesa el % que asumimos.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return Math.round((p.wage || 0) * (pct / 100));
  }
  return p.wage || 0;
};

const positionsOf = (t) => t.positions || (t.primaryPosition ? [t.primaryPosition, ...(t.secondaryPositions || [])] : []);

// Une una lista en prosa natural en español ("A", "A y B", "A, B y C"), usada por el informe
// narrativo de viabilidad para mencionar jugadores por su nombre sin dejar comas sueltas.
const joinNatural = (items) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
};

// Fila compacta y seleccionable del bloque "Entradas / Compras": toda la fila es un único
// botón (checkbox + badge + nombre + traspaso-o-coste-de-cesión/sueldo estimados), sin acciones
// propias — fichar o editar el objetivo sigue viviendo exclusivamente en la pestaña Objetivos.
// Un objetivo marcado como Cesión (ver operationType en TargetForm) muestra su coste de cesión
// en vez del precio de compra, y una etiqueta "Cesión" para distinguirlo de un vistazo de un
// traspaso definitivo.
function BuyRow({ t, selected, onToggle }) {
  const positions = positionsOf(t);
  const isLoan = t.operationType === 'Cedido';
  return (
    <button
      type="button"
      onClick={() => onToggle(t.id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors touch-manipulation ${selected ? 'bg-green-500/5' : 'hover:bg-well/60'}`}
    >
      <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-green-500 border-green-500' : 'border-border-subtle bg-well'}`}>
        {selected && <Check size={9} className="text-black" strokeWidth={3.5} />}
      </span>
      <span className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black text-[10px] leading-none shrink-0 ${getCardStyle(t.rating || 0)}`}>{t.rating || '—'}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm text-fg truncate">{t.name}</span>
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-[8px] font-black uppercase tracking-widest text-green-500/80 truncate">{positions.join(' · ') || '—'}</span>
          {isLoan && <span className="shrink-0 text-[7px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">Cesión</span>}
        </span>
      </span>
      <span className="text-right shrink-0 leading-tight">
        <span className="block text-xs font-black text-fg">{isLoan ? (t.loanCost > 0 ? formatCurrency(t.loanCost) : 'Sin coste') : (t.estimatedValue > 0 ? formatCurrency(t.estimatedValue) : 'Sin valor')}</span>
        <span className="block text-[8px] font-bold text-fg-faint mt-0.5">{t.wage > 0 ? `${formatCurrency(t.wage)}/sem` : 'Sin salario'}</span>
      </span>
    </button>
  );
}

// Fila del bloque "Salidas / Ventas": misma estructura exacta que BuyRow (fila entera como un
// único botón, mismas clases en badge/nombre/importe) — el valor mostrado es el valor de
// mercado actual del jugador, en modo solo lectura, igual que el traspaso estimado en Compras.
function SellRow({ p, selected, onToggle }) {
  const wage = getEffectiveWage(p);
  const value = p.marketValue || p.value || 0;
  return (
    <button
      type="button"
      onClick={() => onToggle(p.id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors touch-manipulation ${selected ? 'bg-green-500/5' : 'hover:bg-well/60'}`}
    >
      <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-green-500 border-green-500' : 'border-border-subtle bg-well'}`}>
        {selected && <Check size={9} className="text-black" strokeWidth={3.5} />}
      </span>
      <span className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black text-[10px] leading-none shrink-0 ${getCardStyle(p.rating || 0)}`}>{p.rating || '—'}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm text-fg truncate">{p.name}</span>
        <span className="block text-[8px] font-black uppercase tracking-widest text-fg-faint truncate">{p.positions?.join(' · ') || '—'} · {p.transferStatus === 'Cedible' ? 'Cedible' : 'Transferible'}</span>
      </span>
      <span className="text-right shrink-0 leading-tight">
        <span className="block text-xs font-black text-fg">{value > 0 ? formatCurrency(value) : 'Sin valor'}</span>
        <span className="block text-[8px] font-bold text-fg-faint mt-0.5">{wage > 0 ? `${formatCurrency(wage)}/sem` : 'Sin salario'}</span>
      </span>
    </button>
  );
}

// Fila de un premio/bonificación individual dentro de la lista dinámica: concepto libre +
// importe estimado + botón de eliminar, mismo lenguaje visual (bg-well, border-border-subtle,
// acento amarillo) que el resto del bloque de Premios.
function BonusRow({ bonus, onLabelChange, onAmountChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Ej: Champions League"
        value={bonus.label}
        onChange={(e) => onLabelChange(bonus.id, e.target.value)}
        className="planner-bonus-input flex-1 min-w-0 bg-well px-2 py-1.5 rounded-lg outline-none border border-border-subtle focus:border-yellow-500 text-[10px] font-bold text-fg placeholder:text-fg-faint"
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="Importe"
        value={bonus.input}
        onChange={(e) => onAmountChange(bonus.id, e.target.value)}
        className="planner-bonus-input w-24 shrink-0 bg-well px-2 py-1.5 rounded-lg outline-none border border-border-subtle focus:border-yellow-500 text-right text-[10px] font-black text-fg placeholder:text-fg-faint"
      />
      <button type="button" onClick={() => onRemove(bonus.id)} title="Eliminar premio" className="shrink-0 p-2 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Planificador de Fichajes: simulador de balance de mercado independiente de Objetivos, que
// combina en un único cálculo las incorporaciones previstas (objetivos en seguimiento
// marcados), las salidas previstas (jugadores en Transferibles/Cedibles marcados) y los
// premios/bonificaciones estimados, frente a los fondos reales del club (Presupuesto de
// Traspasos y Margen Salarial Semanal de Finanzas), cerrando con un informe narrativo que
// explica el impacto de cada elemento seleccionado y el veredicto final de viabilidad.
export default function PlannerTab() {
  const { activeClub } = useClubs();
  const { targets, players } = useClubData();
  const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
  const [showBonus, setShowBonus] = useState(false);
  // Lista dinámica de premios/bonificaciones: cada entrada tiene su propio concepto libre e
  // importe estimado, sumados todos para el "Total de ingresos por premios" del balance.
  const [bonuses, setBonuses] = useState([]);

  const toggleTarget = (id) => setSelectedTargetIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePlayer = (id) => setSelectedPlayerIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const addBonus = () => setBonuses((prev) => [...prev, { id: crypto.randomUUID(), label: '', input: '' }]);
  const removeBonus = (id) => setBonuses((prev) => prev.filter((b) => b.id !== id));
  const updateBonusLabel = (id, label) => setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, label } : b)));
  const updateBonusAmount = (id, raw) => setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, input: formatValueInput(raw) } : b)));
  const bonusAmount = bonuses.reduce((sum, b) => sum + parseValue(b.input), 0);

  // Transferibles y Cedibles se combinan en un único bloque de "salida" (simulador, no la
  // operación real): ambos liberan la masa salarial completa del jugador y ambos cuentan con
  // su valor de mercado actual (de solo lectura, igual que el traspaso estimado en Compras).
  const saleCandidates = players.filter((p) => (p.transferStatus === 'Transferible' || p.transferStatus === 'Cedible') && p.type !== 'Cedido');
  const saleValueFor = (p) => p.marketValue || p.value || 0;

  const selectedTargets = targets.filter((t) => selectedTargetIds.has(t.id));
  const selectedSellers = saleCandidates.filter((p) => selectedPlayerIds.has(p.id));

  // Traspasos (Comprado) y costes de cesión (Cedido) se suman por separado — ambos restan del
  // mismo Presupuesto de Traspasos al proyectar el balance, pero se muestran como dos líneas
  // distintas (ver footer de "Entradas / Compras" y el informe narrativo) para que quede claro
  // cuánto de la cifra total es un traspaso definitivo y cuánto es coste de cesión.
  const buyTransferTotal = selectedTargets.filter((t) => t.operationType !== 'Cedido').reduce((sum, t) => sum + (t.estimatedValue || 0), 0);
  const buyLoanCostTotal = selectedTargets.filter((t) => t.operationType === 'Cedido').reduce((sum, t) => sum + (t.loanCost || 0), 0);
  const buyWageTotal = selectedTargets.reduce((sum, t) => sum + (t.wage || 0), 0);
  const sellIncomeTotal = selectedSellers.reduce((sum, p) => sum + saleValueFor(p), 0);
  const sellWageFreedTotal = selectedSellers.reduce((sum, p) => sum + getEffectiveWage(p), 0);

  // Fondos reales del club: Presupuesto de Traspasos (dato real de Firestore) y Margen
  // Salarial Semanal, que ya NO es un campo aparte — se deriva siempre del propio presupuesto
  // de traspasos dividido entre 52 semanas (weeklyWageBudgetFromTransfer, ver utils/format.js),
  // fórmula verificada empíricamente contra el propio EA Sports FC. Como el margen salarial
  // depende del presupuesto de traspasos, cualquier cambio en uno repercute proporcionalmente
  // en el otro — por eso el margen PROYECTADO no es un simple ajuste aparte, sino que se
  // recalcula sobre el presupuesto de traspasos ya proyectado (ver más abajo).
  const transferBudget = activeClub?.transferBudget || 0;
  const weeklyWageBudget = weeklyWageBudgetFromTransfer(transferBudget);
  const currentWageBillWeekly = players.reduce((sum, p) => sum + getEffectiveWage(p), 0);
  const wageMarginWeekly = weeklyWageBudget - currentWageBillWeekly;

  // Fondos proyectados: el resultado final de aplicar toda la simulación (compras + ventas +
  // premios) sobre los fondos actuales — no un simple delta, sino la cifra absoluta con la que
  // quedaría el club si se ejecutara tal cual está marcada. El presupuesto semanal proyectado
  // se recalcula desde el presupuesto de traspasos YA proyectado (incluye premios/52), y el
  // margen proyectado lo compara contra la masa salarial ya proyectada (con las altas/bajas
  // aplicadas) — así un premio, por ejemplo, también sube ligeramente el margen semanal.
  const projectedTransferBudget = (transferBudget + sellIncomeTotal + bonusAmount) - buyTransferTotal - buyLoanCostTotal;
  const projectedWeeklyBudget = weeklyWageBudgetFromTransfer(projectedTransferBudget);
  const projectedWageBillWeekly = (currentWageBillWeekly - sellWageFreedTotal) + buyWageTotal;
  const projectedWageMargin = projectedWeeklyBudget - projectedWageBillWeekly;

  // El informe de viabilidad exige al menos un jugador marcado (compra u venta/cesión): los
  // premios por sí solos no lo activan, aunque ya cuenten en el cálculo en cuanto sí hay
  // alguna casilla marcada — ver condición de render del Balance más abajo.
  const hasSelection = selectedTargets.length > 0 || selectedSellers.length > 0;
  const transferFails = projectedTransferBudget < 0;
  const wageFails = projectedWageMargin < 0;
  const isViable = !transferFails && !wageFails;

  // "Totalmente sostenible" exige no solo no caer en déficit, sino conservar un colchón
  // razonable (15% de los fondos originales) en ambos frentes — si no, aunque siga siendo
  // viable, se describe como "ajustada" en el informe narrativo de más abajo.
  const transferComfortable = transferBudget > 0 ? projectedTransferBudget >= transferBudget * 0.15 : projectedTransferBudget >= 0;
  const wageComfortable = weeklyWageBudget > 0 ? projectedWageMargin >= weeklyWageBudget * 0.15 : projectedWageMargin >= 0;
  const isComfortable = isViable && transferComfortable && wageComfortable;

  // Informe narrativo: un párrafo por bloque con actividad (fichajes, salidas, premios) que
  // menciona a cada jugador implicado por su nombre y su impacto concreto, cerrado siempre por
  // el veredicto financiero (sostenible / ajustada / en déficit, con las cifras exactas).
  const buildNarrative = () => {
    const paragraphs = [];

    if (selectedTargets.length > 0) {
      const phrases = selectedTargets.map((t) => {
        const isLoan = t.operationType === 'Cedido';
        const bits = [];
        if (isLoan) { if (t.loanCost > 0) bits.push(`${formatCurrency(t.loanCost)} de coste de cesión`); }
        else if (t.estimatedValue > 0) bits.push(formatCurrency(t.estimatedValue));
        if (t.wage > 0) bits.push(`${formatCurrency(t.wage)}/sem`);
        return `${t.name}${isLoan ? ' (cesión' : ''}${bits.length ? `${isLoan ? ', ' : ' ('}${bits.join(' y ')})` : (isLoan ? ')' : '')}`;
      });
      const costBits = [];
      if (buyTransferTotal > 0) costBits.push(`${formatCurrency(buyTransferTotal)} en traspasos`);
      if (buyLoanCostTotal > 0) costBits.push(`${formatCurrency(buyLoanCostTotal)} en costes de cesión`);
      paragraphs.push(
        `Para acometer ${selectedTargets.length === 1 ? 'el fichaje de' : 'los fichajes de'} ${joinNatural(phrases)}, el club destinaría${costBits.length ? ` ${joinNatural(costBits)}` : ' 0 € en traspasos o cesiones'} y asumiría ${formatCurrency(buyWageTotal)}/sem más en nómina.`
      );
    }

    if (selectedSellers.length > 0) {
      const phrases = selectedSellers.map((p) => {
        const value = saleValueFor(p);
        const wage = getEffectiveWage(p);
        const verb = p.transferStatus === 'Cedible' ? 'la cesión' : 'la venta';
        const bits = [];
        if (value > 0) bits.push(`aportará +${formatCurrency(value)} a las arcas`);
        if (wage > 0) bits.push(`liberará ${formatCurrency(wage)}/sem de masa salarial`);
        return `${verb} de ${p.name}${bits.length ? ` ${bits.join(' y ')}` : ' no tiene impacto económico registrado'}`;
      });
      paragraphs.push(`En el otro lado de la operación, ${joinNatural(phrases)}.`);
    }

    const activeBonuses = bonuses.filter((b) => parseValue(b.input) > 0);
    if (activeBonuses.length === 1) {
      const b = activeBonuses[0];
      paragraphs.push(
        `A esto se suman los +${formatCurrency(parseValue(b.input))} previstos${b.label.trim() ? ` por ${b.label.trim()}` : ' en premios y bonificaciones'}, que se incorporan directamente al presupuesto de traspasos.`
      );
    } else if (activeBonuses.length > 1) {
      const phrases = activeBonuses.map((b, i) => `${b.label.trim() || `Premio ${i + 1}`} (+${formatCurrency(parseValue(b.input))})`);
      paragraphs.push(
        `A esto se suman los ingresos estimados por ${joinNatural(phrases)}, que se incorporan directamente al presupuesto de traspasos.`
      );
    }

    if (isComfortable) {
      paragraphs.push(
        `Con todo esto, la operación es totalmente sostenible: el club cerraría con ${formatCurrency(projectedTransferBudget)} de presupuesto de traspasos y ${formatCurrency(projectedWageMargin)}/sem de margen salarial libres para seguir operando en el mercado.`
      );
    } else if (isViable) {
      paragraphs.push(
        `Con todo esto, la operación es viable pero queda muy ajustada: solo restarían ${formatCurrency(projectedTransferBudget)} de presupuesto de traspasos y ${formatCurrency(projectedWageMargin)}/sem de margen salarial, sin apenas colchón para imprevistos.`
      );
    } else {
      const deficits = [];
      if (transferFails) deficits.push(`un déficit de ${formatCurrency(Math.abs(projectedTransferBudget))} en el presupuesto de traspasos`);
      if (wageFails) deficits.push(`un déficit de ${formatCurrency(Math.abs(projectedWageMargin))}/sem en el margen salarial`);
      paragraphs.push(`Con todo esto, la operación NO es viable: generaría ${joinNatural(deficits)}.`);
    }

    return paragraphs;
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Fondos actuales del club: siempre visibles, no dependen de la selección. */}
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl">
        <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-1.5 mb-2"><Wallet size={12} className="shrink-0" /> Fondos del Club</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className="text-xs md:text-sm font-black italic text-green-500 truncate">{formatCurrency(transferBudget)}</div>
            <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Presupuesto Traspasos</div>
          </div>
          <div className="min-w-0">
            <div className={`text-xs md:text-sm font-black italic truncate ${wageMarginWeekly >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(wageMarginWeekly)}/sem</div>
            <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Margen Salarial Disp.</div>
          </div>
        </div>
      </div>

      {/* Entradas / Compras previstas: objetivos en seguimiento marcados para fichar. */}
      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <div className="p-4 pb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><TrendingDown size={14} className="text-red-400 shrink-0" /> Entradas / Compras Previstas</span>
          <span className="text-[9px] font-black text-fg-faint shrink-0">{selectedTargets.length}/{targets.length}</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {targets.length === 0 ? (
            <div className="p-8 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin objetivos en seguimiento</div>
          ) : targets.map((t) => <BuyRow key={t.id} t={t} selected={selectedTargetIds.has(t.id)} onToggle={toggleTarget} />)}
        </div>
        {selectedTargets.length > 0 && (
          <div className="p-3 md:p-4 bg-well-strong/50 border-t border-border-subtle space-y-1.5">
            {/* Traspasos y costes de cesión se muestran como líneas separadas (ver
                buyTransferTotal/buyLoanCostTotal): ambos restan del mismo Presupuesto de
                Traspasos, pero conviene distinguir de un vistazo cuánto es compra en firme y
                cuánto es coste de cesión. Se omite la línea que esté a 0 para no ensuciar el
                resumen cuando todos los objetivos seleccionados son del mismo tipo. */}
            {buyTransferTotal > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Traspasos</span>
                <span className="text-xs font-black text-red-400">-{formatCurrency(buyTransferTotal)}</span>
              </div>
            )}
            {buyLoanCostTotal > 0 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Costes de Cesión</span>
                <span className="text-xs font-black text-yellow-500">-{formatCurrency(buyLoanCostTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Sueldo Total</span>
              <span className="text-[9px] font-bold text-fg-faint">-{formatCurrency(buyWageTotal)}/sem</span>
            </div>
          </div>
        )}
      </div>

      {/* Salidas / Ventas previstas: plantilla actual marcada como Transferible o Cedible. */}
      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <div className="p-4 pb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><TrendingUp size={14} className="text-green-500 shrink-0" /> Salidas / Ventas Previstas</span>
          <span className="text-[9px] font-black text-fg-faint shrink-0">{selectedSellers.length}/{saleCandidates.length}</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {saleCandidates.length === 0 ? (
            <div className="p-8 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin jugadores en Transferibles/Cedibles</div>
          ) : saleCandidates.map((p) => (
            <SellRow key={p.id} p={p} selected={selectedPlayerIds.has(p.id)} onToggle={togglePlayer} />
          ))}
        </div>
        {selectedSellers.length > 0 && (
          <div className="p-3 md:p-4 bg-well-strong/50 border-t border-border-subtle flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Total Ventas</span>
            <span className="text-right leading-tight">
              <span className="block text-xs font-black text-green-500">+{formatCurrency(sellIncomeTotal)}</span>
              <span className="block text-[9px] font-bold text-fg-faint mt-0.5">+{formatCurrency(sellWageFreedTotal)}/sem ahorrado</span>
            </span>
          </div>
        )}
      </div>

      {/* Premios y Bonificaciones estimadas: ingreso extra opcional (Liga, Copa, pretemporada,
          objetivos de rendimiento...) que se suma directamente al presupuesto de traspasos de
          la simulación. Desplegable para no ocupar espacio cuando no se usa. */}
      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <button type="button" onClick={() => setShowBonus((v) => !v)} className="w-full p-4 flex items-center justify-between gap-2 touch-manipulation">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><Gift size={14} className="text-yellow-500 shrink-0" /> Premios y Bonificaciones Estimadas</span>
          <div className="flex items-center gap-2 shrink-0">
            {bonusAmount > 0 && <span className="text-xs font-black text-yellow-500">+{formatCurrency(bonusAmount)}</span>}
            {showBonus ? <ChevronUp size={14} className="text-fg-faint" /> : <ChevronDown size={14} className="text-fg-faint" />}
          </div>
        </button>
        {showBonus && (
          <div className="px-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {bonuses.length === 0 ? (
              <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest">Sin premios añadidos todavía.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 px-0.5">
                  <span className="flex-1 min-w-0 text-[8px] font-black uppercase text-fg-faint tracking-widest">Concepto / Torneo</span>
                  <span className="w-24 shrink-0 text-[8px] font-black uppercase text-fg-faint tracking-widest text-right">Importe</span>
                  <span className="w-9 shrink-0" />
                </div>
                {bonuses.map((b) => (
                  <BonusRow key={b.id} bonus={b} onLabelChange={updateBonusLabel} onAmountChange={updateBonusAmount} onRemove={removeBonus} />
                ))}
              </>
            )}
            <button type="button" onClick={addBonus} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border-subtle text-fg-muted hover:text-yellow-500 hover:border-yellow-500/50 transition-colors text-[10px] font-black uppercase tracking-widest touch-manipulation">
              <Plus size={13} /> Añadir Premio
            </button>
          </div>
        )}
      </div>

      {/* Balance final: fondos actuales vs. proyectados tras aplicar toda la simulación, más
          el informe narrativo detallado del impacto de cada elemento y el veredicto final. Solo
          se muestra con al menos un jugador marcado (compra o venta/cesión) — los premios,
          aunque ya sumen al cálculo, no bastan por sí solos para activar el informe. */}
      {hasSelection ? (
        <div className="bg-surface p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl space-y-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><Scale size={14} className="shrink-0" /> Balance de la Operación</span>

          {/* Comparativa Fondos Actuales -> Fondos Proyectados. */}
          <div className="space-y-2 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-fg-muted shrink-0">Presup. Traspasos</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-fg-faint shrink-0">{formatCurrency(transferBudget)}</span>
                <ArrowRight size={10} className="text-fg-faint shrink-0" />
                <span className={`text-[11px] font-black truncate ${projectedTransferBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(projectedTransferBudget)}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-fg-muted shrink-0">Margen Salarial</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-fg-faint shrink-0">{formatCurrency(wageMarginWeekly)}/sem</span>
                <ArrowRight size={10} className="text-fg-faint shrink-0" />
                <span className={`text-[11px] font-black truncate ${projectedWageMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(projectedWageMargin)}/sem</span>
              </span>
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-start gap-2 ${isComfortable ? 'bg-green-500/10 border-green-500/20' : isViable ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {isComfortable ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" /> : isViable ? <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div className={`text-[10px] font-black uppercase tracking-widest ${isComfortable ? 'text-green-500' : isViable ? 'text-yellow-500' : 'text-red-400'}`}>
                {isComfortable ? 'Totalmente Viable' : isViable ? 'Viable (Margen Ajustado)' : 'No Viable'}
              </div>
              <div className="text-[9px] font-bold text-fg-muted mt-1 space-y-1.5 leading-relaxed">
                {buildNarrative().map((paragraph, i) => <p key={i}>{paragraph}</p>)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-fg-faint font-bold italic text-xs">Selecciona al menos un objetivo o una venta para calcular y evaluar la viabilidad de la operación</div>
      )}
    </div>
  );
}
