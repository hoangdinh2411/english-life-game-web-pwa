import { Injectable } from '@nestjs/common';
import { dialogueNodeSchema, DialogueContent } from '@life-abroad/shared';
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
    const result = await this.database.query<NodeRow>(
      'SELECT id,scope,role_id,npc_id,npc_text,next_rules,version FROM dialogue_nodes ORDER BY id');
    return result.rows.map(row => ({
      scope: row.scope, roleId: row.role_id, npcId: row.npc_id, version: row.version,
      node: dialogueNodeSchema.parse({ ...row.next_rules, id: row.id, text: row.npc_text }),
    }));
  }
}
