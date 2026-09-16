-- Remote migration version: 20260916105738 (applied through the project-scoped Supabase MCP).
-- Feature 4: logged-in members read a post author's safe public profile (masked name, full age, photo, bio).
-- profiles keeps own-row-only RLS; this definer RPC resolves post_id -> author_id on the server.
create function public.get_post_author_profile(p_post_id uuid)
returns table (masked_name text, age integer, avatar_url text, bio text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  return query
    select public.mask_real_name(pr.real_name), public.korean_age(pr.birth_date), pr.avatar_url, pr.bio
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = p_post_id and p.status <> 'deleted';
  if not found then
    -- Missing, deleted and profile-less posts share one generic error.
    raise exception 'profile_unavailable' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.get_post_author_profile(uuid) from public, anon;
grant execute on function public.get_post_author_profile(uuid) to authenticated;
