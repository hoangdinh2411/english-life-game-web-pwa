alter table public.characters add column gender text;
update public.characters set gender = 'male' where gender is null;
alter table public.characters alter column gender set not null;
alter table public.characters add constraint characters_gender_check check (gender in ('female', 'male'));
