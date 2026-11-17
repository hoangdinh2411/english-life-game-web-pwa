alter table public.player_preferences
  add column if not exists user_mode text not null default 'adult';
