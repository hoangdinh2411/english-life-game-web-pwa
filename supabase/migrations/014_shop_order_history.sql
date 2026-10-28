create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop text not null check (shop <> 'clothes'),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total integer not null check (total > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index shop_orders_user_recent_idx on public.shop_orders(user_id, created_at desc, id desc);
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;
