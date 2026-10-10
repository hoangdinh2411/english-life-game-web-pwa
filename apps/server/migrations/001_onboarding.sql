-- Life Abroad: core tables for the MVP (Supabase / PostgreSQL)
-- Content tables use text ids that match /content/seed (example: "npc_mia").
-- Player tables use uuid. Client can only READ (RLS). The server writes with the service role.

-- ---------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------
create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1');
create type public.quest_status as enum ('not_started', 'active', 'done');
create type public.message_sender as enum ('player', 'npc');

-- ---------------------------------------------------------------
-- World and story (content)
-- ---------------------------------------------------------------
create table public.cities (
  id          text primary key,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.locations (
  id         text primary key,
  city_id    text not null references public.cities(id) on delete cascade,
  name       text not null,
  type       text not null,  -- cafe, bank, housing, ...
  created_at timestamptz not null default now()
);
create index locations_city_id_idx on public.locations(city_id);

create table public.roles (
  id   text primary key,     -- barista, landlord, bank_clerk
  name text not null
);

create table public.npcs (
  id             text primary key,
  name           text not null,
  role_id        text references public.roles(id),
  personality    text not null,           -- cheerful, shy, serious, ...
  speaking_level public.cefr_level not null,
  location_id    text references public.locations(id),
  bio            text,
  created_at     timestamptz not null default now()
);
create index npcs_role_id_idx on public.npcs(role_id);
create index npcs_location_id_idx on public.npcs(location_id);

create table public.quests (
  id             text primary key,
  title          text not null,
  required_level public.cefr_level not null,
  npc_id         text references public.npcs(id),
  rewards        jsonb not null default '{}'::jsonb,  -- {"xp": 20, "coins": 5}
  created_at     timestamptz not null default now()
);
create index quests_npc_id_idx on public.quests(npc_id);

create table public.quest_steps (
  quest_id    text not null references public.quests(id) on delete cascade,
  id          text not null,              -- s1, s2, ...
  step_order  integer not null,
  description text not null,
  done_when   jsonb not null,             -- {"intent": "order_drink"}
  primary key (quest_id, id),
  unique (quest_id, step_order)
);

-- ---------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------
-- Email and password live in Supabase Auth (auth.users). We never store them.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  english_level public.cefr_level not null default 'A1',
  created_at    timestamptz not null default now()
);

create table public.characters (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  name            text not null,
  outfit          jsonb not null default '{}'::jsonb,
  current_city_id text references public.cities(id),
  created_at      timestamptz not null default now()
);

create table public.player_stats (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  energy             integer not null default 100 check (energy >= 0),
  coins              integer not null default 0 check (coins >= 0),
  xp                 integer not null default 0 check (xp >= 0),
  last_energy_update timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Player progress
-- ---------------------------------------------------------------
create table public.player_quests (
  user_id            uuid not null references public.profiles(id) on delete cascade,
  quest_id           text not null references public.quests(id) on delete cascade,
  status             public.quest_status not null default 'not_started',
  current_step_id    text,
  started_at         timestamptz,
  completed_at       timestamptz,
  rewards_granted_at timestamptz,         -- set once, so rewards are never given twice
  primary key (user_id, quest_id)
);

-- ---------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  npc_id      text not null references public.npcs(id),
  quest_id    text references public.quests(id) on delete set null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  tokens_used integer not null default 0 check (tokens_used >= 0)
);
create index conversations_user_started_idx on public.conversations(user_id, started_at desc);

-- Append-only: rows are never edited (updates are blocked by a trigger below).
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender          public.message_sender not null,
  text            text not null,
  created_at      timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

create table public.npc_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  npc_id     text not null references public.npcs(id) on delete cascade,
  fact       text not null,               -- short fact: "likes coffee"
  created_at timestamptz not null default now()
);
create index npc_memory_user_npc_idx on public.npc_memory(user_id, npc_id);

-- ---------------------------------------------------------------
-- Learning data
-- ---------------------------------------------------------------
create table public.vocabulary (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  phrase        text not null,
  first_used_at timestamptz not null default now(),
  times_used    integer not null default 1 check (times_used >= 1),
  primary key (user_id, phrase)
);

create table public.corrections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  original        text not null,
  improved        text not null,
  reason          text,
  created_at      timestamptz not null default now()
);
create index corrections_user_created_idx on public.corrections(user_id, created_at desc);
create index corrections_conversation_idx on public.corrections(conversation_id);

-- AI cost and daily limits
create table public.ai_usage_daily (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  usage_date      date not null default current_date,
  tokens_used     integer not null default 0 check (tokens_used >= 0),
  free_chats_used integer not null default 0 check (free_chats_used >= 0),
  primary key (user_id, usage_date)
);

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------
-- Create a profile and stats row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Player'
    )
  );
  insert into public.player_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block edits to messages (deleting is still allowed, for account deletion).
create function public.messages_block_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'messages are append-only';
end;
$$;

create trigger messages_no_update
  before update on public.messages
  for each row execute function public.messages_block_update();

-- ---------------------------------------------------------------
-- Row Level Security
-- Client: read-only. Server (service role) bypasses RLS and does all writes.
-- ---------------------------------------------------------------
alter table public.cities         enable row level security;
alter table public.locations      enable row level security;
alter table public.roles          enable row level security;
alter table public.npcs           enable row level security;
alter table public.quests         enable row level security;
alter table public.quest_steps    enable row level security;
alter table public.profiles       enable row level security;
alter table public.characters     enable row level security;
alter table public.player_stats   enable row level security;
alter table public.player_quests  enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.npc_memory     enable row level security;
alter table public.vocabulary     enable row level security;
alter table public.corrections    enable row level security;
alter table public.ai_usage_daily enable row level security;

-- Content: any logged-in user can read.
create policy "content read" on public.cities      for select to authenticated using (true);
create policy "content read" on public.locations   for select to authenticated using (true);
create policy "content read" on public.roles       for select to authenticated using (true);
create policy "content read" on public.npcs        for select to authenticated using (true);
create policy "content read" on public.quests      for select to authenticated using (true);
create policy "content read" on public.quest_steps for select to authenticated using (true);

-- Player data: users can read only their own rows.
create policy "own read" on public.profiles       for select to authenticated using (id = (select auth.uid()));
create policy "own read" on public.characters     for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.player_stats   for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.player_quests  for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.conversations  for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.npc_memory     for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.vocabulary     for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.corrections    for select to authenticated using (user_id = (select auth.uid()));
create policy "own read" on public.ai_usage_daily for select to authenticated using (user_id = (select auth.uid()));

create policy "own read" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.user_id = (select auth.uid())
  ));