import { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet, Scale, ListOrdered, Search, MapPin, History } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { formatCurrency } from '../../utils/format';

// Metadatos visuales por tipo de movimiento: icono, color y signo del importe. "rescision" se
// deja preparado (mismo esquema que el resto) por si en el futuro se registra ese tipo de
// transacción, aunque hoy la app todavía no genera ninguna.
const TYPE_META = {
  compra: { label: 'Alta · Compra', icon: TrendingDown, badge: 'bg-red-500/10 text-red-500 border-red-500/20', dot: 'bg-red-500', sign: '-' },
  venta: { label: 'Baja · Venta', icon: TrendingUp, badge: 'bg-green-500/10 text-green-500 border-green-500/20', dot: 'bg-green-500', sign: '+' },
  cesion: { label: 'Cesión', icon: ArrowRightLeft, badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dot: 'bg-blue-500', sign: '' },
  rescision: { label: 'Rescisión', icon: History, badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', dot: 'bg-yellow-500', sign: '-' },
};
const typeMeta = (type) => TYPE_META[type] || TYPE_META.cesion;

const TYPE_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'compra', label: 'Altas' },
  { id: 'venta', label: 'Bajas' },
  { id: 'cesion', label: 'Cesiones' },
];

function StatBlock({ icon: Icon, label, value, accent = 'text-fg' }) {
  return (
    <div className="bg-well/70 rounded-2xl p-3 border border-border-subtle min-w-0">
      <Icon size={14} className={`mb-1.5 ${accent}`} />
      <div className={`text-base md:text-lg font-black italic truncate ${accent}`}>{value}</div>
      <div className="text-[8px] font-black uppercase tracking-widest text-fg-faint leading-tight mt-0.5">{label}</div>
    </div>
  );
}

// Centro de Transferencias: historial completo de movimientos financieros del club (altas,
// bajas y cesiones), con métricas agregadas en cabecera y filtros rápidos. Sustituye a la
// antigua vista de gestión de Transferibles/Cedibles — esas acciones (marcar, vender, ceder)
// siguen disponibles desde la Plantilla; aquí se centraliza únicamente el registro histórico.
export default function OperationsTab() {
  const { transactions } = useClubData();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const totalSpent = transactions.filter((t) => t.type === 'compra').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalEarned = transactions.filter((t) => t.type === 'venta').reduce((sum, t) => sum + (t.amount || 0), 0);
  const netBalance = totalEarned - totalSpent;

  const filtered = transactions
    .filter((t) => t.playerName.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((t) => !typeFilter || t.type === typeFilter);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Métricas financieras: gasto, ingresos, balance neto y volumen total de movimientos. */}
      <div className="bg-gradient-to-br from-surface to-well/40 rounded-[24px] border border-border-subtle shadow-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <History size={15} className="text-green-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Centro de Transferencias</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatBlock icon={TrendingDown} label="Gasto en Fichajes" value={formatCurrency(totalSpent)} accent="text-red-500" />
          <StatBlock icon={TrendingUp} label="Ingresos por Ventas" value={formatCurrency(totalEarned)} accent="text-green-500" />
          <StatBlock icon={Scale} label="Balance Neto" value={formatCurrency(netBalance)} accent={netBalance >= 0 ? 'text-green-500' : 'text-red-500'} />
          <StatBlock icon={ListOrdered} label="Total Movimientos" value={transactions.length} />
        </div>
      </div>

      {/* Buscador y filtro rápido por tipo de operación. */}
      <div className="bg-surface p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-border-subtle shadow-2xl space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" size={14} />
          <input type="text" placeholder="Buscar por jugador..." className="w-full h-9 bg-well pl-9 pr-3 rounded-xl border border-border-subtle outline-none focus:border-green-500 text-sm font-bold text-fg placeholder:text-fg-faint max-md:placeholder:text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {TYPE_FILTERS.map(({ id, label }) => (
            <button key={id} onClick={() => setTypeFilter(id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${typeFilter === id ? 'bg-green-500 text-black' : 'bg-well text-fg-muted border border-border-subtle hover:bg-well-strong'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Historial: listado visual con badge de tipo, importe, y club implicado si se conoce
          (solo disponible hoy para cesiones, ver destinationClub en cedePlayer). */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-[28px] border border-dashed border-border-subtle p-10 md:p-14 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <History size={28} className="text-green-500" />
          </div>
          <h3 className="text-base font-black uppercase italic text-fg">{transactions.length === 0 ? 'Sin Movimientos Todavía' : 'Sin Resultados'}</h3>
          <p className="text-xs text-fg-muted font-bold max-w-xs">{transactions.length === 0 ? 'Aquí aparecerán automáticamente tus fichajes, ventas y cesiones en cuanto los registres.' : 'Ajusta la búsqueda o el filtro para encontrar movimientos.'}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[24px] md:rounded-[32px] border border-border overflow-hidden divide-y divide-border-subtle shadow-2xl">
          {filtered.map((t) => {
            const meta = typeMeta(t.type);
            const Icon = meta.icon;
            return (
              <div key={t.id} className="p-3 md:p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.badge}`}><Icon size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-fg truncate">{t.playerName}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border ${meta.badge}`}>{meta.label}</span>
                    {t.club && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-well text-fg-muted flex items-center gap-1"><MapPin size={9} /> {t.club}</span>
                    )}
                    <span className="text-[9px] text-fg-faint font-bold">{new Date(t.date).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-black text-sm ${meta.sign === '-' ? 'text-red-500' : meta.sign === '+' ? 'text-green-500' : 'text-blue-500'}`}>{meta.sign}{formatCurrency(t.amount)}</div>
                  {t.type === 'cesion' && <div className="text-[8px] text-fg-faint font-bold uppercase tracking-widest flex items-center justify-end gap-1"><Wallet size={9} /> Ahorro Salarial</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
