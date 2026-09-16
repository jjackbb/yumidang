-- Remote migration version: 20260916110943 (applied through the project-scoped Supabase MCP).
-- Feature 8: each participant confirms completion after posts.ends_at (server time); the second confirmation completes the appointment.
alter table public.appointments add column completed_at timestamptz;
alter table public.appointments drop constraint appointments_status_allowed;
alter table public.appointments add constraint appointments_status_allowed check (status in ('confirmed', 'completed'));
alter table public.appointments add constraint appointments_completed_at_matches_status
  check ((status = 'completed') = (completed_at is not null));
comment on column public.appointments.completed_at is 'Server time of the second participant confirmation; set in the same transaction as status=completed.';

create table public.appointment_completion_confirmations (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (appointment_id, user_id)
);
comment on table public.appointment_completion_confirmations is 'One immutable completion confirmation per participant. Its existence also unlocks that participant''s review.';
create index appointment_completion_confirmations_user_idx on public.appointment_completion_confirmations (user_id);

alter table public.appointment_completion_confirmations enable row level security;
revoke all on table public.appointment_completion_confirmations from anon, authenticated;
grant select on table public.appointment_completion_confirmations to authenticated;

create policy appointment_completion_confirmations_select_participants on public.appointment_completion_confirmations
for select to authenticated
using ((select private.appointment_role(appointment_id)) is not null);

create function public.confirm_appointment_completion(p_appointment_id uuid)
returns table (appointment_id uuid, status text, completed_at timestamptz, my_confirmed_at timestamptz, peer_confirmed_at timestamptz)
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
  v_count integer;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  -- Row lock: simultaneous confirmations compute the final state one after another.
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  v_role := private.appointment_role(p_appointment_id);
  if v_appointment.id is null or v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'P0002';
  end if;
  select p.ends_at into v_ends_at from public.posts p where p.id = v_appointment.post_id;
  if v_ends_at is null or now() < v_ends_at then
    raise exception 'too_early' using errcode = '22023';
  end if;

  insert into public.appointment_completion_confirmations (appointment_id, user_id)
  values (p_appointment_id, v_uid)
  on conflict do nothing;

  select count(*) into v_count from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id;
  if v_count >= 2 and v_appointment.status = 'confirmed' then
    update public.appointments ap set status = 'completed', completed_at = now() where ap.id = p_appointment_id
    returning * into v_appointment;
  end if;

  return query
    select v_appointment.id, v_appointment.status, v_appointment.completed_at,
           (select c.confirmed_at from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id = v_uid),
           (select c.confirmed_at from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id <> v_uid);
end;
$$;

create function public.get_appointment_state(p_appointment_id uuid)
returns table (
  appointment_id uuid, join_request_id uuid, my_role text, status text, confirmed_at timestamptz, completed_at timestamptz,
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
    raise exception 'appointment_unavailable' using errcode = 'P0002';
  end if;
  return query
    select ap.id, ap.join_request_id, v_role, ap.status, ap.confirmed_at, ap.completed_at,
           p.id, p.title, p.starts_at, p.ends_at, p.public_area,
           public.mask_real_name(pr.real_name), pr.avatar_url,
           mine.confirmed_at, peer.confirmed_at,
           (now() >= p.ends_at and mine.confirmed_at is null),
           now()
    from public.appointments ap
    join public.posts p on p.id = ap.post_id
    join public.join_requests r on r.id = ap.join_request_id
    join public.profiles pr on pr.id = case when v_role = 'author' then r.requester_id else p.author_id end
    left join public.appointment_completion_confirmations mine on mine.appointment_id = ap.id and mine.user_id = v_uid
    left join public.appointment_completion_confirmations peer on peer.appointment_id = ap.id and peer.user_id <> v_uid
    where ap.id = p_appointment_id;
end;
$$;

revoke all on function public.confirm_appointment_completion(uuid) from public, anon;
revoke all on function public.get_appointment_state(uuid) from public, anon;
grant execute on function public.confirm_appointment_completion(uuid) to authenticated;
grant execute on function public.get_appointment_state(uuid) to authenticated;

alter publication supabase_realtime add table public.appointment_completion_confirmations;
