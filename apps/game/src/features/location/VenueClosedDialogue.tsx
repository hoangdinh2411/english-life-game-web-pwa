import { venueHoursLabel } from '@life-abroad/shared';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import type { ClosedVenueLocation } from '../../types/gameplay/world';
import { SHOP_NPCS, type ShopNpcId } from '../shops/shop-npcs';
import { TAX_OFFICE_STAFF } from '../tax-office/tax-office-staff';
import { isTaxOfficeStaff } from '../tax-office/tax-office-staff';
import { NPC_PORTRAIT_GRID, npcPortrait, npcPortraitPosition } from '../npcs/npc-portraits';

const storeOwners: Record<Exclude<ClosedVenueLocation, 'tax_office'>, ShopNpcId> = {
  cafe: 'npc_mia', corner_cafe: 'npc_corner_cup_seller', clothes: 'npc_clothes_seller',
};

export function VenueClosedDialogue({ location, conversationNpcId = null, gameTimeAvailable, onReturn }: {
  location: ClosedVenueLocation;
  conversationNpcId?: string | null;
  gameTimeAvailable: boolean;
  onReturn: () => void;
}) {
  const isOffice = location === 'tax_office';
  const conversationStaff = isOffice && isTaxOfficeStaff(conversationNpcId ?? '')
    ? TAX_OFFICE_STAFF.find(npc => npc.id === conversationNpcId)
    : SHOP_NPCS.find(npc => npc.id === conversationNpcId);
  const staff = conversationStaff ?? (isOffice ? TAX_OFFICE_STAFF[0]! : SHOP_NPCS.find(npc => npc.id === storeOwners[location])!);
  const venue = isOffice ? 'office' : 'store';
  const hours = venueHoursLabel(isOffice ? 'organization' : 'store');
  const message = conversationNpcId !== null
    ? `I’m sorry, but the ${venue} is closed now. We’re open from ${hours}. Please come back during those hours.`
    : gameTimeAvailable
    ? `Sorry, the ${venue} is closed. Opening hours are: ${hours}.`
    : `Sorry, I can’t confirm whether the ${venue} is open right now. Please try again in a moment.`;
  return <DialogueFrame>
    <DialogueMessage name={staff.name} portrait={npcPortrait(staff.id)} portraitPosition={npcPortraitPosition(message)} portraitGrid={NPC_PORTRAIT_GRID} text={message} />
    <GameButton label={conversationNpcId !== null ? 'Close conversation' : 'OK'} onClick={onReturn} />
  </DialogueFrame>;
}
