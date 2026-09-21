-- Remote migration version: 20260917005621 (applied through project-scoped Supabase MCP).
-- P1-P3 policy alignment (2026-09-17): request retry history, one-party/automatic
-- completion, a 24-hour dispute hold, and completed_at-based review release.

-- P1. Preserve every request row while allowing one new request after withdrawal.
alter table public.join_requests drop constraint if exists join_requests_one_per_member;
create unique index join_requests_one_pending_per_member
  on public.join_requests (post_id, requester_id)
  where status = 'pending';
comment on index public.join_requests_one_pending_per_member is
  'At most one active pending request per post/requester. Withdrawn and declined rows remain immutable history.';
comment on table public.join_requests is
  'Immutable request identity/history. A withdrawal may be followed by a new row/new conversation; a decline permanently blocks another request to that post.';

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

  -- One post lock serializes first requests, retries and concurrent re-requests.
  select * into v_post from public.posts p where p.id = p_post_id and p.status <> 'deleted' for update;
  if not found then
    raise exception 'post_unavailable' using errcode = 'PT404';
  end if;
  if v_post.author_id = v_uid then
    raise exception 'own_post' using errcode = '42501';
  end if;
  if v_post.status <> 'recruiting' or v_post.recruitment_ends_at <= now() or v_post.starts_at <= now() then
    raise exception 'recruitment_closed' using errcode = '22023';
  end if;

  select * into v_request
  from public.join_requests r
  where r.post_id = p_post_id and r.requester_id = v_uid and r.status = 'pending'
  order by r.created_at desc, r.id desc
  limit 1;
  if found then
    return query select v_request.id, v_request.post_id, v_request.status, v_request.created_at, true;
    return;
  end if;

  if exists (
    select 1 from public.join_requests r
    where r.post_id = p_post_id and r.requester_id = v_uid and r.status = 'declined'
  ) then
    raise exception 'request_declined_history' using errcode = '42501';
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

-- P2. Completion is final after the first valid manual confirmation or a scheduled
-- automatic completion. Notification time is the server time the state first became
-- visible in the app; it starts the independent 24-hour dispute window.
alter table public.appointments drop constraint if exists appointments_completed_at_matches_status;
alter table public.appointments drop constraint if exists appointments_status_allowed;
alter table public.appointments add column completion_method text;
alter table public.appointments add column completed_by_user_id uuid references public.profiles (id);
alter table public.appointments add column completion_notified_at timestamptz;
alter table public.appointments add column dispute_deadline_at timestamptz;
alter table public.appointments add column review_deadline_at timestamptz;
create index appointments_completed_by_user_idx
  on public.appointments (completed_by_user_id)
  where completed_by_user_id is not null;

update public.appointments ap
set completion_method = 'manual',
    completed_by_user_id = coalesce(
      (select c.user_id from public.appointment_completion_confirmations c
       where c.appointment_id = ap.id order by c.confirmed_at, c.user_id limit 1),
      (select p.author_id from public.posts p where p.id = ap.post_id)
    ),
    completion_notified_at = ap.completed_at,
    dispute_deadline_at = ap.completed_at + interval '24 hours',
    review_deadline_at = ap.completed_at + interval '7 days'
where ap.status = 'completed';

alter table public.appointments add constraint appointments_status_allowed
  check (status in ('confirmed', 'completed', 'disputed', 'no_show', 'cancelled'));
alter table public.appointments add constraint appointments_completion_method_allowed
  check (completion_method is null or completion_method in ('manual', 'automatic'));
alter table public.appointments add constraint appointments_completion_contract check (
  (
    status in ('completed', 'disputed', 'no_show')
    and completed_at is not null
    and completion_method is not null
    and completion_notified_at is not null
    and dispute_deadline_at = completion_notified_at + interval '24 hours'
    and review_deadline_at is not null
    and ((completion_method = 'manual' and completed_by_user_id is not null)
      or (completion_method = 'automatic' and completed_by_user_id is null))
  ) or (
    status in ('confirmed', 'cancelled')
    and completed_at is null
    and completion_method is null
    and completed_by_user_id is null
    and completion_notified_at is null
    and dispute_deadline_at is null
    and review_deadline_at is null
  )
);
comment on column public.appointments.completed_at is
  'Server time of the first manual completion or the scheduled automatic completion; review writing ends seven days from this timestamp, subject to dispute pauses.';
