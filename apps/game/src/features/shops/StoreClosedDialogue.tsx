import { venueHoursLabel } from '@life-abroad/shared';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import type { StoreLocation } from '../../types/gameplay/world';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from '../npcs/npc-portraits';

const storeOwners: Record<StoreLocation, ShopNpcId> = {
  cafe: 'npc_mia',
  corner_cafe: 'npc_corner_cup_seller',
  clothes: 'npc_clothes_seller',
};

export function StoreClosedDialogue({
  location,
  gameTimeAvailable,
  onReturn,
}: {
  location: StoreLocation;
  gameTimeAvailable: boolean;
  onReturn: () => void;
}) {
  const storeOwner = storeOwners[location];
  const owner = SHOP_NPCS.find((npc) => npc.id === storeOwner)!;
  const message = gameTimeAvailable
    ? `Sorry, the store is closed. Opening hours are: ${venueHoursLabel('store')}.`
    : "Sorry, I can’t confirm whether the store is open right now. Please try again in a moment.";

  return (
    <DialogueFrame>
      <DialogueMessage
        name={owner.name}
        portrait={npcPortrait(owner.id)}
        portraitPosition={npcPortraitPosition(message)}
        portraitGrid={NPC_PORTRAIT_GRID}
        text={message}
      />
      <GameButton label="Return to town" onClick={onReturn} />
    </DialogueFrame>
  );
}
