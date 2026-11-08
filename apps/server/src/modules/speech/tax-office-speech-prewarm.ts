import type { Conversation, MoodId } from '@life-abroad/shared';
import type { SeedContent } from '../../infrastructure/content/seed-content';
import { speechCacheKey, type FixedSpeechService, type SpeechCacheIdentity } from './fixed-speech.service';
import type { SpeechProfileService } from './speech-profile.service';

const TAX_OFFICE_ROLE = 'tax_office_staff';

export function taxOfficeFixedSpeech(content: SeedContent): string[] {
  const dialogue = content.dialogues
    .filter(file => file.scope === 'role' && file.role === TAX_OFFICE_ROLE)
    .flatMap(file => file.nodes.flatMap(node => [...Object.values(node.text), ...(node.variations ?? [])]));
  const application = content.idCardApplication;
  return [...new Set([
    ...dialogue,
    ...Object.values(application.prompts),
    ...Object.values(application.correctionPrompts),
    ...Object.values(application.retries),
    application.cancelled,
  ])];
}

export async function prewarmTaxOfficeSpeech(content: SeedContent, profiles: SpeechProfileService,
  fixed: FixedSpeechService): Promise<number> {
  const npcIds = content.npcs.filter(npc => npc.role === TAX_OFFICE_ROLE)
    .map(npc => npc.id as Conversation['npcId']);
  const texts = taxOfficeFixedSpeech(content);
  const identities = new Map<string, SpeechCacheIdentity>();
  for (const npcId of npcIds) for (const mood of content.moods) {
    const identity = await profiles.identity(npcId, mood.id as MoodId);
    for (const text of texts) {
      const candidate = { ...identity, text };
      identities.set(speechCacheKey(candidate), candidate);
    }
  }
  for (const identity of identities.values()) await fixed.get(identity);
  return identities.size;
}