comment on column public.appointments.completion_method is 'manual: first participant action; automatic: ends_at + 24 hours scheduled processing.';
comment on column public.appointments.completed_by_user_id is 'Manual completion actor for audit. Null only for automatic completion.';
comment on column public.appointments.completion_notified_at is 'Server time completion became app-visible; starts the 24-hour dispute window.';
comment on column public.appointments.dispute_deadline_at is 'Exclusive deadline for an eligible participant to dispute completion.';
comment on column public.appointments.review_deadline_at is 'Exclusive review submission deadline. Initially completed_at + 7 days and extended after an actual-meetup dispute ruling.';
comment on table public.appointment_completion_confirmations is
  'Immutable audit row for the participant whose valid manual request first completed the appointment. Automatic completion creates no row.';

create table public.appointment_disputes (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  raised_by_user_id uuid not null references public.profiles (id),
  reason text not null,
  raised_at timestamptz not null default now(),
  review_time_remaining interval not null,
  status text not null default 'open',
  resolved_at timestamptz,
  resolution text,
  constraint appointment_disputes_reason_length check (reason = btrim(reason) and char_length(reason) between 2 and 500),
  constraint appointment_disputes_remaining_nonnegative check (review_time_remaining >= interval '0 seconds'),
  constraint appointment_disputes_status_allowed check (status in ('open', 'resolved')),
  constraint appointment_disputes_resolution_allowed check (
    (status = 'open' and resolved_at is null and resolution is null)
    or (status = 'resolved' and resolved_at is not null and resolution in ('actual_meetup', 'no_show'))
  )
);
comment on table public.appointment_disputes is
  'Private per-appointment dispute. Opening pauses review writing/release and preserves remaining review time; no general user can resolve it.';
create index appointment_disputes_raised_by_idx on public.appointment_disputes (raised_by_user_id, raised_at desc);
alter table public.appointment_disputes enable row level security;
revoke all on table public.appointment_disputes from anon, authenticated;

create function public.automatic_completion_due(p_ends_at timestamptz, p_status text, p_at timestamptz)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_status = 'confirmed' and p_ends_at is not null and p_at >= p_ends_at + interval '24 hours';
$$;
revoke all on function public.automatic_completion_due(timestamptz, text, timestamptz) from public, anon;
grant execute on function public.automatic_completion_due(timestamptz, text, timestamptz) to authenticated;

