-- Preserve the existing core schema and store the complete authored node payload.
create table public.dialogue_nodes (
  id text primary key,
  scope text not null check (scope in ('global', 'role', 'npc')),
  role_id text references public.roles(id),
  npc_id text references public.npcs(id),
  npc_text jsonb not null check (jsonb_typeof(npc_text) = 'object' and npc_text ? 'default'),
  next_rules jsonb not null check (jsonb_typeof(next_rules) = 'object'),
  version integer not null check (version > 0),
  constraint dialogue_scope_reference check (
    (scope = 'global' and role_id is null and npc_id is null) or
    (scope = 'role' and role_id is not null and npc_id is null) or
    (scope = 'npc' and role_id is null and npc_id is not null)
  )
);
alter table public.dialogue_nodes enable row level security;
-- Nest accesses this table through its server database connection (D15).
revoke all on public.dialogue_nodes from anon, authenticated;
