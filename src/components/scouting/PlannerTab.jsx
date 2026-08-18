import { useState } from 'react';
import { Wallet, TrendingDown, TrendingUp, Scale, CheckCircle2, AlertTriangle, Check } from 'lucide-react';
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

// Fila del bloque "Salidas / Ventas": a diferencia de BuyRow, el importe de venta es editable
// (precargado con el valor de mercado del jugador) sin salir de la fila, así que el checkbox y
// el nombre son un botón independiente del campo de importe — evita que escribir en el input
// dispare también la selección/deselección de la fila.
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
      <div className="text-right shrink-0 leading-tight">
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onClick={(e) => e.stopPropagation()}
          onChange={handleChange}
          className="w-24 bg-well-strong rounded-lg text-right text-xs font-black text-fg px-2 py-1 outline-none border border-transparent focus:border-green-500"
        />
        <div className="text-[8px] font-bold text-fg-faint mt-1">{wage > 0 ? `-${formatCurrency(wage)}/sem` : 'Sin salario'}</div>
      </div>
    </div>
  );
}

// Planificador de Fichajes: simulador de balance de mercado independiente de Objetivos, que
// combina en un único cálculo las incorporaciones previstas (objetivos en seguimiento
// marcados) y las salidas previstas (jugadores en Transferibles/Cedibles marcados), frente a
// los fondos reales del club (Presupuesto de Traspasos y Margen Salarial Semanal de Finanzas).
export default function PlannerTab() {
  const { activeClub } = useClubs();
  const { targets, players } = useClubData();
  const [selectedTargetIds, setSelectedTargetIds] = useState(new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
  const [saleValues, setSaleValues] = useState({});

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

  const netTransferBalance = (transferBudget + sellIncomeTotal) - buyTransferTotal;
  const netWageBalance = (wageMarginWeekly + sellWageFreedTotal) - buyWageTotal;

  const hasActivity = selectedTargets.length > 0 || selectedSellers.length > 0;
  const transferFails = netTransferBalance < 0;
  const wageFails = hasWeeklyWageBudget && netWageBalance < 0;
  const isViable = !transferFails && !wageFails;

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

      {/* Balance final: combina ambos bloques frente a los fondos reales del club. */}
      {hasActivity ? (
        <div className="bg-surface p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><Scale size={14} className="shrink-0" /> Balance de la Operación</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <div className={`text-sm md:text-base font-black italic truncate ${netTransferBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{netTransferBalance >= 0 ? '+' : ''}{formatCurrency(netTransferBalance)}</div>
              <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Balance Traspasos</div>
            </div>
            <div className="min-w-0">
              {hasWeeklyWageBudget ? (
                <div className={`text-sm md:text-base font-black italic truncate ${netWageBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{netWageBalance >= 0 ? '+' : ''}{formatCurrency(netWageBalance)}/sem</div>
              ) : (
                <div className="text-sm md:text-base font-black italic text-fg-faint truncate">Sin Límite</div>
              )}
              <div className="text-[8px] font-bold text-fg-faint uppercase tracking-widest">Balance Salarial</div>
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-start gap-2 ${isViable ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {isViable ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div className={`text-[10px] font-black uppercase tracking-widest ${isViable ? 'text-green-500' : 'text-red-400'}`}>{isViable ? 'Viable' : 'No Viable'}</div>
              {isViable ? (
                <p className="text-[9px] font-bold text-fg-muted mt-0.5">La operación combinada (compras + ventas) es asumible con el presupuesto y el margen salarial actuales.</p>
              ) : (
                <div className="text-[9px] font-bold text-fg-muted mt-0.5 space-y-0.5">
                  {transferFails && <p>Falta presupuesto de traspasos: {formatCurrency(Math.abs(netTransferBalance))}.</p>}
                  {wageFails && <p>Falta margen salarial semanal: {formatCurrency(Math.abs(netWageBalance))}/sem.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Selecciona objetivos y/o jugadores para calcular el balance</div>
      )}
    </div>
  );
}
