import { createHash } from 'node:crypto';
import type { VoicePools } from '@life-abroad/shared';

export function resolveNpcVoice(npcId: string, gender: 'female' | 'male', pools: VoicePools): string {
  const override = pools.voiceOverrides[npcId];
  if (override) return override;
  const voices = pools.voices[gender];
  const hash = createHash('sha256').update(npcId).digest().readUInt32BE(0);
  return voices[hash % voices.length]!;
}
