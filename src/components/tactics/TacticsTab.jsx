import { useState } from 'react';
import { useClubData } from '../../context/ClubDataContext';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { getCardStyle } from '../../utils/cardStyle';
import SavedFormationsBar from './SavedFormationsBar';
import FormationPitch from './FormationPitch';
import BenchGrid from './BenchGrid';
import UncalledZone from './UncalledZone';
import PickingSlotModal from './PickingSlotModal';
import PlayerInfoModal from '../squad/PlayerInfoModal';
import PlayerForm from '../squad/PlayerForm';

export default function TacticsTab({ onNavigateToScouting }) {
  const { players, executeMove } = useClubData();
  const dnd = useDragAndDrop({ players, executeMove });
  const { floatingDrag } = dnd;

  const [pickingSlot, setPickingSlot] = useState(null);
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState(null);
  const [infoSlot, setInfoSlot] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);

  const openInfo = (player, slot) => { setSelectedPlayerInfo(player); setInfoSlot(slot); };

  // PlayerInfoModal y PickingSlotModal ocultan la cabecera y la navegación por sí mismos
  // (useAutoHideChrome), así que aquí ya no hace falta gestionarlo desde el padre.

  return (
    <div className="space-y-4 animate-in fade-in">
      <SavedFormationsBar />

      <FormationPitch
        dnd={dnd}
        onEmptySlotClick={(idx) => setPickingSlot(idx)}
        onPlayerSlotClick={(player, idx) => openInfo(player, idx)}
      />

      <BenchGrid
        dnd={dnd}
        onEmptySlotClick={(slot) => setPickingSlot(slot)}
        onPlayerSlotClick={(player, slot) => openInfo(player, slot)}
      />

      <UncalledZone dnd={dnd} onPlayerClick={(player, slot) => openInfo(player, slot)} />

      {floatingDrag && (
        <div style={{ left: floatingDrag.x, top: floatingDrag.y }} className={`fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl border-2 border-black/20 flex flex-col items-center justify-center font-black shadow-2xl ${getCardStyle(floatingDrag.player.rating)}`}>
          <span className="text-[8px] opacity-70 font-bold mb-0.5 uppercase">{floatingDrag.player.positions?.[0]}</span><span className="text-base">{floatingDrag.player.rating}</span>
        </div>
      )}

      {pickingSlot !== null && <PickingSlotModal pickingSlot={pickingSlot} onClose={() => setPickingSlot(null)} onNavigateToScouting={onNavigateToScouting} />}

      {selectedPlayerInfo && (
        <PlayerInfoModal
          player={selectedPlayerInfo}
          infoSlot={infoSlot}
          onClose={() => setSelectedPlayerInfo(null)}
          onEdit={(p) => { setSelectedPlayerInfo(null); setEditingPlayer(p); }}
          onReplace={(slot) => { setSelectedPlayerInfo(null); setPickingSlot(slot); }}
          hideMarketStatus
        />
      )}

      {/* Editar desde Táctica (titular, banquillo o no convocados) va directo al Paso 4
          con los datos precargados, igual que "Editar" en la Plantilla — sin pasar por
          los pasos 1-3 del asistente. */}
      {editingPlayer && <PlayerForm editingPlayer={editingPlayer} initialStep={4} onClose={() => setEditingPlayer(null)} />}
    </div>
  );
}
