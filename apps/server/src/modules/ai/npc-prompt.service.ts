import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { npcProfileSchema, SHOP_NPC_IDS } from '@life-abroad/shared';
import { LifeService } from '../life/life.service';
import { AiPrompt } from './ai-provider';
import { NPC_SYSTEM_PROMPT } from './prompts';
import { NpcMoodService } from '../npcs/npc-mood.service';

interface PersonaRow {
  name: string; role: string; personality: string; speaking_level: string;
  profile: unknown;
  place: string; place_type: string; player_level: string;
  private_display_name: string; private_character_name: string;
}

function scrub(text: string, privateNames: string[]): string {
  let clean = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[private]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[private]');
  for (const name of privateNames.filter(name => name.trim())) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(escaped, 'gi'), '[private]');
  }
  return clean;
}

@Injectable()
export class NpcPromptService {
  constructor(private readonly life: LifeService, private readonly moods: NpcMoodService) {}

  async build(client: PoolClient, userId: string, npcId: string, conversationId: string,
    text: string): Promise<{ text: string; prompt: AiPrompt }> {
    const result = await client.query<PersonaRow>(`SELECT n.name,r.name AS role,n.personality,n.speaking_level,n.profile,
      l.name AS place,l.type AS place_type,p.english_level AS player_level,
      p.display_name AS private_display_name,c.name AS private_character_name
      FROM public.npcs n JOIN public.roles r ON r.id=n.role_id JOIN public.locations l ON l.id=n.location_id
      JOIN public.profiles p ON p.id=$1 JOIN public.characters c ON c.user_id=p.id WHERE n.id=$2`, [userId, npcId]);
    const row = result.rows[0];
    if (!row) throw new ServiceUnavailableException('NPC prompt context is unavailable.');
    const names = [row.private_display_name, row.private_character_name, userId];
    const history = await client.query<{ sender: 'player' | 'npc'; text: string }>(`SELECT m.sender,m.text
      FROM public.messages m JOIN public.conversations c ON c.id=m.conversation_id
      WHERE m.conversation_id=$1 AND c.user_id=$2 AND c.npc_id=$3 AND m.client_message_id IS NOT NULL
      ORDER BY m.sequence DESC LIMIT 12`, [conversationId, userId, npcId]);
    const kind = (SHOP_NPC_IDS as readonly string[]).includes(npcId) ? 'store'
      : row.place_type === 'workplace' ? 'workplace' : 'organization';
    const open = await this.life.venueOpen(client, userId, kind);
    const mood = await this.moods.resolve(client, userId, npcId);
      // Private player fields are used only for redaction; NPC facts come from the validated profile.
    const persona = { name: row.name, role: row.role, personality: row.personality, profile: npcProfileSchema.parse(row.profile),
      speakingLevel: row.speaking_level, place: row.place, open, mood, playerEnglishLevel: row.player_level };
    return { text: scrub(text, names), prompt: {
      system: `${NPC_SYSTEM_PROMPT}\nNPC context: ${JSON.stringify(persona)}`,
      history: history.rows.slice(0, 12).reverse().map(message => ({
        speaker: message.sender, text: scrub(message.text, names),
      })),
    } };
  }
}
