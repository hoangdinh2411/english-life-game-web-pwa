-- Complete the saved location with the player's position inside the exact place.
alter table public.characters
  add column current_position_x double precision,
  add column current_position_y double precision;

update public.characters
set current_position_x = case
      when current_place_id = 'loc_town_street' then 1152
      else 768
    end,
    current_position_y = case
      when current_place_id = 'loc_town_street' then 315
      when current_place_id in ('loc_cafe', 'loc_corner_cafe', 'loc_clothes') then 860
      else 370
    end;

alter table public.characters
  alter column current_position_x set not null,
  alter column current_position_y set not null,
  add constraint character_last_position_bounds check (
    current_position_x >= 0 and current_position_y >= 0
    and (
      (current_map_id = 'loc_station' and current_position_x <= 1536 and current_position_y <= 1024)
      or
      (current_map_id = 'loc_town_street' and current_position_x <= 2304 and current_position_y <= 1536)
    )
  );
