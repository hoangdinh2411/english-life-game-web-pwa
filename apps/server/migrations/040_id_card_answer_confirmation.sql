alter table public.id_card_applications
  add column confirmation_field text;

alter table public.id_card_applications
  add constraint id_card_application_confirmation_field check (
    confirmation_field is null or confirmation_field in ('name','dateOfBirth','address','origin')
  );
