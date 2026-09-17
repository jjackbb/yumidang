-- Remote migration version: 20260916131906 (applied through the project-scoped Supabase MCP).
-- Existing-UI integration (user decisions 2026-09-16):
-- 1) signup profile stores gender; posts keep the existing "상대 성별 조건" and the server enforces it,
-- 2) the existing post form category "지금" is allowed,
-- 3) logged-in list cards show the author's masked name/photo through one batch call.

alter table public.profiles add column gender text;
alter table public.profiles add constraint profiles_gender_allowed check (gender is null or gender in ('female', 'male'));
comment on column public.profiles.gender is
  'Private. female/male chosen at signup; used only by the server to check a post''s partner gender condition. Null for accounts created before this column.';
grant insert (gender), update (gender) on table public.profiles to authenticated;

alter table public.posts add column partner_gender text not null default 'any';
alter table public.posts add constraint posts_partner_gender_allowed check (partner_gender in ('any', 'female', 'male'));
comment on column public.posts.partner_gender is 'Public partner condition set by the author: any/female/male. Enforced in create_join_request.';

alter table public.posts drop constraint posts_category_allowed;
alter table public.posts add constraint posts_category_allowed
  check (category in ('지금', '전시', '축제', '식사', '운동', '여행', '클래스', '산책', '스터디', '공연', '쇼핑', '기타'));

drop function public.create_post(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text, text, text, text[]);

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
  p_tags text[] default '{}',
  p_partner_gender text default 'any'
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

  insert into public.posts (id, author_id, title, description, category, starts_at, ends_at, recruitment_ends_at, public_area, preference_note, tags, partner_gender)
  values (p_post_id, v_uid, btrim(p_title), btrim(p_description), p_category, p_starts_at, p_ends_at, p_recruitment_ends_at,
          btrim(p_public_area), nullif(btrim(coalesce(p_preference_note, '')), ''), v_tags, coalesce(p_partner_gender, 'any'))
  returning * into v_post;

  insert into public.post_private_details (post_id, exact_location)
  values (v_post.id, btrim(p_exact_location));

  return v_post;
end;
$$;
revoke all on function public.create_post(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text, text, text, text[], text) from public, anon;
grant execute on function public.create_post(uuid, text, text, text, timestamptz, timestamptz, timestamptz, text, text, text, text[], text) to authenticated;

create or replace function public.create_join_request(p_post_id uuid, p_message text)
returns table (id uuid, post_id uuid, status text, created_at timestamptz, already_existed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
  v_request public.join_requests;
  v_message text := btrim(coalesce(p_message, ''));
  v_gender text;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select pr.gender into v_gender from public.profiles pr where pr.id = v_uid;
  if not found then
    raise exception 'profile_required' using errcode = '42501';
  end if;

  -- Lock the post so concurrent submits and a concurrent final match are serialized.
  select * into v_post from public.posts p where p.id = p_post_id and p.status <> 'deleted' for update;
  if not found then
    raise exception 'post_unavailable' using errcode = 'PT404';
  end if;
  if v_post.author_id = v_uid then
    raise exception 'own_post' using errcode = '42501';
  end if;

  select * into v_request from public.join_requests r where r.post_id = p_post_id and r.requester_id = v_uid;
  if found then
    return query select v_request.id, v_request.post_id, v_request.status, v_request.created_at, true;
    return;
  end if;

  if v_post.status <> 'recruiting' or v_post.recruitment_ends_at <= now() or v_post.starts_at <= now() then
    raise exception 'recruitment_closed' using errcode = '22023';
  end if;
  if v_post.partner_gender <> 'any' and v_gender is distinct from v_post.partner_gender then
    raise exception 'partner_condition_mismatch' using errcode = '42501';
  end if;
  if char_length(v_message) < 10 or char_length(v_message) > 300 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  insert into public.join_requests (post_id, requester_id, message)
  values (p_post_id, v_uid, v_message)
  returning * into v_request;

  return query select v_request.id, v_request.post_id, v_request.status, v_request.created_at, false;
end;
$$;

-- Masked author name + photo for list cards of a logged-in viewer. No raw name, birth date or phone.
create function public.get_post_author_cards(p_post_ids uuid[])
returns table (post_id uuid, author_id uuid, masked_name text, avatar_url text)
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
    select p.id, p.author_id, public.mask_real_name(pr.real_name), pr.avatar_url
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = any (coalesce(p_post_ids, '{}')) and p.status <> 'deleted'
    limit 200;
end;
$$;
revoke all on function public.get_post_author_cards(uuid[]) from public, anon;
grant execute on function public.get_post_author_cards(uuid[]) to authenticated;
