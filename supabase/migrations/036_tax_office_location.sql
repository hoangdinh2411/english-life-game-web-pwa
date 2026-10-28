-- Preserve exact Tax Office positions as an interior under the Town Street map.
alter table public.characters
  drop constraint character_last_location_pair,
  add constraint character_last_location_pair check (
    (current_map_id = 'loc_station' and current_place_id in ('loc_station', 'loc_cafe', 'loc_clothes'))
    or
    (current_map_id = 'loc_town_street' and current_place_id in ('loc_town_street', 'loc_corner_cafe', 'loc_tax_office'))
  );
