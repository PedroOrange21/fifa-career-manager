import { useState } from 'react';
import { Tag, Plus, ArrowRightLeft } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { abbreviateValue } from '../../utils/format';
import PlayerInfoModal from '../squad/PlayerInfoModal';
import SellPlayerModal from '../economy/SellPlayerModal';
import LoanOutModal from '../economy/LoanOutModal';
import AddOperationPlayerModal from './AddOperationPlayerModal';

function OperationRow({ player, chipClassName, chipTextClassName, onClick, children }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border cursor-pointer ${chipClassName}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(player.rating)}`}>{player.rating}</div>
        <div className="flex flex-col min-w-0"><span className="text-[10px] font-bold uppercase italic text-black dark:text-white truncate">{player.name}</span><span className={`text-[8px] font-black uppercase tracking-widest truncate ${chipTextClassName}`}>{player.positions?.join(' · ')}</span></div>
      </div>
      {children}
    </div>
  );
}

export default function OperationsTab({ onRequestEditPlayer }) {
  const { players } = useClubData();
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null);
  const [infoSlot, setInfoSlot] = useState(null);
  const [sellingPlayer, setSellingPlayer] = useState(null);
  const [loaningPlayer, setLoaningPlayer] = useState(null);
  const [addingStatus, setAddingStatus] = useState(null);

  const forSale = players.filter((p) => p.transferStatus === 'Transferible').sort((a, b) => b.rating - a.rating);
  const forLoan = players.filter((p) => p.transferStatus === 'Cedible').sort((a, b) => b.rating - a.rating);
  const loanedOut = players.filter((p) => p.transferStatus === 'CedidoFuera').sort((a, b) => b.rating - a.rating);

  const openInfo = (player, slot) => { setSelectedPlayerInfo(player); setInfoSlot(slot); };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-surface p-4 rounded-[24px] border border-red-500/10 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500/60 italic">En Venta (Transferibles)</h3>
          <button onClick={() => setAddingStatus('Transferible')} title="Añadir jugador a la lista" className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"><Plus size={14} /></button>
        </div>
        <div className="grid gap-2">
          {forSale.map((p) => (
            <OperationRow key={p.id} player={p} onClick={() => openInfo(p, 'forSale')} chipClassName="bg-red-500/5 border-red-500/10" chipTextClassName="text-red-400">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[8px] text-red-400 font-black uppercase">{abbreviateValue(p.marketValue || p.value)}</span>
                <button onClick={(e) => { e.stopPropagation(); setSellingPlayer(p); }} className="bg-red-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm flex items-center gap-1"><Tag size={11} /> Vender</button>
              </div>
            </OperationRow>
          ))}
          {forSale.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Vacío. Añade jugadores con el botón "+".</span>}
        </div>
      </div>

      <div className="bg-surface p-4 rounded-[24px] border border-yellow-500/10 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60 italic">Lista de Cedibles</h3>
          <button onClick={() => setAddingStatus('Cedible')} title="Añadir jugador a la lista" className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-all"><Plus size={14} /></button>
        </div>
        <div className="grid gap-2">
          {forLoan.map((p) => (
            <OperationRow key={p.id} player={p} onClick={() => openInfo(p, 'forLoan')} chipClassName="bg-yellow-500/5 border-yellow-500/10" chipTextClassName="text-yellow-500">
              <button onClick={(e) => { e.stopPropagation(); setLoaningPlayer(p); }} className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm flex items-center gap-1 shrink-0"><ArrowRightLeft size={11} /> Ceder</button>
            </OperationRow>
          ))}
          {forLoan.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Vacío. Añade jugadores con el botón "+".</span>}
        </div>
      </div>

      <div className="bg-surface p-4 rounded-[24px] border border-border-subtle shadow-2xl opacity-80">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic mb-3">Cedidos a otros Clubes</h3>
        <div className="grid gap-2">
          {loanedOut.map((p) => (
            <OperationRow key={p.id} player={p} onClick={() => openInfo(p, 'loanedOut')} chipClassName="bg-well border-border-subtle" chipTextClassName="text-fg-faint">
              {p.outboundLoan && (
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-black text-fg-secondary uppercase truncate max-w-[100px]">{p.outboundLoan.destinationClub}</div>
                  <div className="text-[8px] text-fg-faint font-black uppercase">{p.outboundLoan.wagePercentage}% Salario</div>
                </div>
              )}
            </OperationRow>
          ))}
          {loanedOut.length === 0 && <span className="text-[10px] text-fg-faint italic p-2">Sin jugadores cedidos fuera.</span>}
        </div>
      </div>

      {selectedPlayerInfo && (
        <PlayerInfoModal
          player={selectedPlayerInfo}
          infoSlot={infoSlot}
          onClose={() => setSelectedPlayerInfo(null)}
          onEdit={(p) => { setSelectedPlayerInfo(null); onRequestEditPlayer(p); }}
          onReplace={() => {}}
        />
      )}

      {sellingPlayer && <SellPlayerModal player={sellingPlayer} onClose={() => setSellingPlayer(null)} />}
      {loaningPlayer && <LoanOutModal player={loaningPlayer} onClose={() => setLoaningPlayer(null)} />}
      {addingStatus && (
        <AddOperationPlayerModal
          status={addingStatus}
          title={addingStatus === 'Transferible' ? 'Añadir a Transferibles' : 'Añadir a Cedibles'}
          onClose={() => setAddingStatus(null)}
        />
      )}
    </div>
  );
}
