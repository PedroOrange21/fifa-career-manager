import { useState } from 'react';
import { X, Search } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export default function AddOperationPlayerModal({ status, title, onClose }) {
  useBodyScrollLock();
  const { players, setPlayerTransferStatus } = useClubData();
  const [search, setSearch] = useState('');

  const eligible = players
    .filter((p) => p.transferStatus !== status && p.transferStatus !== 'CedidoFuera')
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.rating - a.rating);

  const pick = async (playerId) => {
    await setPlayerTransferStatus(playerId, status);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[150] p-4 md:p-6 flex flex-col animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface border border-border p-6 rounded-[32px] w-full max-w-sm mx-auto shadow-2xl relative my-auto flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-lg font-black uppercase italic tracking-tighter text-fg">{title}</h2>
          <button onClick={onClose} className="p-2 bg-well rounded-full hover:bg-well-strong transition-all text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        <div className="relative mb-3 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" size={16} />
          <input type="text" placeholder="Buscar jugador..." autoFocus className="w-full bg-well p-3 pl-11 rounded-xl outline-none border border-border-subtle focus:border-green-500 text-base md:text-xs font-bold text-fg placeholder:text-fg-faint" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-y-auto space-y-2 pr-1 no-scrollbar flex-1">
          {eligible.length === 0 && <p className="text-center text-fg-faint text-xs italic p-6">No hay jugadores disponibles.</p>}
          {eligible.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)} className="w-full p-3 rounded-2xl flex items-center gap-3 bg-well hover:bg-well-strong transition-all border border-transparent">
              <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black leading-none shrink-0 ${getCardStyle(p.rating)}`}><span className="text-[7px] opacity-70 mb-0.5">{p.positions?.[0]}</span><span className="text-base">{p.rating}</span></div>
              <div className="text-left flex-1 min-w-0"><div className="font-black uppercase italic text-sm truncate text-black dark:text-white">{p.name}</div><div className="text-[9px] text-fg-muted font-black uppercase">{p.positions?.join(' · ')}</div></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
