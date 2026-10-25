import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { voicePoolsSchema, type Conversation, type MoodId } from '@life-abroad/shared';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { AZURE_SPEECH_FORMAT, AZURE_SPEECH_LANGUAGE, AZURE_SPEECH_VERSION, resolveAzureStyle } from './azure-speech.provider';
import type { AiSpeechIdentity } from './ai-speech.service';
import { resolveNpcVoice } from './voice-selection';

@Injectable()
export class SpeechProfileService {
  private pools: Promise<ReturnType<typeof voicePoolsSchema.parse>> | undefined;

  constructor(private readonly database: DatabaseService) {}

  async identity(npcId: Conversation['npcId'], mood: MoodId = 'neutral'): Promise<AiSpeechIdentity> {
    const [npc, pools] = await Promise.all([
      this.database.query<{ gender: 'female' | 'male' }>('SELECT gender FROM npcs WHERE id=$1', [npcId]),
      this.voicePools(),
    ]);
    const gender = npc.rows[0]?.gender;
    if (!gender) throw new ServiceUnavailableException('NPC speech profile is unavailable.');
    const voice = resolveNpcVoice(npcId, gender, pools);
    const supported = pools.styleSupport[voice] ?? [];
    return { language: AZURE_SPEECH_LANGUAGE, voice, style: resolveAzureStyle(mood, supported),
      format: AZURE_SPEECH_FORMAT, ttsVersion: AZURE_SPEECH_VERSION, settings: {} };
  }

  async tutorialIdentity(): Promise<AiSpeechIdentity> {
    const pools = await this.voicePools();
    const voice = pools.voices.female[0];
    if (!voice) throw new ServiceUnavailableException('Tutorial speech profile is unavailable.');
    const supported = pools.styleSupport[voice] ?? [];
    return { language: AZURE_SPEECH_LANGUAGE, voice, style: resolveAzureStyle('neutral', supported),
      format: AZURE_SPEECH_FORMAT, ttsVersion: AZURE_SPEECH_VERSION, settings: {} };
  }

  private voicePools(): Promise<ReturnType<typeof voicePoolsSchema.parse>> {
    this.pools ??= readFile(resolve(__dirname, '../../../../../content/voice-pools.json'), 'utf8')
      .then(value => voicePoolsSchema.parse(JSON.parse(value) as unknown))
      .catch((error: unknown) => { this.pools = undefined; throw error; });
    return this.pools;
  }
}
