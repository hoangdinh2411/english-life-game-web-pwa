create table public.shop_items (
  id text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('drink', 'food', 'clothing')),
  price integer not null check (price > 0),
  shop text not null check (shop in ('cafe', 'clothes'))
);
create index shop_items_shop_idx on public.shop_items(shop);
alter table public.shop_items enable row level security;
revoke all on public.shop_items from anon, authenticated;
