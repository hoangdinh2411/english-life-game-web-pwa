-- Seed airport prologue locations and allow saving player positions on airport maps.
insert into public.cities (id, name, description)
values ('city_maplewood', 'Starter City', 'The internal starter city for new players.')
on conflict (id) do nothing;

insert into public.locations (id, city_id, name, type)
values
  ('loc_airport_departure', 'city_maplewood', 'Departure Terminal', 'airport'),
  ('loc_airport_arrival', 'city_maplewood', 'Baggage Claim', 'airport')
on conflict (id) do update
set city_id = excluded.city_id,
    name = excluded.name,
    type = excluded.type;

alter table public.characters
  drop constraint character_last_location_pair,
  add constraint character_last_location_pair check (
    (current_map_id = 'loc_station' and current_place_id in ('loc_station', 'loc_cafe', 'loc_clothes'))
    or
    (current_map_id = 'loc_town_street' and current_place_id in ('loc_town_street', 'loc_corner_cafe', 'loc_tax_office'))
    or
    (current_map_id = 'loc_airport_departure' and current_place_id = 'loc_airport_departure')
    or
    (current_map_id = 'loc_airport_arrival' and current_place_id = 'loc_airport_arrival')
  ),
  drop constraint character_last_position_bounds,
  add constraint character_last_position_bounds check (
    current_position_x >= 0 and current_position_y >= 0
    and (
      (current_map_id in ('loc_station', 'loc_airport_departure', 'loc_airport_arrival') and current_position_x <= 1536 and current_position_y <= 1024)
      or
      (current_map_id = 'loc_town_street' and current_position_x <= 2304 and current_position_y <= 1536)
    )
  );
