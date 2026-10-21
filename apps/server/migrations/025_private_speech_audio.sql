create table public.speech_audio_cache (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  bytes integer not null check (bytes > 0),
  language text not null,
  voice text not null,
  style text not null,
  format text not null,
  tts_version text not null,
  settings jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.speech_audio_cache enable row level security;
revoke all on public.speech_audio_cache from anon, authenticated;
grant all on public.speech_audio_cache to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speech-audio', 'speech-audio', false, 20971520, array['audio/mpeg'])
on conflict (id) do update set public=false;
