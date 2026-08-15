import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Scale, LineChart, Shirt, Wallet } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency } from '../../utils/format';

// Misma agrupación por línea (POR/DEF/MED/DEL) que en Objetivos de Mercado, para desglosar la
// masa salarial por demarcación en vez de por las 15 posiciones exactas.
const POSITION_GROUPS = {
  POR: ['POR'],
  DEF: ['DFC', 'LD', 'LI', 'CAD', 'CAI'],
  MED: ['MCD', 'MC', 'MD', 'MI', 'MCO'],
  DEL: ['ED', 'EI', 'SD', 'DC'],
};
const groupOf = (pos) => Object.keys(POSITION_GROUPS).find((g) => POSITION_GROUPS[g].includes(pos)) || null;

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
    <div className="bg-surface rounded-2xl border border-border-subtle shadow-lg p-3.5">
      <Icon size={14} className={`mb-1.5 ${accent}`} />
      <div className={`text-sm md:text-base font-black italic truncate ${accent}`}>{value}</div>
      <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint leading-tight mt-0.5">{label}</div>
    </div>
  );
}

export default function FinanceStatsTab() {
  const { activeClub } = useClubs();
  const { players, transactions } = useClubData();

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

  // Masa salarial por demarcación/rol.
  const wageByGroup = useMemo(() => {
    const groups = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    players.forEach((p) => {
      const g = groupOf(p.positions?.[0]);
      if (g) groups[g] += getEffectiveWage(p);
    });
    return groups;
  }, [players]);
  const totalWage = Object.values(wageByGroup).reduce((a, b) => a + b, 0);

  // Proyección de balance: presupuesto actual menos la masa salarial mensual sostenida 6
  // meses — una estimación simple e ilustrativa, no una previsión financiera real.
  const transferBudget = activeClub?.transferBudget || 0;
  const projection6m = transferBudget - totalWage * 6;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-3 gap-2.5">
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

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2 mb-4"><Shirt size={13} /> Masa Salarial por Demarcación</h3>
        {totalWage === 0 ? (
          <div className="py-6 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin sueldos registrados</div>
        ) : (
          <div className="space-y-3">
            {Object.entries(wageByGroup).map(([group, amount]) => (
              <div key={group}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-fg-secondary">{group}</span>
                  <span className="text-[10px] font-black text-fg">{formatCurrency(amount)}</span>
                </div>
                <div className="h-2 bg-well rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${totalWage ? (amount / totalWage) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-surface to-well/40 p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2 mb-3"><Wallet size={13} /> Proyección de Balance</h3>
        <div className={`text-2xl md:text-3xl font-black italic tracking-tighter ${projection6m >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(projection6m)}</div>
        <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1.5">Estimación a 6 meses (presupuesto actual menos masa salarial sostenida)</p>
      </div>
    </div>
  );
}
