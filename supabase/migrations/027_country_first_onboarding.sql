-- NPC-02: players choose a country; the server assigns its internal starter city.
create table public.countries (
  id              text primary key,
  name            text not null,
  iso_code        text not null unique check (iso_code ~ '^[A-Z]{2}$'),
  flag            text not null,
  time_zone       text not null,
  starter_city_id text not null references public.cities(id)
);

alter table public.cities
  add column country_id text references public.countries(id);

alter table public.characters
  add column country_id text references public.countries(id);

alter table public.countries enable row level security;
create policy "content read" on public.countries for select to authenticated using (true);
