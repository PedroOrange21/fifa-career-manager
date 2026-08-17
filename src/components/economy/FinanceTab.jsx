import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Users2, Edit2, Check, X, List, ChevronDown, ChevronUp } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency, formatValueInput, parseValue } from '../../utils/format';
import WageBreakdownModal from './WageBreakdownModal';

// Línea de desglose reutilizada dentro del panel expandible de cada transacción.
function DetailLine({ label, value }) {
  return (
    <div className="flex justify-between items-center gap-2 text-[10px]">
      <span className="font-bold text-fg-muted">{label}</span>
      <span className="font-black text-fg text-right">{value}</span>
    </div>
  );
}

// Sueldo mensual que realmente carga a nuestro club: el total del jugador, salvo que esté
// cedido fuera, caso en el que solo pesa el porcentaje que asumimos nosotros. Se usa tanto
// para el total de la tarjeta como para cada línea del desglose, así ambos números siempre
// cuadran entre sí.
const getEffectiveWage = (p) => {
  if (p.transferStatus === 'CedidoFuera') {
    const pct = p.outboundLoan?.wagePercentage ?? 0;
    return (p.wage || 0) * (pct / 100);
  }
  return p.wage || 0;
};

export default function FinanceTab() {
  const { activeClub, setBudget } = useClubs();
  const { players, transactions } = useClubData();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [showWageBreakdown, setShowWageBreakdown] = useState(false);
  const [expandedTx, setExpandedTx] = useState(null);

  const wageBill = players.reduce((sum, p) => sum + getEffectiveWage(p), 0);
  // De mayor a menor sueldo individual; se excluyen los que no cargan nada al club (p. ej.
  // canteranos sin contrato todavía) para no llenar el desglose de líneas a 0 €.
  const wageBreakdown = players
    .map((p) => ({ ...p, effectiveWage: getEffectiveWage(p) }))
    .filter((p) => p.effectiveWage > 0)
    .sort((a, b) => b.effectiveWage - a.effectiveWage);
  const transferBudget = activeClub?.transferBudget || 0;

  const startEditingBudget = () => { setBudgetInput(formatValueInput(String(transferBudget))); setEditingBudget(true); };
  const confirmBudget = async (e) => {
    e.preventDefault();
    await setBudget(parseValue(budgetInput));
    setEditingBudget(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-gradient-to-br from-green-500/20 to-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-green-500/30 shadow-2xl relative overflow-hidden">
        <Wallet className="absolute -bottom-4 -right-4 text-green-500/10 w-32 h-32 md:w-40 md:h-40" />
        <div className="flex items-center justify-between mb-2 relative">
          <span className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-2"><Wallet size={14} /> Presupuesto de Traspasos</span>
          {!editingBudget && (<button onClick={startEditingBudget} className="p-1.5 text-fg-faint hover:text-green-500 transition-colors bg-well rounded-lg"><Edit2 size={12} /></button>)}
        </div>
        {editingBudget ? (
          <form onSubmit={confirmBudget} className="flex items-center gap-2 mt-2 relative">
            <input autoFocus type="text" className="flex-1 bg-well p-3 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-center font-black text-lg text-fg" value={budgetInput} onChange={(e) => setBudgetInput(formatValueInput(e.target.value))} />
            <button type="submit" className="p-3 bg-green-500 text-black rounded-xl"><Check size={16} /></button>
            <button type="button" onClick={() => setEditingBudget(false)} className="p-3 bg-well text-fg-muted rounded-xl"><X size={16} /></button>
          </form>
        ) : (
          <div className={`text-3xl md:text-4xl font-black italic tracking-tighter relative ${transferBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(transferBudget)}</div>
        )}
      </div>

      <div className="bg-surface p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted flex items-center gap-2"><Users2 size={14} /> Masa Salarial Mensual</span>
          <button type="button" onClick={() => setShowWageBreakdown(true)} title="Ver desglose" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-well text-fg-muted hover:text-fg hover:bg-well-strong transition-colors text-[9px] font-black uppercase tracking-widest">
            <List size={12} /> Ver Desglose
          </button>
        </div>
        <div className="text-xl md:text-2xl font-black italic tracking-tighter text-fg">{formatCurrency(wageBill)}</div>
        <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1">Suma de salarios de la plantilla activa</p>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2">Historial de Transacciones</h3>
        <div className="divide-y divide-border-subtle">
          {transactions.length === 0 && (<div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin movimientos todavía</div>)}
          {transactions.map((t) => {
            // Solo venta y cesión tienen condiciones adicionales que merezcan un desglose;
            // una compra es un único importe sin más matices que mostrar.
            const hasDetail = t.type === 'venta' || t.type === 'cesion';
            const isOpen = expandedTx === t.id;
            return (
              <div key={t.id}>
                <div className="p-3 md:p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'compra' ? 'bg-red-500/10 text-red-500' : t.type === 'cesion' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>{t.type === 'compra' ? <TrendingDown size={16} /> : t.type === 'cesion' ? <ArrowRightLeft size={16} /> : <TrendingUp size={16} />}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-fg truncate">{t.playerName}</div>
                      <div className="text-[9px] text-fg-faint font-black uppercase tracking-widest truncate">{t.type === 'cesion' && 'Ahorro salarial · '}{new Date(t.date).toLocaleDateString('es-ES')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className={`font-black text-sm ${t.type === 'compra' ? 'text-red-500' : t.type === 'cesion' ? 'text-blue-500' : 'text-green-500'}`}>{t.type === 'compra' ? '-' : '+'}{formatCurrency(t.amount)}</div>
                    {hasDetail && (
                      <button type="button" onClick={() => setExpandedTx(isOpen ? null : t.id)} title="Ver desglose" className="p-1 rounded-lg text-fg-faint hover:text-fg hover:bg-well transition-colors">
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && hasDetail && (
                  <div className="px-3 pb-3 md:px-4 md:pb-4 -mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-3 bg-well rounded-xl border border-border-subtle space-y-1.5">
                      {t.type === 'venta' && (
                        <>
                          <DetailLine label="Precio Total" value={formatCurrency(t.totalAmount ?? t.amount)} />
                          <DetailLine label="Añadido a Presupuesto" value={formatCurrency(t.amount)} />
                          <DetailLine label="Retención del Club" value={formatCurrency(t.retainedAmount || 0)} />
                          {t.wageFreed ? <DetailLine label="Salario Liberado" value={`${formatCurrency(t.wageFreed)}/mes`} /> : null}
                        </>
                      )}
                      {t.type === 'cesion' && (
                        <>
                          <DetailLine label="Club Destino" value={t.club || 'Sin definir'} />
                          <DetailLine label="Duración" value={t.duration || 'Sin definir'} />
                          <DetailLine label="% Pagado por Nosotros" value={`${t.wagePercentage ?? 0}%`} />
                          <DetailLine label="Ahorro Mensual" value={`${formatCurrency(t.amount)}/mes`} />
                          {t.buyOption ? <DetailLine label="Opción de Compra" value={formatCurrency(t.buyOption)} /> : null}
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

      {showWageBreakdown && <WageBreakdownModal players={wageBreakdown} total={wageBill} onClose={() => setShowWageBreakdown(false)} />}
    </div>
  );
}
