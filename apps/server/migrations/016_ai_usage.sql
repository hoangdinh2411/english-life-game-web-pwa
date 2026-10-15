create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  client_message_id uuid not null,
  provider text not null,
  model text not null,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  total_tokens integer check (total_tokens >= 0),
  estimated boolean not null,
  fallback boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (conversation_id, client_message_id)
);
create index ai_usage_user_recent_idx on public.ai_usage(user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
