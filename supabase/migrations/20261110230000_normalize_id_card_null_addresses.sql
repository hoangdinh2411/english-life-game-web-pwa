update public.player_id_card
set address = null,
    updated_at = now()
where lower(trim(address)) ~ '^i[[:space:]]+(don''t|do[[:space:]]+not)[[:space:]]+have([[:space:]]+any)?[[:space:]]+(an?[[:space:]]+)?(permanent[[:space:]]+)?address([[:space:]]+(right[[:space:]]+now|yet))?$';

update public.id_card_applications
set address = null,
    updated_at = now()
where lower(trim(address)) ~ '^i[[:space:]]+(don''t|do[[:space:]]+not)[[:space:]]+have([[:space:]]+any)?[[:space:]]+(an?[[:space:]]+)?(permanent[[:space:]]+)?address([[:space:]]+(right[[:space:]]+now|yet))?$';
