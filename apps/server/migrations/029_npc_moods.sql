-- NPC-04: editable mood catalog and lazily resolved NPC base mood.
create table public.mood_types (
  id text primary key,
  label text not null check (btrim(label) <> ''),
  guidance text not null check (btrim(guidance) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.mood_types (id,label,guidance)
values ('neutral','Neutral','Speak naturally and calmly.');

alter table public.npcs
  add column current_mood_id text not null default 'neutral' references public.mood_types(id),
  add column mood_updated_at timestamptz not null default now();

alter table public.mood_types enable row level security;
