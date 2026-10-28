-- The NestJS API owns every application-data read and write. Supabase client
-- roles keep Auth/Storage access, but receive no direct access to public data.
-- Keep this migration retry-safe: it may run after policies or tables change.

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Remove inherited client privileges first. RLS remains defense in depth, not
-- the only barrier protecting server-authoritative data.
revoke all privileges on schema public from public, anon, authenticated;
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke all privileges on all functions in schema public from public, anon, authenticated;

-- A stale read policy could become an accidental exposure if a later change
-- grants table access. Remove every client-era policy and keep all tables RLS
-- protected with a deny-by-default policy set.
do $$
declare
  table_record record;
  policy_record record;
begin
  for table_record in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_record.schema_name,
      table_record.table_name
    );
  end loop;

  for policy_record in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

-- Objects created by future migrations using this migration owner remain
-- private unless a later reviewed migration grants narrowly scoped access.
alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on functions from public, anon, authenticated;
