alter table public.assets add column sha256 text;

update public.assets
set sha256 = substring(path from 'v[0-9]+-([a-f0-9]{64})\.[^.]+$')
where sha256 is null;

alter table public.assets
  alter column sha256 set not null,
  add constraint assets_sha256_format check (sha256 ~ '^[a-f0-9]{64}$');

do $$
declare station_constraint text;
begin
  select conname into station_constraint
  from pg_constraint
  where conrelid = 'public.assets'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%loc_station%';

  if station_constraint is not null then
    execute format('alter table public.assets drop constraint %I', station_constraint);
  end if;
end $$;
