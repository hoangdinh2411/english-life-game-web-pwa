-- NPC-03: versioned, authored NPC facts used by runtime dialogue prompts.
alter table public.npcs
  add column profile jsonb not null default '{"profileVersion":1}'::jsonb;

alter table public.npcs
  alter column profile drop default,
  add constraint npcs_profile_object_check check (jsonb_typeof(profile) = 'object'),
  add constraint npcs_profile_version_check check (profile ->> 'profileVersion' = '1');
