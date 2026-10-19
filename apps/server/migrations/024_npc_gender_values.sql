alter table public.npcs drop constraint if exists npcs_gender_check;
alter table public.npcs
  add constraint npcs_gender_check check (gender in ('female', 'male'));
