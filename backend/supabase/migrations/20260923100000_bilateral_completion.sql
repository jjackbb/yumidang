-- Bilateral completion. Historical completed rows are not rewritten.
begin;
comment on column public.appointments.completed_at is 'Actual server processing time of bilateral or automatic completion, including delayed automatic runs.';
comment on column public.appointments.completion_method is 'manual: both participants confirmed; automatic: actual processing after ends_at + 24 hours.';
comment on table public.appointment_completion_confirmations is 'Each participant records one immutable manual confirmation. Automatic processing never manufactures confirmations.';
alter table public.notifications drop constraint notifications_kind_allowed;
alter table public.notifications add constraint notifications_kind_allowed check (kind in ('join_request', 'appointment_completed'));
create function private.notify_appointment_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.completed_at is null and new.completed_at is not null then
    insert into public.notifications(recipient_id, kind, join_request_id, created_at)
      select ids.id, 'appointment_completed', new.join_request_id, new.completion_notified_at
      from public.posts p join public.join_requests r on r.id = new.join_request_id
      cross join lateral (values (p.author_id), (r.requester_id)) ids(id)
      where p.id = new.post_id
      on conflict (recipient_id,kind,join_request_id) do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.notify_appointment_completion() from public,anon,authenticated,service_role;
create trigger appointments_completion_notification after update on public.appointments
for each row execute function private.notify_appointment_completion();

-- Retain the historical cron call signature, but callers cannot provide a clock.
create or replace function private.complete_due_appointments(p_at timestamptz default now(), p_limit integer default 100)
returns table (appointment_id uuid, completed_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_at timestamptz;
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  for v_id in select ap.id from public.appointments ap join public.posts p on p.id = ap.post_id
    where ap.status = 'confirmed' and clock_timestamp() >= p.ends_at + interval '24 hours'
      and not exists(select 1 from public.appointment_disputes d where d.appointment_id = ap.id and (d.status = 'open' or d.resolution = 'no_show'))
    order by p.ends_at,ap.id for update of ap skip locked limit p_limit
  loop
    v_at := clock_timestamp();
    return query update public.appointments ap set status='completed', completed_at=v_at,
      completion_method='automatic',completed_by_user_id=null,completion_notified_at=v_at,
      dispute_deadline_at=v_at+interval '24 hours',review_deadline_at=v_at+interval '7 days'
      where ap.id=v_id and ap.status='confirmed' returning ap.id,ap.completed_at;
  end loop;
end; $$;
revoke all on function private.complete_due_appointments(timestamptz,integer) from public,anon,authenticated,service_role;
create function public.process_due_completions(p_limit integer)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select jsonb_build_object('completedCount',count(*),'appointments',coalesce(jsonb_agg(
    jsonb_build_object('appointmentId',c.appointment_id,'completedAt',c.completed_at)),'[]'::jsonb))
  from private.complete_due_appointments(clock_timestamp(),p_limit) c;
$$;
revoke all on function public.process_due_completions(integer) from public,anon,authenticated,service_role;
grant execute on function public.process_due_completions(integer) to service_role;
create or replace function public.confirm_appointment_completion(p_appointment_id uuid)
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
  v_at timestamptz;
  v_author uuid; v_requester uuid;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  select * into v_appointment from public.appointments ap where ap.id = p_appointment_id for update;
  v_role := private.appointment_role(p_appointment_id);
  if v_appointment.id is null or v_role is null then
    raise exception 'appointment_unavailable' using errcode = 'PT404';
  end if;
  v_at := clock_timestamp();
  select p.ends_at, p.author_id, r.requester_id into v_ends_at, v_author, v_requester
  from public.posts p join public.join_requests r on r.id = v_appointment.join_request_id
  where p.id = v_appointment.post_id;
  if exists (select 1 from public.appointment_disputes d where d.appointment_id = p_appointment_id and (d.status = 'open' or d.resolution = 'no_show')) then
    raise exception 'completion_unavailable' using errcode = '22023';
  end if;
  if v_ends_at is null or v_at < v_ends_at then
    raise exception 'too_early' using errcode = '22023';
  end if;

  if v_appointment.status = 'confirmed' then
    insert into public.appointment_completion_confirmations (appointment_id, user_id)
    values (p_appointment_id, v_uid)
    on conflict do nothing;

    if exists (select 1 from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id = v_author)
      and exists (select 1 from public.appointment_completion_confirmations c where c.appointment_id = p_appointment_id and c.user_id = v_requester) then
    update public.appointments ap
    set status = 'completed',
        completed_at = v_at,
        completion_method = 'manual',
        completed_by_user_id = v_uid,
        completion_notified_at = v_at,
        dispute_deadline_at = v_at + interval '24 hours',
        review_deadline_at = v_at + interval '7 days'
    where ap.id = p_appointment_id and ap.status = 'confirmed'
    returning * into v_appointment;
    end if;
  elsif v_appointment.status <> 'completed' then
    raise exception 'completion_unavailable' using errcode = '22023';
  end if;

  return query select
    v_appointment.id, v_appointment.status, v_appointment.completed_at, v_appointment.completion_method,
    (select c.confirmed_at from public.appointment_completion_confirmations c
      where c.appointment_id = p_appointment_id and c.user_id = v_uid),
    v_appointment.completion_notified_at, v_appointment.dispute_deadline_at,
    v_appointment.completed_by_user_id = v_uid,
    (v_appointment.status = 'completed' and v_at < v_appointment.dispute_deadline_at
      and (v_appointment.completion_method = 'automatic' or v_appointment.completed_by_user_id <> v_uid)
      and not exists (select 1 from public.appointment_disputes d where d.appointment_id = p_appointment_id));
end;
$$;


create or replace function public.get_appointment_state(p_appointment_id uuid)
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
           (ap.status = 'confirmed' and now() >= p.ends_at and mine.user_id is null and d.appointment_id is null),
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


commit;
