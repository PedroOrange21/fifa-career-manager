import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Users2, Edit2, Check, X } from 'lucide-react';
import { useClubs } from '../../context/ClubsContext';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency, formatValueInput, parseValue } from '../../utils/format';

export default function FinanceTab() {
  const { activeClub, setBudget } = useClubs();
  const { players, transactions } = useClubData();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const wageBill = players.reduce((sum, p) => {
    if (p.transferStatus === 'CedidoFuera') {
      const pct = p.outboundLoan?.wagePercentage ?? 0;
      return sum + (p.wage || 0) * (pct / 100);
    }
    return sum + (p.wage || 0);
  }, 0);
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
        <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted flex items-center gap-2 mb-2"><Users2 size={14} /> Masa Salarial Mensual</span>
        <div className="text-xl md:text-2xl font-black italic tracking-tighter text-fg">{formatCurrency(wageBill)}</div>
        <p className="text-[9px] text-fg-faint font-bold uppercase tracking-widest mt-1">Suma de salarios de la plantilla activa</p>
      </div>

      <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2">Historial de Transacciones</h3>
        <div className="divide-y divide-border-subtle">
          {transactions.length === 0 && (<div className="p-10 text-center text-fg-faint font-black italic uppercase tracking-widest text-xs">Sin movimientos todavía</div>)}
          {transactions.map((t) => (
            <div key={t.id} className="p-3 md:p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'compra' ? 'bg-red-500/10 text-red-500' : t.type === 'cesion' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>{t.type === 'compra' ? <TrendingDown size={16} /> : t.type === 'cesion' ? <ArrowRightLeft size={16} /> : <TrendingUp size={16} />}</div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-fg truncate">{t.playerName}</div>
                  <div className="text-[9px] text-fg-faint font-black uppercase tracking-widest">{t.type === 'cesion' ? 'Ahorro salarial · ' : ''}{new Date(t.date).toLocaleDateString('es-ES')}</div>
                </div>
              </div>
              <div className={`font-black text-sm shrink-0 ${t.type === 'compra' ? 'text-red-500' : t.type === 'cesion' ? 'text-blue-500' : 'text-green-500'}`}>{t.type === 'compra' ? '-' : '+'}{formatCurrency(t.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
