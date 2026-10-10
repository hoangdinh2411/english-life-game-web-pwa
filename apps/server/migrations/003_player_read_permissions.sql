-- Policies filter rows but do not grant table access. Clients remain read-only.
grant usage on schema public to authenticated;
grant select on public.profiles, public.characters, public.player_stats to authenticated;
