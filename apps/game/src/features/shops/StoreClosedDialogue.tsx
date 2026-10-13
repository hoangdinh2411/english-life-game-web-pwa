import { venueHoursLabel } from '@life-abroad/shared';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import type { StoreLocation } from '../../types/gameplay/world';
import shopPortraits from '../../../assets/npcs/shop-npcs.png';
import { SHOP_NPCS, type ShopNpcId } from './shop-npcs';

const storeOwners: Record<StoreLocation, { id: ShopNpcId; portraitPosition: string }> = {
  cafe: { id: 'npc_mia', portraitPosition: '0% 0%' },
  corner_cafe: { id: 'npc_corner_cup_seller', portraitPosition: '100% 0%' },
  clothes: { id: 'npc_clothes_seller', portraitPosition: '0% 100%' },
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
  const owner = SHOP_NPCS.find((npc) => npc.id === storeOwner.id)!;
  const message = gameTimeAvailable
    ? `Sorry, the store is closed. Opening hours are: ${venueHoursLabel('store')}.`
    : "Sorry, I can’t confirm whether the store is open right now. Please try again in a moment.";

  return (
    <DialogueFrame>
      <DialogueMessage
        name={owner.name}
        portrait={shopPortraits}
        portraitPosition={storeOwner.portraitPosition}
        text={message}
      />
      <GameButton label="Return to town" onClick={onReturn} />
    </DialogueFrame>
  );
}
