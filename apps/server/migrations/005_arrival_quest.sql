-- Forward-only arrival entitlement and one-time reward ledger. No player resets.
alter table public.characters add column current_location_id text references public.locations(id);
alter table public.player_quests
  add column bus_ticket_issued_at timestamptz,
  add column bus_ticket_used_at timestamptz,
  add constraint ticket_use_requires_issue check (bus_ticket_used_at is null or bus_ticket_issued_at is not null);

create table public.quest_reward_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references public.quests(id),
  xp integer not null check (xp >= 0),
  coins integer not null check (coins >= 0),
  granted_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);
alter table public.quest_reward_claims enable row level security;
revoke all on public.quest_reward_claims from anon, authenticated;
revoke insert, update, delete on public.player_quests from anon, authenticated;
