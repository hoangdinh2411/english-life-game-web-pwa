alter table public.player_id_card
  add column number text;

do $$
declare
  card record;
  candidate text;
begin
  for card in select user_id, birth_date, gender from public.player_id_card loop
    loop
      candidate := to_char(card.birth_date, 'YYYYMMDD') ||
        lpad(floor(random() * 5000)::integer::text, 4, '0');
      if (right(candidate, 1)::integer % 2 = 1) <> (card.gender = 'male') then
        candidate := left(candidate, 11) || ((right(candidate, 1)::integer + 1) % 10)::text;
      end if;
      exit when not exists (select 1 from public.player_id_card where number = candidate);
    end loop;
    update public.player_id_card set number = candidate where user_id = card.user_id;
  end loop;
end $$;

alter table public.player_id_card
  alter column number set not null,
  add constraint player_id_card_number_format check (
    number ~ '^[0-9]{12}$' and left(number, 8) = to_char(birth_date, 'YYYYMMDD')
  ),
  add constraint player_id_card_number_gender_parity check (
    (right(number, 1)::integer % 2 = 1) = (gender = 'male')
  );

create unique index player_id_card_number_unique on public.player_id_card(number);
