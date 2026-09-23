-- New public-search boundary. Never copy legacy exact_location into this table:
-- that field may contain both a registered address and private meeting instructions.
create table private.post_search_locations (
  post_id uuid primary key references public.posts(id) on delete cascade,
  registered_place_name text,
  registered_address text not null,
  updated_at timestamptz not null default now(),
  constraint post_search_place_length check (
    registered_place_name is null or
    (registered_place_name = btrim(registered_place_name) and char_length(registered_place_name) between 1 and 200)
  ),
  constraint post_search_address_length check (
    registered_address = btrim(registered_address) and char_length(registered_address) between 1 and 300
  )
);
alter table private.post_search_locations enable row level security;
revoke all on table private.post_search_locations from public, anon, authenticated, service_role;
comment on table private.post_search_locations is
  'Search-only registered location; no meeting instructions. No client SELECT, no automatic legacy backfill.';

-- Only a trusted post-writing service may call this after validating ownership and
-- obtaining separate registered-place/address input. This is not a client write API.
create function public.set_post_search_location(
  p_post_id uuid,
  p_registered_place_name text,
  p_registered_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_post_id is null or p_registered_address is null
     or char_length(btrim(p_registered_address)) not between 1 and 300
     or (p_registered_place_name is not null and char_length(btrim(p_registered_place_name)) > 200) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform 1 from public.posts where id = p_post_id and status <> 'deleted' for update;
  if not found then
    raise exception 'post_unavailable' using errcode = 'P0002';
  end if;
  insert into private.post_search_locations(post_id, registered_place_name, registered_address)
  values (p_post_id, nullif(btrim(p_registered_place_name), ''), btrim(p_registered_address))
  on conflict (post_id) do update
  set registered_place_name = excluded.registered_place_name,
      registered_address = excluded.registered_address,
      updated_at = now();
end;
$$;
revoke all on function public.set_post_search_location(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_post_search_location(uuid, text, text) to service_role;

-- Returns only the agreed minimal public card. The address participates in the
-- predicate inside the definer boundary and is never projected into JSON.
-- The cursor is pagination metadata, not an authorization token.
create function public.search_public_posts(
  p_query text default null,
  p_date date default null,
  p_category text default null,
  p_area text default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(lower(btrim(p_query)), '');
  v_area text := nullif(btrim(p_area), '');
  v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 50
     or char_length(coalesce(p_query, '')) > 300
     or char_length(coalesce(p_area, '')) > 60
     or ((p_after_starts_at is null) <> (p_after_id is null))
     or (p_after_starts_at is not null and not isfinite(p_after_starts_at))
     or (p_date is not null and not isfinite(p_date))
     or (p_category is not null and p_category not in
       ('지금', '전시', '축제', '식사', '운동', '여행', '클래스', '산책', '스터디', '공연', '쇼핑', '기타')) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  with candidates as materialized (
    select p.id, p.starts_at, p.title, p.public_area,
      case when auth.role() = 'authenticated' and auth.uid() is not null
        then public.mask_real_name(pr.real_name)
        else '동행-' || replace(p.id::text, '-', '') end as display_name
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    left join private.post_search_locations l on l.post_id = p.id
    where p.status = 'recruiting'
      and p.recruitment_ends_at > now() and p.starts_at > now()
      and (p_date is null or (p.starts_at at time zone 'Asia/Seoul')::date = p_date)
      and (p_category is null or p.category = p_category)
      and (v_area is null or starts_with(p.public_area, v_area))
      and (p_after_starts_at is null or (p.starts_at, p.id) > (p_after_starts_at, p_after_id))
      and (v_query is null or strpos(lower(p.title), v_query) > 0
        or strpos(lower(coalesce(l.registered_place_name, '')), v_query) > 0
        or strpos(lower(coalesce(l.registered_address, '')), v_query) > 0)
    order by p.starts_at, p.id
    limit p_limit + 1
  ), page as (
    select * from candidates order by starts_at, id limit p_limit
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'postId', id, 'title', title, 'publicArea', public_area,
      'authorDisplayName', display_name) order by starts_at, id) from page), '[]'::jsonb),
    'nextCursor', case when (select count(*) from candidates) > p_limit
      then (select jsonb_build_object('startsAt', starts_at, 'postId', id)
            from page order by starts_at desc, id desc limit 1)
      else null end
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.search_public_posts(text, date, text, text, timestamptz, uuid, integer) from public;
grant execute on function public.search_public_posts(text, date, text, text, timestamptz, uuid, integer)
  to anon, authenticated, service_role;
comment on function public.search_public_posts(text, date, text, text, timestamptz, uuid, integer) is
  'Minimal public cards; title/registered place/address matching only. No descriptions, exact_location, distance or cost inference.';
