-- R2: onboarding does not assign a CEFR level or activate energy.
-- Existing values are preserved; new accounts leave these fields unassigned.
alter table public.profiles alter column english_level drop default;
alter table public.profiles alter column english_level drop not null;
alter table public.player_stats alter column energy drop default;
alter table public.player_stats alter column energy drop not null;
alter table public.player_stats alter column last_energy_update drop default;
alter table public.player_stats alter column last_energy_update drop not null;
