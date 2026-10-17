import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { normalizeDialogue } from '@life-abroad/shared';
import { CachedDialogueNode, DialogueCacheService } from '../../infrastructure/content/dialogue-cache.service';

export interface DialogueContext {
  npcId: string;
  roleId: string;
  personality: string;
  currentNodeId?: string;
  variationIndex?: number;
}

export interface DialogueReply {
  node: CachedDialogueNode['node'];
  text: string;
  intent: string | null;
  misunderstood: boolean;
}

function words(input: string): string {
  return normalizeDialogue(input).toLowerCase().replace(/[^a-z0-9']/g, ' ').replace(/\s+/g, ' ').trim();
}

function matches(input: string, keyword: string): boolean {
  const phrase = words(keyword);
  // Literal phrase boundaries prevent "hi" in "this" and "ticket" in "ticketseller".
  return phrase.length > 0 && ` ${input} `.includes(` ${phrase} `);
}

function asksForDirections(input: string): boolean {
  // Learners may omit auxiliaries/articles ("how I get tax office"). Keep the
  // shape specific enough to avoid treating unrelated questions as directions.
  return /^how (?:do |can |could |would )?(?:i|we) (?:get|go|travel|reach) (?:to )?(?:the )?[a-z0-9]+(?: [a-z0-9]+){0,5}$/.test(input);
}

@Injectable()
export class DialogueService {
  constructor(private readonly cache: DialogueCacheService) {}

  async node(context: DialogueContext, id: string): Promise<DialogueReply> {
    const entry = (await this.cache.getNodes()).find(item => item.node.id === id &&
      (item.scope === 'npc' && item.npcId === context.npcId ||
       item.scope === 'role' && item.roleId === context.roleId || item.scope === 'global'));
    if (!entry) throw new ServiceUnavailableException('Dialogue node is unavailable.');
    return this.render(entry, context, null);
  }

  // Context is supplied by server orchestration; this service never changes quest state.
  async reply(context: DialogueContext, input: string, globalOnly = false): Promise<DialogueReply> {
    const all = (await this.cache.getNodes()).filter(entry => !globalOnly || entry.scope === 'global');
    const groups = [
      all.filter(entry => entry.scope === 'npc' && entry.npcId === context.npcId),
      all.filter(entry => entry.scope === 'role' && entry.roleId === context.roleId),
      all.filter(entry => entry.scope === 'global'),
    ];
    const applicable = groups.flat();
    const find = (id: string | undefined): CachedDialogueNode | undefined =>
      applicable.find(entry => entry.node.id === id);
    const current = find(context.currentNodeId);
    const text = words(input);
    // Do not turn an explicit refusal into a positive request.
    const refused = /\b(?:(?:don't|do not|not|never)\s+(?:want|need|like|request|ask|asking)|(?:no|not)\s+(?:a\s+|the\s+)?(?:bus\s+)?tickets?)\b/.test(text);
    if (text && !refused) for (const group of groups) {
      const ordered = [...group].sort((a, b) =>
        Number(b === current) - Number(a === current) || a.node.id.localeCompare(b.node.id));
      for (const entry of ordered) for (const intent of entry.node.intents ?? []) {
        const directionRequest = context.npcId === 'npc_receptionist' && intent.name === 'ask_town_directions' && asksForDirections(text);
        if (!directionRequest && !intent.keywords.some(keyword => matches(text, keyword))) continue;
        const target = find(intent.next);
        // A stale/broken link must never acknowledge a successful intent.
        if (target) return this.render(target, context, intent.name);
      }
    }
    // Specific clarification first, then role clarification, then the global repeat.
    const fallbacks = groups.flatMap(group => [...group].sort((a, b) =>
      Number(b === current) - Number(a === current) || a.node.id.localeCompare(b.node.id)));
    for (const entry of fallbacks) {
      const target = find(entry?.node.fallback);
      if (target && !target.node.completesStep) return this.render(target, context, null);
    }
    const repeat = groups[2]?.find(entry => entry.node.id === 'global_repeat');
    if (repeat) return this.render(repeat, context, null);
    throw new ServiceUnavailableException('Dialogue fallback is unavailable.');
  }

  private render(entry: CachedDialogueNode, context: DialogueContext, intent: string | null): DialogueReply {
    return {
      node: entry.node,
      text: entry.node.variations?.[(context.variationIndex ?? 0) % entry.node.variations.length]
        ?? entry.node.text[context.personality] ?? entry.node.text.default,
      intent,
      misunderstood: intent === null,
    };
  }
}
