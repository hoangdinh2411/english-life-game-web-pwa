import { Injectable } from '@nestjs/common';
import { dialogueNodeSchema, dialogueSchema, DialogueContent } from '@life-abroad/shared';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';

interface NodeRow extends QueryResultRow {
  id: string;
  scope: DialogueContent['scope'];
  role_id: string | null;
  npc_id: string | null;
  npc_text: unknown;
  next_rules: Record<string, unknown>;
  version: number;
}

export interface CachedDialogueNode {
  scope: DialogueContent['scope'];
  roleId: string | null;
  npcId: string | null;
  version: number;
  node: DialogueContent['nodes'][number];
}

@Injectable()
export class DialogueCacheService {
  private loaded: Promise<CachedDialogueNode[]> | undefined;

  constructor(private readonly database: DatabaseService) {}

  async getNodes(): Promise<CachedDialogueNode[]> {
    // Share concurrent first loads; retry failures rather than caching rejection.
    this.loaded ??= this.load().catch((error: unknown) => {
      this.loaded = undefined;
      throw error;
    });
    return structuredClone(await this.loaded);
  }

  private async load(): Promise<CachedDialogueNode[]> {
    const [result, common] = await Promise.all([
      this.database.query<NodeRow>("SELECT id,scope,role_id,npc_id,npc_text,next_rules,version FROM dialogue_nodes WHERE scope='npc' ORDER BY id"),
      this.commonNodes(),
    ]);
    return [...result.rows.map(row => ({
      scope: row.scope, roleId: row.role_id, npcId: row.npc_id, version: row.version,
      node: dialogueNodeSchema.parse({ ...row.next_rules, id: row.id, text: row.npc_text }),
    })), ...common];
  }

  // Shared global/role scripts ship with the server. Only NPC-specific overrides use DB.
  protected async commonNodes(): Promise<CachedDialogueNode[]> {
    const root = resolve(__dirname, '../../../../../content/dialogue');
    const files = (await readdir(root)).filter(file => file.endsWith('.json')).sort();
    const content = await Promise.all(files.map(async file => dialogueSchema.parse(JSON.parse(await readFile(resolve(root, file), 'utf8')) as unknown)));
    return content.filter(file => file.scope !== 'npc').flatMap(file => file.nodes.map(node => ({
      node, scope: file.scope, version: file.version, npcId: null,
      roleId: file.scope === 'role' ? file.role : null,
    })));
  }
}
