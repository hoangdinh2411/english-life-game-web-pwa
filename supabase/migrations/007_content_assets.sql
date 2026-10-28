create table public.assets (
  id uuid primary key default gen_random_uuid(),
  map_id text references public.locations(id),
  npc_id text references public.npcs(id),
  key text not null check (key ~ '^[a-z][a-z0-9_-]{0,79}$'),
  type text not null check (type in ('map','image','audio','spritesheet','json','animation')),
  version integer not null check (version > 0),
  path text not null unique,
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now(),
  check (map_id is not null or npc_id is not null),
  check (map_id is null or map_id <> 'loc_station')
);
create unique index assets_version_idx on public.assets
  (coalesce(map_id,''), coalesce(npc_id,''), key, version);
create index assets_map_idx on public.assets(map_id);
create index assets_npc_idx on public.assets(npc_id);
alter table public.assets enable row level security;
revoke all on public.assets from anon, authenticated;
grant all on public.assets to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-assets', 'game-assets', true, 20971520,
  array['image/png','image/svg+xml','image/webp','audio/mpeg','audio/ogg','audio/wav','application/json'])
on conflict (id) do nothing;
-- Public downloads use the bucket's public route. No client write policy.
