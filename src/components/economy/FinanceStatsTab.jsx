import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Scale, LineChart, Shirt, Wallet, Tag, ChevronDown } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency } from '../../utils/format';

// Misma agrupación por línea (POR/DEF/MED/DEL) que en Objetivos de Mercado, para desglosar el
// gasto por demarcación en vez de por las 15 posiciones exactas.
const POSITION_GROUPS = {
  POR: ['POR'],
  DEF: ['DFC', 'LD', 'LI', 'CAD', 'CAI'],
  MED: ['MCD', 'MC', 'MD', 'MI', 'MCO'],
  DEL: ['ED', 'EI', 'SD', 'DC'],
};
const groupOf = (pos) => Object.keys(POSITION_GROUPS).find((g) => POSITION_GROUPS[g].includes(pos)) || null;
const EMPTY_GROUPS = () => ({
  POR: { total: 0, players: [] }, DEF: { total: 0, players: [] }, MED: { total: 0, players: [] }, DEL: { total: 0, players: [] },
});

// Idéntico a FinanceTab.jsx (duplicado a propósito, mismo patrón ya usado en el resto de la
// app): sueldo mensual que realmente carga al club, salvo cedidos fuera, donde solo pesa el
// % que asumimos.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return (p.wage || 0) * (pct / 100);
  }
  return p.wage || 0;
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const monthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[Number(month) - 1]} ${year.slice(2)}`;
};

function StatCard({ icon: Icon, label, value, accent = 'text-fg' }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-subtle shadow-lg p-3 md:p-3.5 min-w-0">
      <Icon size={13} className={`mb-1 md:mb-1.5 ${accent}`} />
      <div className={`text-[11px] sm:text-xs md:text-base font-black italic leading-tight truncate ${accent}`}>{value}</div>
      <div className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-fg-faint leading-tight mt-0.5">{label}</div>
    </div>
  );
}

// Módulo unificado de desglose por demarcación: un selector tipo tabs en la cabecera alterna
// entre "Gasto en Fichajes" (activo por defecto) y "Gasto Salarial" sin salir de la tarjeta;
// debajo, el mismo acordeón por línea (POR/DEF/MED/DEL) se recalcula al vuelo según la vista
// activa. El acordeón se repliega al cambiar de vista para no arrastrar una línea abierta de
// un desglose a otro con datos distintos.
function GroupBreakdown({ views, activeView, onChangeView }) {
  const [expanded, setExpanded] = useState(null);
  const view = views[activeView];
  const { groups, total, emptyLabel, barColor, playerLabel } = view;

  const switchView = (id) => {
    if (id === activeView) return;
    setExpanded(null);
    onChangeView(id);
  };

  return (
    <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
      <div className="flex bg-well p-1 rounded-2xl border border-border-subtle mb-4">
        {Object.entries(views).map(([id, v]) => (
          <button key={id} type="button" onClick={() => switchView(id)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 touch-manipulation ${activeView === id ? 'bg-surface text-fg shadow-sm border border-border-subtle' : 'text-fg-muted hover:text-fg-secondary'}`}>
            <v.icon size={12} /> {v.tabLabel}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic">Desglose por Demarcación</span>
        <span className="text-[10px] font-black text-fg">{formatCurrency(total)}</span>
      </div>
      {total === 0 ? (
        <div className="py-6 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groups).map(([group, data]) => {
            const isOpen = expanded === group;
            return (
              <div key={group} className="rounded-xl border border-border-subtle overflow-hidden">
                <button type="button" onClick={() => setExpanded(isOpen ? null : group)} className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-well/60 hover:bg-well transition-colors touch-manipulation">
                  <span className="text-[10px] font-black uppercase tracking-widest text-fg-secondary w-7 shrink-0 text-left">{group}</span>
                  <div className="flex-1 min-w-0 h-2 bg-well rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${total ? (data.total / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-black text-fg shrink-0">{formatCurrency(data.total)}</span>
                  <ChevronDown size={14} className={`text-fg-faint shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="divide-y divide-border-subtle animate-in fade-in slide-in-from-top-1 duration-150">
                    {data.players.length === 0 ? (
                      <div className="px-3 py-3 text-center text-[9px] font-bold text-fg-faint uppercase tracking-widest">Sin {playerLabel} en esta línea</div>
                    ) : data.players.map((p) => (
                      <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2 bg-surface">
                        <span className="text-xs font-bold text-fg truncate">{p.name}</span>
                        <span className="text-[10px] font-black text-fg-secondary shrink-0">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FinanceStatsTab() {
  const { activeClub } = useClubs();
  const { players, transactions } = useClubData();
  // "signing" (Gasto en Fichajes) activo por defecto, tal y como se pidió.
  const [breakdownView, setBreakdownView] = useState('signing');

  const totalSpent = useMemo(() => transactions.filter((t) => t.type === 'compra').reduce((sum, t) => sum + (t.amount || 0), 0), [transactions]);
  const totalEarned = useMemo(() => transactions.filter((t) => t.type === 'venta').reduce((sum, t) => sum + (t.amount || 0), 0), [transactions]);
  const netBalance = totalEarned - totalSpent;

  // Evolución mensual de ingresos (ventas) vs. gastos (compras): últimos 6 meses con algún
  // movimiento registrado, agrupados por año-mes.
  const monthly = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (t.type !== 'compra' && t.type !== 'venta') return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { key, spent: 0, earned: 0 };
      if (t.type === 'compra') map[key].spent += t.amount || 0;
      else map[key].earned += t.amount || 0;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  }, [transactions]);
  const maxMonthly = Math.max(1, ...monthly.flatMap((m) => [m.spent, m.earned]));

  // Gasto salarial por demarcación/rol, con el listado de jugadores de cada línea para el
  // acordeón desplegable.
  const wageGroups = useMemo(() => {
    const groups = EMPTY_GROUPS();
    players.forEach((p) => {
      const g = groupOf(p.positions?.[0]);
      if (!g) return;
      const wage = getEffectiveWage(p);
      groups[g].total += wage;
      if (wage > 0) groups[g].players.push({ id: p.id, name: p.name, amount: wage });
    });
    Object.values(groups).forEach((g) => g.players.sort((a, b) => b.amount - a.amount));
    return groups;
  }, [players]);
  const totalWage = Object.values(wageGroups).reduce((a, g) => a + g.total, 0);

  // Gasto en fichajes por demarcación/rol: precio de compra de los jugadores actualmente en
  // plantilla con tipo "Comprado" (los cedidos y canteranos no tienen precio de compra). No se
  // reconstruye a partir del historial de transacciones porque esas no guardan la posición del
  // jugador, y un jugador ya vendido/rescindido dejaría de poder atribuirse a ninguna línea.
  const signingGroups = useMemo(() => {
    const groups = EMPTY_GROUPS();
    players.forEach((p) => {
      if (p.type !== 'Comprado' || !(p.value > 0)) return;
      const g = groupOf(p.positions?.[0]);
      if (!g) return;
      groups[g].total += p.value;
      groups[g].players.push({ id: p.id, name: p.name, amount: p.value });
    });
    Object.values(groups).forEach((g) => g.players.sort((a, b) => b.amount - a.amount));
    return groups;
  }, [players]);
  const totalSpentByGroup = Object.values(signingGroups).reduce((a, g) => a + g.total, 0);

  // Proyección de balance: presupuesto actual menos la masa salarial mensual sostenida 6
  // meses — una estimación simple e ilustrativa, no una previsión financiera real.
  const transferBudget = activeClub?.transferBudget || 0;
  const projection6m = transferBudget - totalWage * 6;

  const breakdownViews = {
    signing: { tabLabel: 'Fichajes', icon: Tag, groups: signingGroups, total: totalSpentByGroup, emptyLabel: 'Sin fichajes registrados', barColor: 'bg-red-500', playerLabel: 'fichajes' },
    wage: { tabLabel: 'Salarial', icon: Shirt, groups: wageGroups, total: totalWage, emptyLabel: 'Sin sueldos registrados', barColor: 'bg-blue-500', playerLabel: 'jugadores' },
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={TrendingDown} label="Gasto en Fichajes" value={formatCurrency(totalSpent)} accent="text-red-500" />
        <StatCard icon={TrendingUp} label="Ingresos por Ventas" value={formatCurrency(totalEarned)} accent="text-green-500" />
        <StatCard icon={Scale} label="Balance Neto" value={formatCurrency(netBalance)} accent={netBalance >= 0 ? 'text-green-500' : 'text-red-500'} />
      </div>

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2 mb-4"><LineChart size={13} /> Evolución de Ingresos vs. Gastos</h3>
        {monthly.length === 0 ? (
          <div className="py-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin movimientos todavía</div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2 h-32">
              {monthly.map((m) => (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full flex items-end justify-center gap-1 flex-1">
                    <div className="w-2.5 bg-green-500 rounded-t-sm transition-all" style={{ height: `${Math.max((m.earned / maxMonthly) * 100, m.earned > 0 ? 4 : 0)}%` }} title={`Ingresos: ${formatCurrency(m.earned)}`} />
                    <div className="w-2.5 bg-red-500 rounded-t-sm transition-all" style={{ height: `${Math.max((m.spent / maxMonthly) * 100, m.spent > 0 ? 4 : 0)}%` }} title={`Gastos: ${formatCurrency(m.spent)}`} />
                  </div>
                  <span className="text-[8px] text-fg-faint font-black uppercase tracking-widest mt-1.5">{monthLabel(m.key)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border-subtle">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-fg-muted"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" /> Ingresos</span>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-fg-muted"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0" /> Gastos</span>
            </div>
          </>
        )}
      </div>

      <GroupBreakdown views={breakdownViews} activeView={breakdownView} onChangeView={setBreakdownView} />

      <div className="bg-gradient-to-br from-surface to-well/40 p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2 mb-3"><Wallet size={13} /> Proyección de Balance</h3>
        <div className={`text-lg sm:text-xl md:text-3xl font-black italic tracking-tighter truncate ${projection6m >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(projection6m)}</div>
        <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1.5">Estimación a 6 meses (presupuesto actual menos masa salarial sostenida)</p>
      </div>
    </div>
  );
}
