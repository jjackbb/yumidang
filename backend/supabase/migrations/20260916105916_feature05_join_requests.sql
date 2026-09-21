-- Remote migration version: 20260916105916 (applied through the project-scoped Supabase MCP).
-- Feature 5: join requests. Created/withdrawn/declined only through RPCs; requester and author read their own.
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint join_requests_one_per_member unique (post_id, requester_id),
  constraint join_requests_message_length check (message = btrim(message) and char_length(message) between 10 and 300),
  constraint join_requests_status_allowed check (status in ('pending', 'withdrawn', 'declined'))
);

comment on table public.join_requests is 'One join request per (post, requester). Row is never deleted; status records withdraw/decline.';
comment on column public.join_requests.requester_id is 'Requester, always auth.uid() inside create_join_request.';
comment on column public.join_requests.status is 'pending(매칭 대화 중) / withdrawn(신청 취소) / declined(신청 거절).';

create index join_requests_requester_idx on public.join_requests (requester_id, created_at desc);
create index join_requests_post_idx on public.join_requests (post_id, created_at desc);

create trigger join_requests_set_updated_at before update on public.join_requests
for each row execute function private.set_updated_at();

-- 'requester' | 'author' | null for the current user; definer so RLS on posts/profiles never recurses.
create function private.request_role(p_request_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r.requester_id = (select auth.uid()) then 'requester'
    when p.author_id = (select auth.uid()) then 'author'
  end
  from public.join_requests r
  join public.posts p on p.id = r.post_id
  where r.id = p_request_id;
$$;
revoke all on function private.request_role(uuid) from public, anon;
grant execute on function private.request_role(uuid) to authenticated;

alter table public.join_requests enable row level security;
revoke all on table public.join_requests from anon, authenticated;
grant select on table public.join_requests to authenticated;

create policy join_requests_select_participants on public.join_requests
for select to authenticated
using (requester_id = (select auth.uid()) or (select private.is_post_author(post_id)));

create function public.create_join_request(p_post_id uuid, p_message text)
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
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles pr where pr.id = v_uid) then
    raise exception 'profile_required' using errcode = '42501';
  end if;

  -- Lock the post so concurrent submits and a concurrent final match are serialized.
  select * into v_post from public.posts p where p.id = p_post_id and p.status <> 'deleted' for update;
  if not found then
    raise exception 'post_unavailable' using errcode = 'P0002';
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
  if char_length(v_message) < 10 or char_length(v_message) > 300 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  insert into public.join_requests (post_id, requester_id, message)
  values (p_post_id, v_uid, v_message)
  returning * into v_request;

  return query select v_request.id, v_request.post_id, v_request.status, v_request.created_at, false;
end;
$$;

create function public.withdraw_join_request(p_request_id uuid)
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.join_requests;
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select * into v_request from public.join_requests r where r.id = p_request_id for update;
  if not found or v_request.requester_id <> auth.uid() then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;
  if v_request.status = 'pending' then
    update public.join_requests r set status = 'withdrawn' where r.id = p_request_id returning * into v_request;
  elsif v_request.status <> 'withdrawn' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  return query select v_request.id, v_request.status, v_request.updated_at;
end;
$$;

create function public.decline_join_request(p_request_id uuid)
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.join_requests;
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select r.* into v_request from public.join_requests r where r.id = p_request_id for update;
  if not found or private.request_role(p_request_id) is distinct from 'author' then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;
  if v_request.status = 'pending' then
    update public.join_requests r set status = 'declined' where r.id = p_request_id returning * into v_request;
  elsif v_request.status <> 'declined' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  return query select v_request.id, v_request.status, v_request.updated_at;
end;
$$;

create function public.list_sent_join_requests()
returns table (
  id uuid, post_id uuid, post_title text, post_starts_at timestamptz, post_ends_at timestamptz,
  post_public_area text, post_status text, author_masked_name text, message text, status text,
  created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.post_id, p.title, p.starts_at, p.ends_at, p.public_area, p.status,
         public.mask_real_name(pr.real_name), r.message, r.status, r.created_at, r.updated_at
  from public.join_requests r
  join public.posts p on p.id = r.post_id
  join public.profiles pr on pr.id = p.author_id
  where r.requester_id = (select auth.uid())
  order by r.created_at desc, r.id desc;
$$;

create function public.list_received_join_requests()
returns table (
  id uuid, post_id uuid, post_title text, post_starts_at timestamptz, post_status text,
  requester_masked_name text, requester_age integer, requester_avatar_url text,
  message text, status text, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.post_id, p.title, p.starts_at, p.status,
         public.mask_real_name(pr.real_name), public.korean_age(pr.birth_date), pr.avatar_url,
         r.message, r.status, r.created_at, r.updated_at
  from public.join_requests r
  join public.posts p on p.id = r.post_id
  join public.profiles pr on pr.id = r.requester_id
  where p.author_id = (select auth.uid()) and p.status <> 'deleted'
  order by r.created_at desc, r.id desc;
$$;

-- Safe profile of the other participant of a request (requester sees author, author sees requester).
create function public.get_request_counterpart_profile(p_request_id uuid)
returns table (masked_name text, age integer, avatar_url text, bio text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.request_role(p_request_id);
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;
  return query
    select public.mask_real_name(pr.real_name), public.korean_age(pr.birth_date), pr.avatar_url, pr.bio
    from public.join_requests r
    join public.posts p on p.id = r.post_id
    join public.profiles pr on pr.id = case when v_role = 'requester' then p.author_id else r.requester_id end
    where r.id = p_request_id;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_join_request(uuid, text)', 'public.withdraw_join_request(uuid)', 'public.decline_join_request(uuid)',
    'public.list_sent_join_requests()', 'public.list_received_join_requests()', 'public.get_request_counterpart_profile(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
