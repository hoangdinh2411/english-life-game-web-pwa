alter table public.npcs add column gender text;

update public.npcs
set gender = case id
  when 'npc_receptionist' then 'female'
  when 'npc_mia' then 'female'
  when 'npc_brown' then 'male'
  when 'npc_sam' then 'male'
  when 'npc_cafe_waiter' then 'male'
  when 'npc_cafe_customer' then 'female'
  when 'npc_corner_cup_seller' then 'female'
  when 'npc_corner_cup_assistant' then 'male'
  when 'npc_corner_cup_customer_1' then 'female'
  when 'npc_corner_cup_customer_2' then 'female'
  when 'npc_corner_cup_customer_3' then 'female'
  when 'npc_clothes_seller' then 'male'
  when 'npc_clothes_assistant' then 'male'
  when 'npc_clothes_customer' then 'female'
  when 'npc_mila_florist' then 'female'
  when 'npc_amir_courier' then 'male'
  when 'npc_ethan_baker' then 'male'
  when 'npc_lina_librarian' then 'female'
  when 'npc_ben_gardener' then 'male'
  when 'npc_maya_teacher' then 'female'
  when 'npc_raj_pharmacist' then 'male'
  when 'npc_nora_bookseller' then 'female'
  when 'npc_leo_driver' then 'male'
  when 'npc_dani_mechanic' then 'male'
  when 'npc_amara_market_vendor' then 'female'
  when 'npc_owen_post_worker' then 'male'
  when 'npc_sara_artist' then 'female'
  when 'npc_jamal_dog_walker' then 'male'
  when 'npc_tara_musician' then 'female'
  else 'unknown'
end;

alter table public.npcs alter column gender set not null;
alter table public.npcs add constraint npcs_gender_check check (gender in ('female', 'male', 'unknown'));
