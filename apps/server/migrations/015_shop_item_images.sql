alter table public.shop_items add column image text;
alter table public.shop_items add constraint shop_item_image_path
  check (image is null or image ~ '^/images/shops/[a-z0-9_-]+[.](png|webp|svg)$');
