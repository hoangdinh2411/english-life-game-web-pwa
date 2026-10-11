create table public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null check (length(trim(reason)) > 0),
  reference text not null check (length(trim(reference)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;
