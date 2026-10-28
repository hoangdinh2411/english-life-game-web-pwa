create table public.id_card_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_field text not null,
  name text,
  date_of_birth date,
  address text,
  gender text,
  origin text,
  updated_at timestamptz not null default now(),
  constraint id_card_application_field check (
    current_field in ('name','dateOfBirth','address','gender','origin','photo','review','correction')
  ),
  constraint id_card_application_name check (name is null or char_length(name) between 1 and 60),
  constraint id_card_application_birth_date check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  constraint id_card_application_address check (address is null or char_length(address) between 1 and 120),
  constraint id_card_application_gender check (gender is null or gender in ('male','female')),
  constraint id_card_application_origin check (origin is null or char_length(origin) between 1 and 60)
);

alter table public.id_card_applications enable row level security;
revoke all on public.id_card_applications from anon, authenticated;

