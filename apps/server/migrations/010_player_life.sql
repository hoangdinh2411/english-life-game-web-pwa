alter table public.shop_items add column color text check (color in ('blue','green','red','yellow'));
create table public.player_life (
  user_id uuid primary key references public.characters(user_id) on delete cascade,
  clock_time timestamptz not null default '2000-01-01 08:00:00+00',
  clock_anchor timestamptz not null default now(),
  hair text not null default 'brown' check (hair in ('brown','black','blond','blue')),
  shirt text check (shirt in ('blue','green','red','yellow')),
  trousers text not null default 'navy' check (trousers in ('navy','charcoal','brown'))
);
create table public.owned_shirts (
  user_id uuid references public.characters(user_id) on delete cascade,
  item_id text references public.shop_items(id),
  primary key (user_id,item_id)
);
create table public.player_actions (
  user_id uuid references public.characters(user_id) on delete cascade,
  key uuid not null,
  kind text not null,
  payload jsonb not null,
  response jsonb not null,
  primary key (user_id,key)
);
alter table public.player_life enable row level security;
alter table public.owned_shirts enable row level security;
alter table public.player_actions enable row level security;
revoke all on public.player_life,public.owned_shirts,public.player_actions from anon, authenticated;
