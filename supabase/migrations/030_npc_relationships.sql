-- NPC-06: private, per-player NPC relationship state and idempotent social events.
create table public.npc_relationships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  npc_id text not null references public.npcs(id) on delete cascade,
  familiarity integer not null default 0 check (familiarity between 0 and 100),
  affinity integer not null default 0 check (affinity between -100 and 100),
  interaction_mood_id text references public.mood_types(id),
  mood_expires_at timestamptz,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,npc_id),
  check ((interaction_mood_id is null) = (mood_expires_at is null))
);

create table public.npc_relationship_events (
  user_id uuid not null,
  npc_id text not null,
  client_message_id uuid not null,
  game_date date not null,
  familiarity_delta integer not null check (familiarity_delta between 0 and 2),
  affinity_delta integer not null check (affinity_delta between -12 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id,npc_id,client_message_id),
  foreign key (user_id,npc_id) references public.npc_relationships(user_id,npc_id) on delete cascade
);

create index npc_relationship_events_daily_idx
  on public.npc_relationship_events (user_id,npc_id,game_date);

alter table public.npc_relationships enable row level security;
alter table public.npc_relationship_events enable row level security;

