-- The owner-scoped conversation lock also serializes pending-order changes.
alter table public.conversations add column pending_order jsonb;
alter table public.conversations add constraint pending_order_object
  check (pending_order is null or jsonb_typeof(pending_order) = 'object');
-- Existing RLS and revoked client privileges continue to protect these fields.
