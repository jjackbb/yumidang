-- Remote migration version: 20260916105220 (applied through the project-scoped Supabase MCP).
-- Feature 3: public meetup posts + private exact location, created atomically by the author.

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recruitment_ends_at timestamptz not null,
  public_area text not null,
  preference_note text,
  tags text[] not null default '{}',
  capacity smallint not null default 2,
  status text not null default 'recruiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_title_trimmed check (title = btrim(title) and char_length(title) between 2 and 80),
  constraint posts_description_length check (description = btrim(description) and char_length(description) between 1 and 2000),
  constraint posts_category_allowed check (category in ('전시', '축제', '식사', '운동', '여행', '클래스', '산책', '스터디', '공연', '쇼핑', '기타')),
  constraint posts_schedule_order check (starts_at < ends_at and recruitment_ends_at <= starts_at),
  constraint posts_public_area_format check (
    char_length(public_area) <= 60
    and public_area ~ '^[가-힣]+(특별시|광역시|특별자치시|특별자치도|도) [가-힣]+(시|군|구)( [가-힣]+구)? [가-힣0-9]+(동|읍|면|가)$'
  ),
  constraint posts_preference_note_length check (preference_note is null or (preference_note = btrim(preference_note) and char_length(preference_note) between 1 and 300)),
  constraint posts_tags_limit check (cardinality(tags) <= 5),
  constraint posts_capacity_one_to_one check (capacity = 2),
  constraint posts_status_allowed check (status in ('recruiting', 'closed', 'expired', 'deleted'))
);

comment on table public.posts is 'Public meetup post. Only public fields live here; the exact meeting place is in post_private_details.';
comment on column public.posts.author_id is 'Author profile. Set from auth.uid() inside create_post, never from client input.';
comment on column public.posts.public_area is 'Public area down to 시·구·동 only, e.g. 서울특별시 성동구 성수동.';
comment on column public.posts.recruitment_ends_at is 'Last moment join requests are accepted; must not be after starts_at.';
comment on column public.posts.ends_at is 'Meetup end; completion confirmations and the review deadline are based on it.';
comment on column public.posts.capacity is 'Always 2: author plus one confirmed companion.';

create index posts_listing_idx on public.posts (starts_at, id) where status = 'recruiting';
create index posts_author_idx on public.posts (author_id);

create trigger posts_set_updated_at before update on public.posts
for each row execute function private.set_updated_at();

create table public.post_private_details (
  post_id uuid primary key references public.posts (id) on delete cascade,
  exact_location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_private_details_location_length check (exact_location = btrim(exact_location) and char_length(exact_location) between 2 and 200)
);

comment on table public.post_private_details is 'Private exact meeting place. Author always; confirmed companion only after final match (feature 7).';

create trigger post_private_details_set_updated_at before update on public.post_private_details
for each row execute function private.set_updated_at();

-- Helper used by RLS policies; SECURITY DEFINER avoids depending on the caller's view of posts.
create function private.is_post_author(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.posts p where p.id = p_post_id and p.author_id = (select auth.uid()));
$$;
revoke all on function private.is_post_author(uuid) from public, anon;
grant execute on function private.is_post_author(uuid) to authenticated;

alter table public.posts enable row level security;
alter table public.post_private_details enable row level security;

revoke all on table public.posts from anon, authenticated;
revoke all on table public.post_private_details from anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant select on table public.post_private_details to authenticated;

create policy posts_select_not_deleted on public.posts
for select to anon, authenticated
using (status <> 'deleted');

create policy post_private_details_select_author on public.post_private_details
for select to authenticated
using ((select private.is_post_author(post_id)));

-- Atomic create. p_post_id is a client-generated UUID so a retried submit returns the same post.
create function public.create_post(
  p_post_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_recruitment_ends_at timestamptz,
  p_public_area text,
  p_exact_location text,
  p_preference_note text default null,
  p_tags text[] default '{}'
)
returns public.posts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
  v_tags text[];
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if p_post_id is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'post_id';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_required' using errcode = '42501';
  end if;

  select * into v_post from public.posts where id = p_post_id;
  if found then
    if v_post.author_id = v_uid then
      return v_post; -- retry of the same submit
    end if;
    raise exception 'invalid_input' using errcode = '22023', detail = 'post_id';
  end if;

  if p_recruitment_ends_at is null or p_recruitment_ends_at <= now() then
    raise exception 'recruitment_must_end_in_future' using errcode = '22023';
  end if;

  select coalesce(array_agg(btrim(tag)), '{}') into v_tags
  from unnest(coalesce(p_tags, '{}')) as tag
  where btrim(tag) <> '';
  if cardinality(v_tags) > 5 or exists (select 1 from unnest(v_tags) t where char_length(t) > 20) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'tags';
  end if;

  insert into public.posts (id, author_id, title, description, category, starts_at, ends_at, recruitment_ends_at, public_area, preference_note, tags)
  values (p_post_id, v_uid, btrim(p_title), btrim(p_description), p_category, p_starts_at, p_ends_at, p_recruitment_ends_at,
          btrim(p_public_area), nullif(btrim(coalesce(p_preference_note, '')), ''), v_tags)
  returning * into v_post;

  insert into public.post_private_details (post_id, exact_location)
  values (v_post.id, btrim(p_exact_location));

  return v_post;
end;
$$;
revoke all on function public.create_post(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text, text, text, text[]) from public, anon;
grant execute on function public.create_post(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text, text, text, text[]) to authenticated;

-- Default listing: requests can be sent now. Invoker rights, so posts RLS still applies.
create function public.list_posts(
  p_query text default null,
  p_date date default null,
  p_category text default null,
  p_area text default null,
  p_after_starts_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.status = 'recruiting'
    and p.recruitment_ends_at > now()
    and p.starts_at > now()
    and (p_category is null or p.category = p_category)
    and (p_area is null or p.public_area like replace(replace(replace(btrim(p_area), '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (p_date is null or (p.starts_at at time zone 'Asia/Seoul')::date = p_date)
    and (
      p_query is null or btrim(p_query) = ''
      or (p.title || ' ' || p.description || ' ' || p.public_area)
         ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
    and (p_after_starts_at is null or (p.starts_at, p.id) > (p_after_starts_at, p_after_id))
  order by p.starts_at asc, p.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.list_posts(text, date, text, text, timestamptz, uuid, integer) from public;
grant execute on function public.list_posts(text, date, text, text, timestamptz, uuid, integer) to anon, authenticated;

-- Server-time request window for detail screens (clients never judge deadlines by their own clock).
create function public.post_request_window(p_post_id uuid)
returns table (post_id uuid, accepting_requests boolean, server_now timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, (p.status = 'recruiting' and p.recruitment_ends_at > now() and p.starts_at > now()), now()
  from public.posts p
  where p.id = p_post_id;
$$;
revoke all on function public.post_request_window(uuid) from public;
grant execute on function public.post_request_window(uuid) to anon, authenticated;
