delete from assets
where map_id in ('loc_cafe', 'loc_corner_cafe', 'loc_clothes')
  and key in ('shop-npcs', 'shop-npcs-atlas');
