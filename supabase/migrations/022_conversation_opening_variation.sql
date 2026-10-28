-- Keep the opening line reproducible without saving it before the player responds.
alter table public.conversations
  add column opening_variation_index integer not null default 0
  check (opening_variation_index >= 0);
