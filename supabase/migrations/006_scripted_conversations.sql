-- Replay metadata belongs to immutable messages, not client-writable quest state.
alter table public.conversations add column current_node_id text;
alter table public.messages
  add column sequence bigint generated always as identity,
  add column client_message_id uuid,
  add column metadata jsonb;
create unique index messages_request_sender_idx
  on public.messages (conversation_id, client_message_id, sender)
  where client_message_id is not null;
create index messages_sequence_idx on public.messages (conversation_id, sequence);
revoke all on public.conversations, public.messages from anon, authenticated;
