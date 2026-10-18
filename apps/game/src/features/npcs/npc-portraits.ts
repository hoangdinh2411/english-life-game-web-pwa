export { npcPortraitPosition } from './npc-expression';

const modules = import.meta.glob('../../../assets/npcs/*/portraits.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const portraits = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const id = path.match(/\/npcs\/(npc_[a-z0-9_]+)\/portraits\.png$/)?.[1];
  if (id) portraits.set(id, url);
}

export function npcPortrait(npcId: string): string {
  const portrait = portraits.get(npcId);
  if (!portrait) throw new Error(`${npcId} is missing its portrait asset`);
  return portrait;
}

export const NPC_PORTRAIT_GRID = { columns: 3, rows: 1 } as const;
