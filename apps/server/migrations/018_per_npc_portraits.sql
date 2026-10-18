alter table npcs drop constraint if exists npcs_portrait_complete_check;

update npcs as npc
set portrait_image_url = 'npcs/' || npc.id || '/portraits.png',
    portrait_index = 0,
    portrait_columns = 3,
    portrait_rows = 1
where npc.id in (
  'npc_mia', 'npc_cafe_waiter', 'npc_cafe_customer',
  'npc_corner_cup_seller', 'npc_corner_cup_assistant',
  'npc_corner_cup_customer_1', 'npc_corner_cup_customer_2', 'npc_corner_cup_customer_3',
  'npc_clothes_seller', 'npc_clothes_assistant', 'npc_clothes_customer',
  'npc_mila_florist', 'npc_amir_courier', 'npc_ethan_baker', 'npc_lina_librarian',
  'npc_ben_gardener', 'npc_maya_teacher', 'npc_raj_pharmacist', 'npc_nora_bookseller',
  'npc_leo_driver', 'npc_dani_mechanic', 'npc_amara_market_vendor', 'npc_owen_post_worker',
  'npc_sara_artist', 'npc_jamal_dog_walker', 'npc_tara_musician'
);

alter table npcs add constraint npcs_portrait_complete_check check (
  (portrait_image_url is null and portrait_index is null and portrait_columns is null and portrait_rows is null)
  or
  (portrait_image_url ~ '^npcs/npc_[a-z0-9_]+/portraits\.png$'
    and portrait_index >= 0
    and portrait_columns = 3
    and portrait_rows = 1
    and portrait_index < portrait_columns * portrait_rows)
);
