-- Remote migration version: 20260916114036 (applied through the project-scoped Supabase MCP).
-- PostgREST maps SQLSTATE P0002 to HTTP 500. Generic "*_unavailable" refusals are not server faults,
-- so re-create the affected RPCs with PT404 (PostgREST custom status -> HTTP 404). Bodies, grants and
-- security settings are otherwise unchanged (CREATE OR REPLACE keeps ACLs).
-- Found during the full-cycle browser run: C's denied RPC calls surfaced as HTTP 500 console errors.
do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%errcode = ''P0002''%'
  loop
    definition := replace(pg_get_functiondef(fn.oid), 'errcode = ''P0002''', 'errcode = ''PT404''');
    execute definition;
  end loop;
end;
$$;
