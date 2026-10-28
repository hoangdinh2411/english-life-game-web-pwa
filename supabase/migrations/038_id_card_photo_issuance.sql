create table public.player_id_card (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  address text,
  gender text not null check (gender in ('male','female')),
  origin text not null,
  photo_path text,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_id_card_name check (char_length(full_name) between 1 and 60),
  constraint player_id_card_address check (address is null or char_length(address) between 1 and 120),
  constraint player_id_card_origin check (char_length(origin) between 1 and 60)
);

create table public.id_card_issue_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  photo_hash text not null check (photo_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

alter table public.player_id_card enable row level security;
alter table public.id_card_issue_requests enable row level security;
revoke all on public.player_id_card, public.id_card_issue_requests from anon, authenticated;
grant all on public.player_id_card, public.id_card_issue_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-card-photos', 'id-card-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg'];

