-- Remote migration version: 20260916111437 (applied through the project-scoped Supabase MCP).
-- Performance advisor 0001: cover the composite FK appointments(join_request_id, post_id) -> join_requests(id, post_id).
create index appointments_request_post_idx on public.appointments (join_request_id, post_id);
