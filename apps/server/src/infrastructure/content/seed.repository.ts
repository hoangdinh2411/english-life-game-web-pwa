import { PoolClient } from 'pg';
import { SeedContent } from './seed-content';

// Called inside one transaction; never writes player, Auth or progression data.
export async function seedContent(client: PoolClient, content: SeedContent): Promise<void> {
  const { town, roles, npcs, quests, shops, dialogues } = content;
  for (const item of shops) {
    await client.query(`INSERT INTO shop_items (id,name,kind,price,shop) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET name=excluded.name,kind=excluded.kind,price=excluded.price,shop=excluded.shop`,
    [item.id, item.name, item.kind, item.price, item.shop]);
  }
  await client.query(`INSERT INTO cities (id, name, description) VALUES ($1,$2,$3)
    ON CONFLICT (id) DO UPDATE SET name=excluded.name, description=excluded.description`, [town.id, town.name, town.description]);
  for (const location of town.locations) await client.query(`INSERT INTO locations (id,city_id,name,type) VALUES ($1,$2,$3,$4)
    ON CONFLICT (id) DO UPDATE SET city_id=excluded.city_id,name=excluded.name,type=excluded.type`, [location.id,town.id,location.name,location.type]);
  // Role IDs are authored on NPCs; no separate role-label catalog exists yet.
  for (const role of roles) await client.query('INSERT INTO roles (id,name) VALUES ($1,$1) ON CONFLICT (id) DO NOTHING', [role]);
  for (const npc of npcs) await client.query(`INSERT INTO npcs (id,name,role_id,personality,speaking_level,location_id,bio) VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET name=excluded.name,role_id=excluded.role_id,personality=excluded.personality,
    speaking_level=excluded.speaking_level,location_id=excluded.location_id,bio=excluded.bio`,
  [npc.id,npc.name,npc.role,npc.personality,npc.speakingLevel,npc.locationId,npc.bio]);
  for (const quest of quests) {
    await client.query(`INSERT INTO quests (id,title,required_level,npc_id,rewards) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET title=excluded.title,required_level=excluded.required_level,npc_id=excluded.npc_id,rewards=excluded.rewards`,
    [quest.id,quest.title,quest.requiredLevel,quest.npcId,quest.rewards]);
    // Reordering steps must not collide with the existing unique order constraint.
    await client.query('DELETE FROM quest_steps WHERE quest_id=$1', [quest.id]);
    for (const [index, step] of quest.steps.entries()) await client.query(
      'INSERT INTO quest_steps (quest_id,id,step_order,description,done_when) VALUES ($1,$2,$3,$4,$5)',
      [quest.id,step.id,index + 1,step.description,step.doneWhen]);
  }
  for (const dialogue of dialogues) for (const node of dialogue.nodes) {
    const { id, text, ...rules } = node;
    await client.query(`INSERT INTO dialogue_nodes (id,scope,role_id,npc_id,npc_text,next_rules,version) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET scope=excluded.scope,role_id=excluded.role_id,npc_id=excluded.npc_id,
      npc_text=excluded.npc_text,next_rules=excluded.next_rules,version=excluded.version`,
    [id,dialogue.scope,dialogue.scope === 'role' ? dialogue.role : null,dialogue.scope === 'npc' ? dialogue.npcId : null,text,rules,dialogue.version]);
  }
}
