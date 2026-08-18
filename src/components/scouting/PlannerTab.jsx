import { useState } from 'react';
import { Wallet, TrendingDown, TrendingUp, Scale, CheckCircle2, AlertTriangle, Check, Gift, ChevronDown, ChevronUp, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { useClubs } from '../../context/ClubsContext';
import { getCardStyle } from '../../utils/cardStyle';
import { formatCurrency, formatValueInput, parseValue } from '../../utils/format';

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
// botón (checkbox + badge + nombre + traspaso/sueldo estimados), sin acciones propias — fichar
// o editar el objetivo sigue viviendo exclusivamente en la pestaña Objetivos.
function BuyRow({ t, selected, onToggle }) {
  const positions = positionsOf(t);
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
        <span className="block text-[8px] font-black uppercase tracking-widest text-green-500/80 truncate">{positions.join(' · ') || '—'}</span>
      </span>
      <span className="text-right shrink-0 leading-tight">
        <span className="block text-xs font-black text-fg">{t.estimatedValue > 0 ? formatCurrency(t.estimatedValue) : 'Sin valor'}</span>
        <span className="block text-[8px] font-bold text-fg-faint mt-0.5">{t.wage > 0 ? `${formatCurrency(t.wage)}/sem` : 'Sin salario'}</span>
      </span>
    </button>
  );
}

