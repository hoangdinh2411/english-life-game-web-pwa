alter table public.npcs
  add column portrait_image_url text,
  add column portrait_index integer,
  add column portrait_columns integer,
  add column portrait_rows integer,
  add constraint npcs_portrait_complete_check check (
    (portrait_image_url is null and portrait_index is null and portrait_columns is null and portrait_rows is null)
    or
    (portrait_image_url ~ '^npcs/[a-zA-Z0-9_-]+\.png$'
      and portrait_index >= 0
      and portrait_columns > 0
      and portrait_rows > 0
      and portrait_index < portrait_columns * portrait_rows)
  );

update public.npcs as npc
set portrait_image_url = portrait.image_url,
    portrait_index = portrait.frame_index,
    portrait_columns = portrait.columns,
    portrait_rows = portrait.rows
from (values
  ('npc_mia', 'npcs/shop-npcs.png', 0, 4, 3),
  ('npc_corner_cup_seller', 'npcs/shop-npcs.png', 1, 4, 3),
  ('npc_cafe_waiter', 'npcs/shop-npcs.png', 2, 4, 3),
  ('npc_cafe_customer', 'npcs/shop-npcs.png', 3, 4, 3),
  ('npc_corner_cup_assistant', 'npcs/shop-npcs.png', 4, 4, 3),
  ('npc_corner_cup_customer_1', 'npcs/shop-npcs.png', 5, 4, 3),
  ('npc_corner_cup_customer_2', 'npcs/shop-npcs.png', 6, 4, 3),
  ('npc_corner_cup_customer_3', 'npcs/shop-npcs.png', 7, 4, 3),
  ('npc_clothes_seller', 'npcs/shop-npcs.png', 8, 4, 3),
  ('npc_clothes_assistant', 'npcs/shop-npcs.png', 9, 4, 3),
  ('npc_clothes_customer', 'npcs/shop-npcs.png', 10, 4, 3),
  ('npc_mila_florist', 'npcs/town-portraits.png', 0, 4, 4),
  ('npc_amir_courier', 'npcs/town-portraits.png', 1, 4, 4),
  ('npc_ethan_baker', 'npcs/town-portraits.png', 2, 4, 4),
  ('npc_lina_librarian', 'npcs/town-portraits.png', 3, 4, 4),
  ('npc_ben_gardener', 'npcs/town-portraits.png', 4, 4, 4),
  ('npc_maya_teacher', 'npcs/town-portraits.png', 5, 4, 4),
  ('npc_raj_pharmacist', 'npcs/town-portraits.png', 6, 4, 4),
  ('npc_nora_bookseller', 'npcs/town-portraits.png', 7, 4, 4),
  ('npc_leo_driver', 'npcs/town-portraits.png', 8, 4, 4),
  ('npc_dani_mechanic', 'npcs/town-portraits.png', 9, 4, 4),
  ('npc_amara_market_vendor', 'npcs/town-portraits.png', 10, 4, 4),
  ('npc_owen_post_worker', 'npcs/town-portraits.png', 11, 4, 4),
  ('npc_sara_artist', 'npcs/town-portraits.png', 12, 4, 4),
  ('npc_jamal_dog_walker', 'npcs/town-portraits.png', 13, 4, 4),
  ('npc_tara_musician', 'npcs/town-portraits.png', 14, 4, 4)
) as portrait(npc_id, image_url, frame_index, columns, rows)
where npc.id = portrait.npc_id;
