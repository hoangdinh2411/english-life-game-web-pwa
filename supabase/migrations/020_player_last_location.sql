-- Save the exact playable scene and its outdoor parent without changing quest-owned location state.
alter table public.characters
  add column current_map_id text references public.locations(id),
  add column current_place_id text references public.locations(id);

update public.characters
set current_map_id = case when current_location_id = 'loc_town_street' then 'loc_town_street' else 'loc_station' end,
    current_place_id = coalesce(current_location_id, 'loc_station');

alter table public.characters
  alter column current_map_id set not null,
  alter column current_place_id set not null,
  add constraint character_last_location_pair check (
    (current_map_id = 'loc_station' and current_place_id in ('loc_station', 'loc_cafe', 'loc_clothes'))
    or
    (current_map_id = 'loc_town_street' and current_place_id in ('loc_town_street', 'loc_corner_cafe'))
  );
