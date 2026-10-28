create table public.ai_speech_audio_cache (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  bytes integer not null check (bytes > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index ai_speech_audio_expiry_idx on public.ai_speech_audio_cache(expires_at);
alter table public.ai_speech_audio_cache enable row level security;
revoke all on public.ai_speech_audio_cache from anon, authenticated;
grant all on public.ai_speech_audio_cache to service_role;
