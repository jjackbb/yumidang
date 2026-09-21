-- Remote migration version: 20260916110758 (applied through the project-scoped Supabase MCP).
-- Feature 7: author confirms one pending request atomically; only the two confirmed people see the exact place.
alter table public.join_requests drop constraint join_requests_status_allowed;
alter table public.join_requests add constraint join_requests_status_allowed
  check (status in ('pending', 'withdrawn', 'declined', 'matched', 'not_selected'));
comment on column public.join_requests.status is
  'pending(매칭 대화 중) / withdrawn(신청 취소) / declined(신청 거절) / matched(동행 확정) / not_selected(다른 동행자와 확정).';
alter table public.join_requests add constraint join_requests_id_post_unique unique (id, post_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  join_request_id uuid not null,
  status text not null default 'confirmed',
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_one_per_post unique (post_id),
  constraint appointments_one_per_request unique (join_request_id),
  constraint appointments_request_matches_post foreign key (join_request_id, post_id)
    references public.join_requests (id, post_id) on delete cascade,
  constraint appointments_status_allowed check (status in ('confirmed'))
);

comment on table public.appointments is 'Final 1:1 meetup. Participants are derived from posts.author_id and join_requests.requester_id (not copied).';
comment on column public.appointments.confirmed_at is 'Server time the final match transaction committed.';

create trigger appointments_set_updated_at before update on public.appointments
for each row execute function private.set_updated_at();

-- 'author' | 'companion' | null for the current user.
create function private.appointment_role(p_appointment_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.author_id = (select auth.uid()) then 'author'
    when r.requester_id = (select auth.uid()) then 'companion'
  end
  from public.appointments ap
  join public.posts p on p.id = ap.post_id
  join public.join_requests r on r.id = ap.join_request_id
  where ap.id = p_appointment_id;
$$;

-- True when the current user is the confirmed companion of the post.
create function private.is_confirmed_companion(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments ap
    join public.join_requests r on r.id = ap.join_request_id
    where ap.post_id = p_post_id and r.requester_id = (select auth.uid())
  );
$$;

revoke all on function private.appointment_role(uuid) from public, anon;
revoke all on function private.is_confirmed_companion(uuid) from public, anon;
grant execute on function private.appointment_role(uuid) to authenticated;
grant execute on function private.is_confirmed_companion(uuid) to authenticated;

alter table public.appointments enable row level security;
revoke all on table public.appointments from anon, authenticated;
grant select on table public.appointments to authenticated;

create policy appointments_select_participants on public.appointments
for select to authenticated
using ((select private.appointment_role(id)) is not null);

drop policy post_private_details_select_author on public.post_private_details;
create policy post_private_details_select_author_or_companion on public.post_private_details
for select to authenticated
using ((select private.is_post_author(post_id)) or (select private.is_confirmed_companion(post_id)));

-- Matched conversations stay open; pending ones close at the meetup start.
create or replace function private.can_send_message(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.join_requests r
    join public.posts p on p.id = r.post_id
    where r.id = p_request_id
      and (r.requester_id = (select auth.uid()) or p.author_id = (select auth.uid()))
      and p.status <> 'deleted'
      and ((r.status = 'pending' and now() < p.starts_at) or r.status = 'matched')
  );
$$;

create function public.confirm_match(p_request_id uuid)
returns table (appointment_id uuid, post_id uuid, join_request_id uuid, status text, confirmed_at timestamptz, already_confirmed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_post public.posts;
  v_request public.join_requests;
  v_appointment public.appointments;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select r.post_id into v_post_id from public.join_requests r where r.id = p_request_id;
  if not found then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;

  -- Post lock serializes every confirm/request on this post (two tabs, two requests).
  select * into v_post from public.posts p where p.id = v_post_id for update;
  if v_post.author_id is distinct from v_uid or v_post.status = 'deleted' then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;

  select * into v_appointment from public.appointments ap where ap.post_id = v_post.id;
  if found then
    if v_appointment.join_request_id = p_request_id then
      return query select v_appointment.id, v_appointment.post_id, v_appointment.join_request_id, v_appointment.status, v_appointment.confirmed_at, true;
      return;
    end if;
    raise exception 'already_matched' using errcode = '23505';
  end if;

  select * into v_request from public.join_requests r where r.id = p_request_id for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending' using errcode = '22023';
  end if;
  if v_post.status <> 'recruiting' or now() >= v_post.starts_at then
    raise exception 'match_window_closed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.post_private_details d where d.post_id = v_post.id and char_length(d.exact_location) >= 2) then
    raise exception 'exact_location_required' using errcode = '22023';
  end if;

  perform 1 from public.join_requests r where r.post_id = v_post.id and r.status = 'pending' for update;

  insert into public.appointments (post_id, join_request_id) values (v_post.id, p_request_id) returning * into v_appointment;
  update public.join_requests r set status = 'matched' where r.id = p_request_id;
  update public.join_requests r set status = 'not_selected' where r.post_id = v_post.id and r.id <> p_request_id and r.status = 'pending';
  update public.posts p set status = 'closed' where p.id = v_post.id;

  return query select v_appointment.id, v_appointment.post_id, v_appointment.join_request_id, v_appointment.status, v_appointment.confirmed_at, false;
end;
$$;

create function public.list_my_appointments()
returns table (
  appointment_id uuid, post_id uuid, join_request_id uuid, my_role text, status text, confirmed_at timestamptz,
  post_title text, post_starts_at timestamptz, post_ends_at timestamptz, post_public_area text,
  counterpart_masked_name text, counterpart_avatar_url text, server_now timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select ap.id, ap.post_id, ap.join_request_id,
         case when p.author_id = (select auth.uid()) then 'author' else 'companion' end,
         ap.status, ap.confirmed_at, p.title, p.starts_at, p.ends_at, p.public_area,
         public.mask_real_name(pr.real_name), pr.avatar_url, now()
  from public.appointments ap
  join public.posts p on p.id = ap.post_id
  join public.join_requests r on r.id = ap.join_request_id
  join public.profiles pr on pr.id = case when p.author_id = (select auth.uid()) then r.requester_id else p.author_id end
  where p.author_id = (select auth.uid()) or r.requester_id = (select auth.uid())
  order by p.starts_at desc, ap.id;
$$;

create or replace function public.get_conversation(p_request_id uuid)
returns table (
  request_id uuid, my_role text, request_status text, request_message text, request_created_at timestamptz,
  post_id uuid, post_title text, post_starts_at timestamptz, post_ends_at timestamptz, post_public_area text, post_status text,
  counterpart_masked_name text, counterpart_avatar_url text, can_send boolean, appointment_id uuid, server_now timestamptz
)
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
    select r.id, v_role, r.status, r.message, r.created_at,
           p.id, p.title, p.starts_at, p.ends_at, p.public_area, p.status,
           public.mask_real_name(pr.real_name), pr.avatar_url,
           private.can_send_message(r.id),
           -- Only the matched pair learns the appointment id.
           (select ap.id from public.appointments ap where ap.join_request_id = r.id),
           now()
    from public.join_requests r
    join public.posts p on p.id = r.post_id
    join public.profiles pr on pr.id = case when v_role = 'requester' then p.author_id else r.requester_id end
    where r.id = p_request_id;
end;
$$;

revoke all on function public.confirm_match(uuid) from public, anon;
revoke all on function public.list_my_appointments() from public, anon;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.list_my_appointments() to authenticated;

alter publication supabase_realtime add table public.appointments;
