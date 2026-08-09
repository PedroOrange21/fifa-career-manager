import { useState } from 'react';
import { Minus, Plus, Flag, Square, X, CheckCircle2 } from 'lucide-react';
import { useClubData } from '../../context/ClubDataContext';
import { getCardStyle } from '../../utils/cardStyle';

const EVENT_TYPES = [
  { id: 'gol', label: 'Gol', className: 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20' },
  { id: 'asistencia', label: 'Asist.', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20' },
  { id: 'amarilla', label: 'T.A.', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20' },
  { id: 'roja', label: 'T.R.', className: 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' },
];

export default function MatchControlPanel({ opponent, starters, onFinish, onCancel }) {
  const { saveMatch } = useClubData();
  const [minute, setMinute] = useState(1);
  const [rivalScore, setRivalScore] = useState(0);
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);

  const scoreFor = events.filter((e) => e.type === 'gol').length;

  const addEvent = (player, type) => {
    setEvents((prev) => [...prev, { id: crypto.randomUUID(), minute, type, playerId: player.id, playerName: player.name }]);
  };

  const removeEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveMatch({
        opponent, scoreFor, scoreAgainst: rivalScore,
        events: events.map(({ minute, type, playerId }) => ({ minute, type, playerId })),
        lineupPlayerIds: starters.map((p) => p.id),
      });
      onFinish();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-surface p-5 rounded-[24px] md:rounded-[32px] border border-border-subtle shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-[9px] font-black uppercase tracking-widest text-fg-muted mb-1">Tu Equipo</div>
            <div className="text-3xl font-black text-green-500">{scoreFor}</div>
          </div>
          <div className="text-fg-faint font-black text-lg px-2">—</div>
          <div className="text-center flex-1">
            <div className="text-[9px] font-black uppercase tracking-widest text-fg-muted mb-1 truncate">{opponent}</div>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setRivalScore((v) => Math.max(0, v - 1))} className="p-1.5 bg-well rounded-lg text-fg-muted hover:text-fg"><Minus size={14} /></button>
              <div className="text-3xl font-black text-fg w-10 text-center">{rivalScore}</div>
              <button onClick={() => setRivalScore((v) => v + 1)} className="p-1.5 bg-well rounded-lg text-fg-muted hover:text-fg"><Plus size={14} /></button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-border-subtle">
          <Flag size={14} className="text-fg-muted" />
          <button onClick={() => setMinute((m) => Math.max(1, m - 1))} className="p-1.5 bg-well rounded-lg text-fg-muted hover:text-fg"><Minus size={14} /></button>
          <span className="text-sm font-black text-fg w-16 text-center">Min. {minute}</span>
          <button onClick={() => setMinute((m) => m + 1)} className="p-1.5 bg-well rounded-lg text-fg-muted hover:text-fg"><Plus size={14} /></button>
        </div>
      </div>

      <div className="space-y-2">
        {starters.map((p) => (
          <div key={p.id} className="bg-surface p-3 rounded-2xl border border-border-subtle shadow-lg flex items-center gap-2">
            <div className={`w-9 h-9 rounded-lg flex shrink-0 items-center justify-center font-black text-[10px] ${getCardStyle(p.rating)}`}>{p.rating}</div>
            <span className="text-xs font-bold uppercase italic text-black dark:text-white truncate flex-1 min-w-0">{p.name}</span>
            <div className="flex gap-1 shrink-0">
              {EVENT_TYPES.map((et) => (
                <button key={et.id} onClick={() => addEvent(p, et.id)} className={`px-2.5 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${et.className}`}>{et.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-[24px] border border-border overflow-hidden shadow-2xl">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-fg-muted italic p-4 pb-2 flex items-center gap-2"><Square size={12} /> Registro del Partido</h3>
        <div className="divide-y divide-border-subtle max-h-64 overflow-y-auto no-scrollbar">
          {events.length === 0 && <div className="p-6 text-center text-fg-faint font-black italic uppercase tracking-widest text-[10px]">Sin eventos todavía</div>}
          {[...events].reverse().map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs text-fg-secondary"><span className="font-black text-fg-muted">{e.minute}'</span> {EVENT_TYPES.find((t) => t.id === e.type)?.label} — <span className="font-bold text-fg">{e.playerName}</span></span>
              <button onClick={() => removeEvent(e.id)} className="p-1 text-fg-faint hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-4 rounded-2xl bg-well text-fg-muted font-black uppercase text-[10px] hover:bg-well-strong transition-all">Cancelar</button>
        <button disabled={saving} onClick={handleFinish} className="flex-[2] py-4 rounded-2xl bg-green-500 text-black font-black uppercase text-xs shadow-xl hover:bg-green-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 size={16} /> Finalizar Partido</button>
      </div>
    </div>
  );
}