create function private.complete_due_appointments(p_at timestamptz default now(), p_limit integer default 100)
returns table (appointment_id uuid, completed_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  return query
    with due as (
      select ap.id
      from public.appointments ap
      join public.posts p on p.id = ap.post_id
      where public.automatic_completion_due(p.ends_at, ap.status, p_at)
      order by p.ends_at, ap.id
      for update of ap skip locked
      limit p_limit
    ), completed as (
      update public.appointments ap
      set status = 'completed',
          completed_at = p_at,
          completion_method = 'automatic',
          completed_by_user_id = null,
          completion_notified_at = p_at,
          dispute_deadline_at = p_at + interval '24 hours',
          review_deadline_at = p_at + interval '7 days'
      from due
      where ap.id = due.id and ap.status = 'confirmed'
      returning ap.id, ap.completed_at
    )
    select completed.id, completed.completed_at from completed;
end;
$$;
revoke all on function private.complete_due_appointments(timestamptz, integer) from public, anon, authenticated;

drop function public.confirm_appointment_completion(uuid);
create function public.confirm_appointment_completion(p_appointment_id uuid)
returns table (
  appointment_id uuid, status text, completed_at timestamptz, completion_method text,
  my_confirmed_at timestamptz, completion_notified_at timestamptz,
  dispute_deadline_at timestamptz, completed_by_me boolean, can_dispute boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_appointment public.appointments;
  v_ends_at timestamptz;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  v_role := private.appointment_role(p_appointment_id);
  if v_appointment.id is null or v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  select p.ends_at into v_ends_at from public.posts p where p.id = v_appointment.post_id;
  if v_ends_at is null or now() < v_ends_at then
    raise exception 'too_early' using errcode = '22023';
  end if;

  if v_appointment.status = 'confirmed' then
    insert into public.appointment_completion_confirmations (appointment_id, user_id)
    values (p_appointment_id, v_uid)
    on conflict do nothing;

    update public.appointments ap
    set status = 'completed',
        completed_at = now(),
        completion_method = 'manual',
        completed_by_user_id = v_uid,
        completion_notified_at = now(),
        dispute_deadline_at = now() + interval '24 hours',
        review_deadline_at = now() + interval '7 days'
    where ap.id = p_appointment_id and ap.status = 'confirmed'
    returning * into v_appointment;
  elsif v_appointment.status not in ('completed', 'disputed') then
    raise exception 'completion_unavailable' using errcode = '22023';
  end if;

  return query select
    v_appointment.id, v_appointment.status, v_appointment.completed_at, v_appointment.completion_method,
    (select c.confirmed_at from public.appointment_completion_confirmations c
      where c.appointment_id = p_appointment_id and c.user_id = v_uid),
    v_appointment.completion_notified_at, v_appointment.dispute_deadline_at,
    v_appointment.completed_by_user_id = v_uid,
    (v_appointment.status = 'completed' and now() < v_appointment.dispute_deadline_at
      and (v_appointment.completion_method = 'automatic' or v_appointment.completed_by_user_id <> v_uid)
      and not exists (select 1 from public.appointment_disputes d where d.appointment_id = p_appointment_id));
end;
$$;

create function public.raise_appointment_dispute(p_appointment_id uuid, p_reason text)
returns table (appointment_id uuid, status text, raised_at timestamptz, review_deadline_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_appointment public.appointments;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_dispute public.appointment_disputes;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  if v_appointment.id is null or private.appointment_role(p_appointment_id) is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  select * into v_dispute from public.appointment_disputes d where d.appointment_id = p_appointment_id;
  if found then
    if v_dispute.raised_by_user_id = v_uid then
      return query select v_dispute.appointment_id, v_appointment.status, v_dispute.raised_at, v_appointment.review_deadline_at;
      return;
    end if;
    raise exception 'dispute_already_open' using errcode = '23505';
  end if;
  if v_appointment.status <> 'completed' or now() >= v_appointment.dispute_deadline_at then
    raise exception 'dispute_window_closed' using errcode = '22023';
  end if;
  if v_appointment.completion_method = 'manual' and v_appointment.completed_by_user_id = v_uid then
    raise exception 'dispute_not_allowed' using errcode = '42501';
  end if;
  if char_length(v_reason) < 2 or char_length(v_reason) > 500 then
    raise exception 'invalid_dispute_reason' using errcode = '22023';
  end if;

  insert into public.appointment_disputes (appointment_id, raised_by_user_id, reason, review_time_remaining)
  values (p_appointment_id, v_uid, v_reason, greatest(v_appointment.review_deadline_at - now(), interval '0 seconds'))
  returning * into v_dispute;
  update public.appointments ap set status = 'disputed' where ap.id = p_appointment_id returning * into v_appointment;

  return query select v_dispute.appointment_id, v_appointment.status, v_dispute.raised_at, v_appointment.review_deadline_at;
end;
$$;

create function private.resolve_appointment_dispute(p_appointment_id uuid, p_resolution text, p_at timestamptz default now())
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_dispute public.appointment_disputes;
begin
  if p_resolution not in ('actual_meetup', 'no_show') then
    raise exception 'invalid_resolution' using errcode = '22023';
  end if;
  select * into v_dispute from public.appointment_disputes d
  where d.appointment_id = p_appointment_id and d.status = 'open' for update;
  if not found then
    raise exception 'dispute_unavailable' using errcode = 'P0002';
  end if;

  update public.appointment_disputes
  set status = 'resolved', resolved_at = p_at, resolution = p_resolution
  where appointment_id = p_appointment_id;

  if p_resolution = 'actual_meetup' then
    update public.appointments
    set status = 'completed', review_deadline_at = p_at + greatest(v_dispute.review_time_remaining, interval '24 hours')
    where id = p_appointment_id;
  else
    update public.appointments set status = 'no_show' where id = p_appointment_id;
  end if;
end;
$$;
revoke all on function private.resolve_appointment_dispute(uuid, text, timestamptz) from public, anon, authenticated;

drop function public.get_appointment_state(uuid);
create function public.get_appointment_state(p_appointment_id uuid)
returns table (
  appointment_id uuid, join_request_id uuid, my_role text, status text, confirmed_at timestamptz, completed_at timestamptz,
  completion_method text, completion_notified_at timestamptz, dispute_deadline_at timestamptz,
  completed_by_me boolean, can_dispute boolean, dispute_status text,
  post_id uuid, post_title text, post_starts_at timestamptz, post_ends_at timestamptz, post_public_area text,
  counterpart_masked_name text, counterpart_avatar_url text,
  my_completion_at timestamptz, peer_completion_at timestamptz, can_confirm_completion boolean, server_now timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.appointment_role(p_appointment_id);
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  return query
    select ap.id, ap.join_request_id, v_role, ap.status, ap.confirmed_at, ap.completed_at,
           ap.completion_method, ap.completion_notified_at, ap.dispute_deadline_at,
           ap.completed_by_user_id = v_uid,
           (ap.status = 'completed' and now() < ap.dispute_deadline_at
             and (ap.completion_method = 'automatic' or ap.completed_by_user_id <> v_uid)
             and d.appointment_id is null),
           d.status,
           p.id, p.title, p.starts_at, p.ends_at, p.public_area,
           public.mask_real_name(pr.real_name), pr.avatar_url,
           mine.confirmed_at, peer.confirmed_at,
           (ap.status = 'confirmed' and now() >= p.ends_at),
           now()
    from public.appointments ap
    join public.posts p on p.id = ap.post_id
    join public.join_requests r on r.id = ap.join_request_id
    join public.profiles pr on pr.id = case when v_role = 'author' then r.requester_id else p.author_id end
    left join public.appointment_completion_confirmations mine on mine.appointment_id = ap.id and mine.user_id = v_uid
    left join public.appointment_completion_confirmations peer on peer.appointment_id = ap.id and peer.user_id <> v_uid
    left join public.appointment_disputes d on d.appointment_id = ap.id
    where ap.id = p_appointment_id;
end;
$$;

-- P3. Review writing is based on completed_at. Publication is held during the
-- dispute window and any dispute. At the deadline, a single submitted review is
-- released without requiring a batch job.
drop function public.submit_appointment_review(uuid, integer, text);
drop function public.get_appointment_review_state(uuid);
drop function public.review_submission_open(timestamptz, timestamptz);

create function public.review_submission_open(
  p_completed_at timestamptz, p_deadline_at timestamptz, p_status text, p_at timestamptz
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_status = 'completed'
    and p_completed_at is not null
    and p_deadline_at is not null
    and p_at >= p_completed_at
    and p_at < p_deadline_at;
$$;
revoke all on function public.review_submission_open(timestamptz, timestamptz, text, timestamptz) from public, anon;
grant execute on function public.review_submission_open(timestamptz, timestamptz, text, timestamptz) to authenticated;

create function public.get_appointment_review_state(p_appointment_id uuid)
returns table (
  appointment_id uuid, appointment_completed boolean, deadline_at timestamptz, hold_until timestamptz,
  disputed boolean, can_write boolean, own_review jsonb, peer_submitted boolean,
  released boolean, release_reason text, peer_review jsonb, server_now timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.appointment_role(p_appointment_id);
  v_appointment public.appointments;
  v_own public.appointment_reviews;
  v_peer public.appointment_reviews;
  v_disputed boolean;
  v_released boolean;
  v_release_reason text;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id;
  select * into v_own from public.appointment_reviews rv where rv.appointment_id = p_appointment_id and rv.reviewer_id = v_uid;
  select * into v_peer from public.appointment_reviews rv where rv.appointment_id = p_appointment_id and rv.reviewer_id <> v_uid;
  v_disputed := v_appointment.status = 'disputed';
  v_released := v_appointment.status = 'completed'
    and now() >= v_appointment.dispute_deadline_at
    and ((v_own.id is not null and v_peer.id is not null)
      or (now() >= v_appointment.review_deadline_at and (v_own.id is not null or v_peer.id is not null)));
  v_release_reason := case
    when not v_released then null
    when v_own.id is not null and v_peer.id is not null then 'mutual'
    else 'deadline'
  end;

  return query select
    p_appointment_id,
    v_appointment.status in ('completed', 'disputed'),
    v_appointment.review_deadline_at,
    v_appointment.dispute_deadline_at,
    v_disputed,
    (v_own.id is null and public.review_submission_open(
      v_appointment.completed_at, v_appointment.review_deadline_at, v_appointment.status, now())),
    case when v_own.id is null then null else jsonb_build_object(
      'rating', v_own.rating, 'comment', v_own.comment, 'submitted_at', v_own.submitted_at) end,
    v_peer.id is not null,
    v_released,
    v_release_reason,
    case when v_released and v_peer.id is not null then jsonb_build_object(
      'rating', v_peer.rating, 'comment', v_peer.comment, 'submitted_at', v_peer.submitted_at) end,
    now();
end;
$$;

create function public.submit_appointment_review(p_appointment_id uuid, p_rating integer, p_comment text default null)
returns table (
  appointment_id uuid, appointment_completed boolean, deadline_at timestamptz, hold_until timestamptz,
  disputed boolean, can_write boolean, own_review jsonb, peer_submitted boolean,
  released boolean, release_reason text, peer_review jsonb, server_now timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_appointment public.appointments;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_existing public.appointment_reviews;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  if v_appointment.id is null or private.appointment_role(p_appointment_id) is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  if v_appointment.completed_at is null then
    raise exception 'completion_required' using errcode = '42501';
  end if;
  if v_appointment.status = 'disputed' then
    raise exception 'review_paused_by_dispute' using errcode = '22023';
  end if;
  if v_appointment.status <> 'completed' then
    raise exception 'review_unavailable' using errcode = '22023';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 300 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;

  select * into v_existing from public.appointment_reviews rv
  where rv.appointment_id = p_appointment_id and rv.reviewer_id = v_uid;
  if v_existing.id is not null then
    if v_existing.rating = p_rating and v_existing.comment is not distinct from v_comment then
      return query select * from public.get_appointment_review_state(p_appointment_id);
      return;
    end if;
    raise exception 'already_submitted' using errcode = '23505';
  end if;
  if not public.review_submission_open(
    v_appointment.completed_at, v_appointment.review_deadline_at, v_appointment.status, now()) then
    raise exception 'review_deadline_passed' using errcode = '22023';
  end if;

  insert into public.appointment_reviews (appointment_id, reviewer_id, rating, comment)
  values (p_appointment_id, v_uid, p_rating, v_comment);
  return query select * from public.get_appointment_review_state(p_appointment_id);
end;
$$;

revoke all on function public.confirm_appointment_completion(uuid) from public, anon;
revoke all on function public.raise_appointment_dispute(uuid, text) from public, anon;
revoke all on function public.get_appointment_state(uuid) from public, anon;
revoke all on function public.get_appointment_review_state(uuid) from public, anon;
revoke all on function public.submit_appointment_review(uuid, integer, text) from public, anon;
grant execute on function public.confirm_appointment_completion(uuid) to authenticated;
grant execute on function public.raise_appointment_dispute(uuid, text) to authenticated;
grant execute on function public.get_appointment_state(uuid) to authenticated;
grant execute on function public.get_appointment_review_state(uuid) to authenticated;
grant execute on function public.submit_appointment_review(uuid, integer, text) to authenticated;

-- Actual scheduler: no lazy read-time mutation. cron.schedule is used instead of
-- direct writes to cron.job (disallowed by current Supabase policy).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
  'yumidang-auto-complete-appointments',
  '* * * * *',
  'select count(*) from private.complete_due_appointments(now(), 100)'
);
