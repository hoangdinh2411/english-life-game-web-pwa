alter table public.player_life
  add column clock_rate integer not null default 2 check (clock_rate > 0);
