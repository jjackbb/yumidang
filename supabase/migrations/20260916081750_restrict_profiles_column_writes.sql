-- Owners write profile inputs; Postgres alone owns registration and modification timestamps.
revoke insert, update on table public.profiles from authenticated;

grant insert (id, nickname, birth_date, avatar_url, bio)
  on table public.profiles to authenticated;

grant update (nickname, birth_date, avatar_url, bio)
  on table public.profiles to authenticated;