// Fila del bloque "Salidas / Ventas": mismo bloque de importe (tipografía, alineación y color)
// que BuyRow — solo que aquí la cifra de venta es editable (precargada con el valor de mercado
// del jugador) sin salir de la fila, así que el checkbox y el nombre son un botón independiente
// del campo de importe, para que escribir en él no dispare también la selección de la fila.
function SellRow({ p, selected, onToggle, saleValue, onSaleValueChange }) {
  const wage = getEffectiveWage(p);
  const [inputValue, setInputValue] = useState(formatValueInput(String(saleValue || '')));

  const handleChange = (e) => {
    const formatted = formatValueInput(e.target.value);
    setInputValue(formatted);
    onSaleValueChange(p.id, parseValue(formatted));
  };

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${selected ? 'bg-green-500/5' : ''}`}>
      <button type="button" onClick={() => onToggle(p.id)} className="shrink-0 touch-manipulation" title={selected ? 'Quitar de la venta prevista' : 'Marcar para vender/ceder'}>
        <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-green-500 border-green-500' : 'border-border-subtle bg-well'}`}>
          {selected && <Check size={9} className="text-black" strokeWidth={3.5} />}
        </span>
      </button>
      <button type="button" onClick={() => onToggle(p.id)} className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-black text-[10px] leading-none shrink-0 touch-manipulation ${getCardStyle(p.rating || 0)}`}>{p.rating || '—'}</button>
      <button type="button" onClick={() => onToggle(p.id)} className="flex-1 min-w-0 text-left touch-manipulation">
        <span className="block font-bold text-sm text-fg truncate">{p.name}</span>
        <span className="block text-[8px] font-black uppercase tracking-widest text-fg-faint truncate">{p.positions?.join(' · ') || '—'} · {p.transferStatus === 'Cedible' ? 'Cedible' : 'Transferible'}</span>
      </button>
      {/* Mismo bloque exacto que BuyRow (text-xs font-black text-fg + text-[8px] font-bold
          text-fg-faint mt-0.5): el importe es un <input> en vez de un <span> de solo lectura,
          pero sin caja ni subrayado propio para que su tamaño y alineación sean indistinguibles
          del valor de traspaso de Entradas/Compras — el lápiz diminuto es la única pista de que
          aquí sí se puede editar. "planner-sale-value-input" (ver index.css) es necesaria
          porque la app fuerza con !important un font-size de 16px/14px en todo <input> para
          evitar el zoom de Safari en móvil, que sin esa clase ganaba a text-xs y hacía ver esta
          cifra más grande que la de BuyRow pese a llevar exactamente las mismas clases. */}
      <span className="text-right shrink-0 leading-tight">
        <span className="flex items-center justify-end gap-0.5">
          <Pencil size={8} className="text-fg-faint shrink-0" />
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onClick={(e) => e.stopPropagation()}
            onChange={handleChange}
            className="planner-sale-value-input w-14 bg-transparent text-right text-xs font-black text-fg outline-none p-0 leading-none focus:text-green-500 transition-colors"
          />
          <span className="text-xs font-black text-fg">€</span>
        </span>
        <span className="block text-[8px] font-bold text-fg-faint mt-0.5">{wage > 0 ? `-${formatCurrency(wage)}/sem` : 'Sin salario liberado'}</span>
      </span>
    </div>
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
        className="flex-1 min-w-0 bg-well px-2.5 py-2 rounded-lg outline-none border border-border-subtle focus:border-yellow-500 text-[11px] font-bold text-fg placeholder:text-fg-faint placeholder:text-[10px]"
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="Importe"
        value={bonus.input}
        onChange={(e) => onAmountChange(bonus.id, e.target.value)}
        className="w-28 shrink-0 bg-well px-2 py-2 rounded-lg outline-none border border-border-subtle focus:border-yellow-500 text-right text-[11px] font-black text-fg placeholder:text-fg-faint placeholder:text-[10px]"
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
  const [saleValues, setSaleValues] = useState({});
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
  const setSaleValue = (id, val) => setSaleValues((prev) => ({ ...prev, [id]: val }));

  const addBonus = () => setBonuses((prev) => [...prev, { id: crypto.randomUUID(), label: '', input: '' }]);
  const removeBonus = (id) => setBonuses((prev) => prev.filter((b) => b.id !== id));
  const updateBonusLabel = (id, label) => setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, label } : b)));
  const updateBonusAmount = (id, raw) => setBonuses((prev) => prev.map((b) => (b.id === id ? { ...b, input: formatValueInput(raw) } : b)));
  const bonusAmount = bonuses.reduce((sum, b) => sum + parseValue(b.input), 0);

  // Transferibles y Cedibles se combinan en un único bloque de "salida" (simulador, no la
  // operación real): ambos liberan la masa salarial completa del jugador y ambos admiten un
  // importe de venta editable, precargado con el valor de mercado si aún no se ha tocado.
  const saleCandidates = players.filter((p) => (p.transferStatus === 'Transferible' || p.transferStatus === 'Cedible') && p.type !== 'Cedido');
  const saleValueFor = (p) => (saleValues[p.id] != null ? saleValues[p.id] : (p.marketValue || p.value || 0));

  const selectedTargets = targets.filter((t) => selectedTargetIds.has(t.id));
  const selectedSellers = saleCandidates.filter((p) => selectedPlayerIds.has(p.id));

  const buyTransferTotal = selectedTargets.reduce((sum, t) => sum + (t.estimatedValue || 0), 0);
  const buyWageTotal = selectedTargets.reduce((sum, t) => sum + (t.wage || 0), 0);
  const sellIncomeTotal = selectedSellers.reduce((sum, p) => sum + saleValueFor(p), 0);
  const sellWageFreedTotal = selectedSellers.reduce((sum, p) => sum + getEffectiveWage(p), 0);

  // Fondos reales del club, mismo criterio que el Planificador original: Presupuesto de
  // Traspasos y Margen Salarial Semanal (Presup. Sem. de Finanzas - masa salarial semanal
  // actual de toda la plantilla), ambos en semanal, sin ninguna conversión de unidad.
  const transferBudget = activeClub?.transferBudget || 0;
  const hasWeeklyWageBudget = activeClub?.weeklyWageBudget != null;
  const weeklyWageBudget = activeClub?.weeklyWageBudget || 0;
  const currentWageBillWeekly = players.reduce((sum, p) => sum + getEffectiveWage(p), 0);
  const wageMarginWeekly = weeklyWageBudget - currentWageBillWeekly;

  // Fondos proyectados: el resultado final de aplicar toda la simulación (compras + ventas +
  // premios) sobre los fondos actuales — no un simple delta, sino la cifra absoluta con la que
  // quedaría el club si se ejecutara tal cual está marcada.
  const projectedTransferBudget = (transferBudget + sellIncomeTotal + bonusAmount) - buyTransferTotal;
  const projectedWageMargin = (wageMarginWeekly + sellWageFreedTotal) - buyWageTotal;

  // El informe de viabilidad exige al menos un jugador marcado (compra u venta/cesión): los
  // premios por sí solos no lo activan, aunque ya cuenten en el cálculo en cuanto sí hay
  // alguna casilla marcada — ver condición de render del Balance más abajo.
  const hasSelection = selectedTargets.length > 0 || selectedSellers.length > 0;
  const transferFails = projectedTransferBudget < 0;
  const wageFails = hasWeeklyWageBudget && projectedWageMargin < 0;
  const isViable = !transferFails && !wageFails;

  // "Totalmente sostenible" exige no solo no caer en déficit, sino conservar un colchón
  // razonable (15% de los fondos originales) en ambos frentes — si no, aunque siga siendo
  // viable, se describe como "ajustada" en el informe narrativo de más abajo.
  const transferComfortable = transferBudget > 0 ? projectedTransferBudget >= transferBudget * 0.15 : projectedTransferBudget >= 0;
  const wageComfortable = !hasWeeklyWageBudget || (weeklyWageBudget > 0 ? projectedWageMargin >= weeklyWageBudget * 0.15 : projectedWageMargin >= 0);
  const isComfortable = isViable && transferComfortable && wageComfortable;

  // Informe narrativo: un párrafo por bloque con actividad (fichajes, salidas, premios) que
  // menciona a cada jugador implicado por su nombre y su impacto concreto, cerrado siempre por
  // el veredicto financiero (sostenible / ajustada / en déficit, con las cifras exactas).
  const buildNarrative = () => {
    const paragraphs = [];

    if (selectedTargets.length > 0) {
      const phrases = selectedTargets.map((t) => {
        const bits = [];
        if (t.estimatedValue > 0) bits.push(formatCurrency(t.estimatedValue));
        if (t.wage > 0) bits.push(`${formatCurrency(t.wage)}/sem`);
        return `${t.name}${bits.length ? ` (${bits.join(' y ')})` : ''}`;
      });
      paragraphs.push(
        `Para acometer ${selectedTargets.length === 1 ? 'el fichaje de' : 'los fichajes de'} ${joinNatural(phrases)}, el club destinaría ${formatCurrency(buyTransferTotal)} en traspasos y asumiría ${formatCurrency(buyWageTotal)}/sem más en nómina.`
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
        `Con todo esto, la operación es totalmente sostenible: el club cerraría con ${formatCurrency(projectedTransferBudget)} de presupuesto de traspasos${hasWeeklyWageBudget ? ` y ${formatCurrency(projectedWageMargin)}/sem de margen salarial` : ''} libres para seguir operando en el mercado.`
      );
    } else if (isViable) {
      paragraphs.push(
        `Con todo esto, la operación es viable pero queda muy ajustada: solo restarían ${formatCurrency(projectedTransferBudget)} de presupuesto de traspasos${hasWeeklyWageBudget ? ` y ${formatCurrency(projectedWageMargin)}/sem de margen salarial` : ''}, sin apenas colchón para imprevistos.`
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
            {hasWeeklyWageBudget ? (
              <div className={`text-xs md:text-sm font-black italic truncate ${wageMarginWeekly >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(wageMarginWeekly)}/sem</div>
            ) : (
              <div className="text-xs md:text-sm font-black italic text-fg-faint truncate">Sin Límite</div>
            )}
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
          <div className="p-3 md:p-4 bg-well-strong/50 border-t border-border-subtle flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-fg-muted">Total Compras</span>
            <span className="text-right leading-tight">
              <span className="block text-xs font-black text-red-400">-{formatCurrency(buyTransferTotal)}</span>
              <span className="block text-[9px] font-bold text-fg-faint mt-0.5">-{formatCurrency(buyWageTotal)}/sem</span>
            </span>
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
            <SellRow key={p.id} p={p} selected={selectedPlayerIds.has(p.id)} onToggle={togglePlayer} saleValue={saleValueFor(p)} onSaleValueChange={setSaleValue} />
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
                  <span className="w-28 shrink-0 text-[8px] font-black uppercase text-fg-faint tracking-widest text-right">Importe</span>
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
                <span className="text-[11px] font-black text-fg-faint shrink-0">{hasWeeklyWageBudget ? `${formatCurrency(wageMarginWeekly)}/sem` : 'Sin Límite'}</span>
                <ArrowRight size={10} className="text-fg-faint shrink-0" />
                <span className={`text-[11px] font-black truncate ${!hasWeeklyWageBudget ? 'text-fg-faint' : projectedWageMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>{hasWeeklyWageBudget ? `${formatCurrency(projectedWageMargin)}/sem` : 'Sin Límite'}</span>
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
