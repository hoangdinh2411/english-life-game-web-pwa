-- T38.1: server-owned learning preferences; Sound remains device-local.
create table public.player_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coach_enabled boolean not null default false,
  speech_rate real not null default 1 check (speech_rate between 0.75 and 1.5),
  speech_pitch real not null default 1 check (speech_pitch between 0.75 and 1.25),
  updated_at timestamptz not null default now()
);

alter table public.player_preferences enable row level security;
revoke all on public.player_preferences from anon, authenticated;
