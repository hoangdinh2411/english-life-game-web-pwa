alter table public.owned_shirts
  add column quantity integer not null default 1 check (quantity > 0);
