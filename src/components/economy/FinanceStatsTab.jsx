import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Scale, LineChart, Shirt, Wallet, Tag, ChevronDown, Info, X } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency } from '../../utils/format';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useAutoHideChrome } from '../../hooks/useAutoHideChrome';

// Popover explicativo genérico para los iconos "ℹ️" de las tarjetas de Estadísticas: mismo
// patrón de bottom-sheet/modal ya usado en Academia (PotentialInfoModal), reutilizado aquí para
// no depender de un simple `title` nativo (que en móvil no se puede ni pulsar).
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
// app): sueldo semanal que realmente carga al club, salvo cedidos fuera, donde solo pesa el
// % que asumimos.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return (p.wage || 0) * (pct / 100);
  }
  return p.wage || 0;
};

function StatCard({ icon: Icon, label, value, accent = 'text-fg', onInfoClick }) {
  return (
    <div className="relative bg-surface rounded-2xl border border-border-subtle shadow-lg p-3 md:p-3.5 min-w-0">
      {onInfoClick && (
        <button type="button" onClick={onInfoClick} className="absolute top-1.5 right-1.5 p-1 text-fg-faint hover:text-fg transition-colors touch-manipulation">
          <Info size={11} />
        </button>
      )}
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

// Tarjeta de rentabilidad de traspasos con 3 vistas conmutables: "Todos" (beneficio neto de
// toda venta, canterano o no), "Canteranos" (ingreso bruto de ventas sin coste de fichaje
// previo) y "No Canteranos" (balance neto compra-venta de jugadores fichados). Se calcula a
// partir de las transacciones de tipo "venta", que ya guardan originalCost/netProfit por
// operación (ver sellPlayer en ClubDataContext).
function ProfitabilityCard({ transactions }) {
  const [view, setView] = useState('all');
  const [showList, setShowList] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const ventas = [...transactions.filter((t) => t.type === 'venta')].sort((a, b) => b.date - a.date);
  const academyVentas = ventas.filter((t) => (t.originalCost ?? 0) === 0);
  const signedVentas = ventas.filter((t) => (t.originalCost ?? 0) > 0);

  const allProfit = ventas.reduce((sum, t) => sum + (t.netProfit ?? ((t.totalAmount ?? t.amount) - (t.originalCost || 0))), 0);
  const academyIncome = academyVentas.reduce((sum, t) => sum + (t.totalAmount ?? t.amount), 0);
  const signedNet = signedVentas.reduce((sum, t) => sum + (t.netProfit ?? ((t.totalAmount ?? t.amount) - (t.originalCost || 0))), 0);

  const views = {
    all: { label: 'Todos', value: allProfit, list: ventas },
    academy: { label: 'Canteranos', value: academyIncome, list: academyVentas },
    signed: { label: 'No Canteranos', value: signedNet, list: signedVentas },
  };
  const active = views[view];

  const switchView = (id) => { if (id === view) return; setShowList(false); setView(id); };

  return (
    <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><TrendingUp size={13} /> Beneficio por Traspasos (Neto)</h3>
        <button type="button" onClick={() => setShowInfo(true)} className="p-1 -m-1 text-fg-faint hover:text-fg transition-colors shrink-0 touch-manipulation"><Info size={13} /></button>
      </div>
      {showInfo && (
        <InfoModal title="Beneficio por Traspasos (Neto)" onClose={() => setShowInfo(false)}>
          <p>Es el beneficio neto real obtenido en cada venta: al dinero ingresado por el traspaso se le descuenta el coste original de compra del jugador.</p>
          <p className="p-2.5 bg-well rounded-xl border border-border-subtle text-fg font-black text-center">Precio de Venta − Coste Original = Beneficio Neto</p>
          <p>En el caso de los canteranos, el coste original de fichaje es <span className="text-fg font-black">0 €</span>, así que el 100% de lo ingresado por su venta se contabiliza como beneficio.</p>
          <p>No confundir con "Ingresos (Bruto)", que es el total cobrado por todas las ventas sin restar ese coste.</p>
        </InfoModal>
      )}
      <div className="flex bg-well p-1 rounded-2xl border border-border-subtle mb-4">
        {Object.entries(views).map(([id, v]) => (
          <button key={id} type="button" onClick={() => switchView(id)} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all touch-manipulation ${view === id ? 'bg-surface text-fg shadow-sm border border-border-subtle' : 'text-fg-muted hover:text-fg-secondary'}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className={`text-2xl md:text-3xl font-black italic tracking-tighter truncate ${active.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>{active.value >= 0 ? '+' : ''}{formatCurrency(active.value)}</div>
      <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1.5">
        {view === 'all' && 'Beneficio total de todos los traspasos'}
        {view === 'academy' && 'Total ingresado por ventas de canteranos'}
        {view === 'signed' && 'Balance neto de compras vs. ventas de fichajes'}
      </p>

      {/* Desglose jugador a jugador de la cifra activa: se repliega solo, sin desplazar el
          resto de la pantalla, hasta que el usuario decide consultarlo. */}
      <button type="button" onClick={() => setShowList((v) => !v)} className="w-full flex items-center justify-between mt-4 pt-3 border-t border-border-subtle text-[9px] font-black uppercase tracking-widest text-fg-muted hover:text-fg transition-colors touch-manipulation">
        <span>{active.list.length} Traspaso{active.list.length === 1 ? '' : 's'}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${showList ? 'rotate-180' : ''}`} />
      </button>
      {showList && (
        <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {active.list.length === 0 ? (
            <div className="py-4 text-center text-[9px] font-bold text-fg-faint uppercase tracking-widest">Sin traspasos en esta categoría</div>
          ) : active.list.map((t) => {
            const profit = t.netProfit ?? ((t.totalAmount ?? t.amount) - (t.originalCost || 0));
            const isAcademy = (t.originalCost ?? 0) === 0;
            return (
              <div key={t.id} className="p-2.5 bg-well rounded-xl border border-border-subtle">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-fg truncate">{t.playerName}</span>
                  <span className="text-[8px] font-black text-fg-faint uppercase tracking-widest shrink-0">TEMP {t.seasonNumber || 1}</span>
                </div>
                {/* Dos filas: origen del jugador (comprado o cantera) y el precio de venta,
                    con el beneficio/pérdida junto a esta última. */}
                <div className="mt-1.5 space-y-0.5">
                  <div className="text-[9px] font-bold text-fg-muted">{isAcademy ? 'Obtenido gratis (Cantera)' : `Comprado por ${formatCurrency(t.originalCost || 0)}`}</div>
                  <div className="flex items-center justify-between gap-2 text-[9px]">
                    <span className="font-bold text-fg-muted">Vendido por {formatCurrency(t.totalAmount ?? t.amount)}</span>
                    <span className={`font-black shrink-0 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{profit >= 0 ? '+' : ''}{formatCurrency(profit)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tarjeta desglosable análoga a ProfitabilityCard, pero para el lado del gasto: cada
// transacción de tipo "compra" ya guarda el coste del traspaso (amount) y la ficha salarial
// pactada (wageMonthly — nombre de campo heredado en Firestore, pero contiene la cifra
// semanal desde que p.wage/t.wage pasaron a guardarse en semanal; ver logTransaction en
// ClubDataContext), así que no hace falta cruzar con la plantilla actual — funciona igual
// aunque el jugador ya no esté en el club.
function SigningSpendCard({ transactions }) {
  const [showList, setShowList] = useState(false);
  const compras = [...transactions.filter((t) => t.type === 'compra')].sort((a, b) => b.date - a.date);
  const total = compras.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2 mb-4"><Tag size={13} /> Gasto en Fichajes</h3>
      <div className="text-2xl md:text-3xl font-black italic tracking-tighter truncate text-red-500">-{formatCurrency(total)}</div>
      <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1.5">Total pagado en traspasos por fichajes</p>

      <button type="button" onClick={() => setShowList((v) => !v)} className="w-full flex items-center justify-between mt-4 pt-3 border-t border-border-subtle text-[9px] font-black uppercase tracking-widest text-fg-muted hover:text-fg transition-colors touch-manipulation">
        <span>{compras.length} Fichaje{compras.length === 1 ? '' : 's'}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${showList ? 'rotate-180' : ''}`} />
      </button>
      {showList && (
        <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {compras.length === 0 ? (
            <div className="py-4 text-center text-[9px] font-bold text-fg-faint uppercase tracking-widest">Sin fichajes registrados</div>
          ) : compras.map((t) => (
            <div key={t.id} className="p-2.5 bg-well rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-fg truncate">{t.playerName}</span>
                <span className="text-[8px] font-black text-fg-faint uppercase tracking-widest shrink-0">TEMP {t.seasonNumber || 1}</span>
              </div>
              <div className="mt-1.5 space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[9px]"><span className="font-bold text-fg-muted">Coste del Traspaso</span><span className="font-black text-red-500">-{formatCurrency(t.amount)}</span></div>
                {/* Dos filas superpuestas (semana arriba, año abajo) en vez de un único valor
                    inline, para que quede claro que la ficha salarial pactada es semanal y a
                    la vez se vea su equivalente anual sin tener que calcularlo a mano. */}
                <div className="flex items-start justify-between gap-2 text-[9px]">
                  <span className="font-bold text-fg-muted pt-px">Ficha Salarial Pactada</span>
                  {t.wageMonthly ? (
                    <span className="text-right leading-tight shrink-0">
                      <span className="block font-black text-fg-secondary">{formatCurrency(t.wageMonthly)}/sem</span>
                      <span className="block font-bold text-fg-faint text-[8px] mt-0.5">{formatCurrency(t.wageMonthly * 52)}/año</span>
                    </span>
                  ) : (
                    <span className="font-black text-fg-secondary">Sin definir</span>
                  )}
                </div>
              </div>
            </div>
          ))}
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
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);
  const [statInfo, setStatInfo] = useState(null);
  const [showEvolutionInfo, setShowEvolutionInfo] = useState(false);

  const totalSpent = useMemo(() => transactions.filter((t) => t.type === 'compra').reduce((sum, t) => sum + (t.amount || 0), 0), [transactions]);
  const totalEarned = useMemo(() => transactions.filter((t) => t.type === 'venta').reduce((sum, t) => sum + (t.amount || 0), 0), [transactions]);
  const netBalance = totalEarned - totalSpent;

  // Evolución de ingresos (ventas) vs. gastos (compras) agrupada por Temporada (no por mes):
  // cada transacción guarda su "seasonNumber" en el momento en que se registró (ver
  // logTransaction); las anteriores a ese cambio no lo tienen y se asumen de la Temporada 1.
  const seasonly = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (t.type !== 'compra' && t.type !== 'venta') return;
      const season = t.seasonNumber || 1;
      if (!map[season]) map[season] = { season, spent: 0, earned: 0 };
      if (t.type === 'compra') map[season].spent += t.amount || 0;
      else map[season].earned += t.amount || 0;
    });
    return Object.values(map).sort((a, b) => a.season - b.season);
  }, [transactions]);
  const maxSeasonly = Math.max(1, ...seasonly.flatMap((s) => [s.spent, s.earned]));

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

  // Proyección de balance: Presupuesto actual + Ingresos proyectados (media histórica de lo
  // ingresado por temporada, 0 si todavía no hay ninguna venta registrada) - Compromiso
  // salarial restante (masa salarial semanal sostenida 26 semanas ≈ 6 meses, estimación
  // simple e ilustrativa de "lo que queda de temporada", no una previsión financiera real).
  const transferBudget = activeClub?.transferBudget || 0;
  const projectedIncome = seasonly.length > 0 ? Math.round(seasonly.reduce((sum, s) => sum + s.earned, 0) / seasonly.length) : 0;
  const WEEKS_REMAINING_ESTIMATE = 26;
  const wageCommitment = totalWage * WEEKS_REMAINING_ESTIMATE;
  const finalBalance = transferBudget + projectedIncome - wageCommitment;

  const breakdownViews = {
    signing: { tabLabel: 'Fichajes', icon: Tag, groups: signingGroups, total: totalSpentByGroup, emptyLabel: 'Sin fichajes registrados', barColor: 'bg-red-500', playerLabel: 'fichajes' },
    wage: { tabLabel: 'Salarial', icon: Shirt, groups: wageGroups, total: totalWage, emptyLabel: 'Sin sueldos registrados', barColor: 'bg-blue-500', playerLabel: 'jugadores' },
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={TrendingDown} label="Gasto en Fichajes" value={formatCurrency(totalSpent)} accent="text-red-500" onInfoClick={() => setStatInfo('spent')} />
        <StatCard icon={TrendingUp} label="Ingresos (Bruto)" value={formatCurrency(totalEarned)} accent="text-green-500" onInfoClick={() => setStatInfo('earned')} />
        <StatCard icon={Scale} label="Balance Neto" value={formatCurrency(netBalance)} accent={netBalance >= 0 ? 'text-green-500' : 'text-red-500'} onInfoClick={() => setStatInfo('balance')} />
      </div>
      {statInfo && (
        <InfoModal
          title={statInfo === 'spent' ? 'Gasto en Fichajes' : statInfo === 'earned' ? 'Ingresos (Bruto)' : 'Balance Neto'}
          onClose={() => setStatInfo(null)}
        >
          {statInfo === 'spent' && <p>Refleja el gasto acumulado en traspasos y compras directas de jugadores.</p>}
          {statInfo === 'earned' && <p>Es el dinero bruto total ingresado por todas las ventas de futbolistas realizadas.</p>}
          {statInfo === 'balance' && (
            <>
              <p>Es la diferencia directa entre los ingresos brutos y los gastos totales en fichajes.</p>
              <p className="p-2.5 bg-well rounded-xl border border-border-subtle text-fg font-black text-center">Ingresos (Bruto) − Gasto en Fichajes = Balance Neto</p>
            </>
          )}
        </InfoModal>
      )}

      <ProfitabilityCard transactions={transactions} />

      <SigningSpendCard transactions={transactions} />

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><LineChart size={13} /> Evolución de Ingresos vs. Gastos por Temporada</h3>
          <button type="button" onClick={() => setShowEvolutionInfo(true)} className="p-1 -m-1 text-fg-faint hover:text-fg transition-colors shrink-0 touch-manipulation"><Info size={13} /></button>
        </div>
        {showEvolutionInfo && (
          <InfoModal title="Evolución de Ingresos vs. Gastos por Temporada" onClose={() => setShowEvolutionInfo(false)}>
            <p>Compara el balance financiero total acumulado curso a curso, contrastando lo ingresado por ventas con lo gastado en fichajes en cada temporada.</p>
            <p>Cada barra verde es el total de ventas de esa temporada; cada barra roja, el total gastado en fichajes en esa misma temporada.</p>
          </InfoModal>
        )}
        {seasonly.length === 0 ? (
          <div className="py-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin movimientos todavía</div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2 h-32">
              {seasonly.map((s) => (
                <div key={s.season} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full flex items-end justify-center gap-1 flex-1">
                    <div className="w-2.5 bg-green-500 rounded-t-sm transition-all" style={{ height: `${Math.max((s.earned / maxSeasonly) * 100, s.earned > 0 ? 4 : 0)}%` }} title={`Ingresos: ${formatCurrency(s.earned)}`} />
                    <div className="w-2.5 bg-red-500 rounded-t-sm transition-all" style={{ height: `${Math.max((s.spent / maxSeasonly) * 100, s.spent > 0 ? 4 : 0)}%` }} title={`Gastos: ${formatCurrency(s.spent)}`} />
                  </div>
                  <span className="text-[8px] text-fg-faint font-black uppercase tracking-widest mt-1.5">TEMP {s.season}</span>
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic flex items-center gap-2"><Wallet size={13} /> Proyección de Balance</h3>
          <button type="button" onClick={() => setShowBalanceInfo(true)} className="p-1 -m-1 text-fg-faint hover:text-fg transition-colors shrink-0 touch-manipulation"><Info size={13} /></button>
        </div>
        {showBalanceInfo && (
          <InfoModal title="Proyección de Balance" onClose={() => setShowBalanceInfo(false)}>
            <p>Estima el saldo disponible al cierre de temporada combinando tres cifras:</p>
            <p className="p-2.5 bg-well rounded-xl border border-border-subtle text-fg font-black text-center leading-relaxed">Presupuesto Actual<br />+ Ingresos Previstos<br />− Masa Salarial Restante<br />= Balance Final Estimado</p>
            <p><span className="text-fg font-black">Presupuesto Actual:</span> el saldo de traspasos disponible hoy mismo.</p>
            <p><span className="text-fg font-black">Ingresos Previstos:</span> la media histórica de lo ingresado por temporada en ventas.</p>
            <p><span className="text-fg font-black">Masa Salarial Restante:</span> la masa salarial semanal actual acumulada hasta final de temporada (estimada en {WEEKS_REMAINING_ESTIMATE} semanas).</p>
          </InfoModal>
        )}
        <div className={`text-lg sm:text-xl md:text-3xl font-black italic tracking-tighter truncate ${finalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(finalBalance)}</div>
        <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${finalBalance >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
          {finalBalance >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {finalBalance >= 0 ? 'Superávit Previsto' : 'Riesgo de Déficit'}
        </div>

        {/* Desglose visual del cálculo, línea a línea, para que la cifra final nunca se sienta
            "sacada de la nada". */}
        <div className="mt-4 pt-3 border-t border-border-subtle space-y-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-fg-muted">Presupuesto Actual</span>
            <span className="font-black text-fg">{formatCurrency(transferBudget)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-fg-muted">+ Ingresos Proyectados</span>
            <span className="font-black text-green-500">+{formatCurrency(projectedIncome)}</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-bold text-fg-muted">− Compromiso Salarial Restante</span>
            <span className="font-black text-red-500">-{formatCurrency(wageCommitment)}</span>
          </div>
          <div className="h-px bg-border-subtle my-1" />
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-black text-fg-secondary">= Balance Final Estimado</span>
            <span className={`font-black ${finalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(finalBalance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
