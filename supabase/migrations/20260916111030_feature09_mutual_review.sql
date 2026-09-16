-- Remote migration version: 20260916111030 (applied through the project-scoped Supabase MCP).
-- Feature 9: blind mutual reviews. No direct table access; RPCs reveal the peer review only when both exist.
create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null,
  comment text,
  submitted_at timestamptz not null default now(),
  constraint appointment_reviews_one_per_reviewer unique (appointment_id, reviewer_id),
  constraint appointment_reviews_rating_range check (rating between 1 and 5),
  constraint appointment_reviews_comment_length check (comment is null or (comment = btrim(comment) and char_length(comment) between 1 and 300))
);
comment on table public.appointment_reviews is 'Immutable blind review. reviewee is derived from the appointment pair, never stored or client-chosen.';
comment on column public.appointment_reviews.reviewer_id is 'auth.uid() inside submit_appointment_review.';
create index appointment_reviews_reviewer_idx on public.appointment_reviews (reviewer_id);

alter table public.appointment_reviews enable row level security;
-- Deliberately no grants and no policies: browsers never read or write raw review rows.
revoke all on table public.appointment_reviews from anon, authenticated;

-- Deadline rule shared by the RPC and the boundary check: open strictly before ends_at + 7 days.
create function public.review_submission_open(p_ends_at timestamptz, p_at timestamptz)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_at < p_ends_at + interval '7 days';
$$;
revoke all on function public.review_submission_open(timestamptz, timestamptz) from public, anon;
grant execute on function public.review_submission_open(timestamptz, timestamptz) to authenticated;

create function public.get_appointment_review_state(p_appointment_id uuid)
returns table (
  appointment_id uuid, my_completion_confirmed boolean, deadline_at timestamptz, can_write boolean,
  own_review jsonb, peer_submitted boolean, released boolean, peer_review jsonb, server_now timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := private.appointment_role(p_appointment_id);
  v_ends_at timestamptz;
  v_own public.appointment_reviews;
  v_peer public.appointment_reviews;
  v_completed boolean;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'P0002';
  end if;
  select p.ends_at into v_ends_at from public.appointments ap join public.posts p on p.id = ap.post_id where ap.id = p_appointment_id;
  select * into v_own from public.appointment_reviews rv where rv.appointment_id = p_appointment_id and rv.reviewer_id = v_uid;
  select * into v_peer from public.appointment_reviews rv where rv.appointment_id = p_appointment_id and rv.reviewer_id <> v_uid;
  v_completed := exists (select 1 from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id = v_uid);

  return query select
    p_appointment_id,
    v_completed,
    v_ends_at + interval '7 days',
    (v_completed and v_own.id is null and public.review_submission_open(v_ends_at, now())),
    case when v_own.id is null then null else jsonb_build_object('rating', v_own.rating, 'comment', v_own.comment, 'submitted_at', v_own.submitted_at) end,
    v_peer.id is not null,
    (v_own.id is not null and v_peer.id is not null),
    -- The peer's rating/comment leave the database only when both reviews exist.
    case when v_own.id is not null and v_peer.id is not null
      then jsonb_build_object('rating', v_peer.rating, 'comment', v_peer.comment, 'submitted_at', v_peer.submitted_at) end,
    now();
end;
$$;

create function public.submit_appointment_review(p_appointment_id uuid, p_rating integer, p_comment text default null)
returns table (
  appointment_id uuid, my_completion_confirmed boolean, deadline_at timestamptz, can_write boolean,
  own_review jsonb, peer_submitted boolean, released boolean, peer_review jsonb, server_now timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_appointment public.appointments;
  v_ends_at timestamptz;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_existing public.appointment_reviews;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  -- Lock the appointment so near-simultaneous submissions settle one release state.
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  if v_appointment.id is null or private.appointment_role(p_appointment_id) is null then
    raise exception 'appointment_unavailable' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id = v_uid) then
    raise exception 'completion_required' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 300 then
    raise exception 'invalid_comment' using errcode = '22023';
  end if;

  select * into v_existing from public.appointment_reviews rv where rv.appointment_id = p_appointment_id and rv.reviewer_id = v_uid;
  if v_existing.id is not null then
    if v_existing.rating = p_rating and v_existing.comment is not distinct from v_comment then
      return query select * from public.get_appointment_review_state(p_appointment_id); -- network retry
      return;
    end if;
    raise exception 'already_submitted' using errcode = '23505';
  end if;

  select p.ends_at into v_ends_at from public.posts p where p.id = v_appointment.post_id;
  if not public.review_submission_open(v_ends_at, now()) then
    raise exception 'review_deadline_passed' using errcode = '22023';
  end if;

  insert into public.appointment_reviews (appointment_id, reviewer_id, rating, comment)
  values (p_appointment_id, v_uid, p_rating, v_comment);

  return query select * from public.get_appointment_review_state(p_appointment_id);
end;
$$;

revoke all on function public.get_appointment_review_state(uuid) from public, anon;
revoke all on function public.submit_appointment_review(uuid, integer, text) from public, anon;
grant execute on function public.get_appointment_review_state(uuid) to authenticated;
grant execute on function public.submit_appointment_review(uuid, integer, text) to authenticated;
