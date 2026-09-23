-- Explicit future-review policy publication and durable, coalesced refresh intent.
begin;
alter table private.review_publication add column publication_source text not null default 'override'
  check (publication_source in ('policy','override'));
create table private.review_refresh_outbox (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default clock_timestamp()
);
alter table private.review_refresh_outbox enable row level security;
revoke all on private.review_refresh_outbox from public,anon,authenticated,service_role;
create table private.review_praise_catalog (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(btrim(label)) between 1 and 40)
);
alter table private.review_praise_catalog enable row level security;
revoke all on private.review_praise_catalog from public,anon,authenticated,service_role;
-- The product's button vocabulary is not settled. No invented production seed.
alter table public.appointment_reviews add column experience text check (experience in ('positive','neutral','negative'));
alter table public.appointment_reviews add column praises text[] not null default '{}';
alter table public.appointment_reviews add constraint review_praises_shape check (
  cardinality(praises) <= 3 and (cardinality(praises)=0 or experience='positive'));

create or replace function private.invalidate_appointment_review_summaries(p_appointment_ids uuid[])
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_profile_id uuid;
begin
  for v_profile_id in
    select distinct ids.id from public.appointments ap join public.posts p on p.id=ap.post_id
    join public.join_requests jr on jr.id=ap.join_request_id
    cross join lateral (values(p.author_id),(jr.requester_id)) ids(id)
    where ap.id=any(p_appointment_ids) order by ids.id
  loop
    insert into private.review_summary_state(profile_id) values(v_profile_id) on conflict do nothing;
    update private.review_summary_state set revision=revision+1,fingerprint=null,visible_summary_id=null where profile_id=v_profile_id;
    insert into private.review_refresh_outbox(profile_id) values(v_profile_id)
      on conflict(profile_id) do update set requested_at=clock_timestamp();
  end loop;
end; $$;

create or replace function private.refresh_review_summary_state(p_profile_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_state private.review_summary_state; v_sources jsonb; v_fingerprint text;
begin
  if not exists(select 1 from public.profiles where id=p_profile_id) then
    raise exception 'profile_unavailable' using errcode='P0002';
  end if;
  insert into private.review_summary_state(profile_id) values(p_profile_id) on conflict do nothing;
  select * into v_state from private.review_summary_state where profile_id=p_profile_id for update;
  v_sources:=private.review_summary_sources(p_profile_id); v_fingerprint:=md5(v_sources::text);
  if v_state.fingerprint is distinct from v_fingerprint then
    update private.review_summary_state set revision=revision+1,fingerprint=v_fingerprint,visible_summary_id=null
      where profile_id=p_profile_id returning * into v_state;
    insert into private.review_refresh_outbox(profile_id) values(p_profile_id)
      on conflict(profile_id) do update set requested_at=clock_timestamp();
  end if;
  return jsonb_build_object('profileId',p_profile_id,'sourceRevision',v_state.revision::text,
    'reviews',v_sources,'eligibleCount',jsonb_array_length(v_sources));
end; $$;

create function private.register_review_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Future records acquire a distinct policy basis, never inferred from released.
  insert into private.review_publication(review_id,is_public,publication_source)
    values(new.id,false,'policy');
  return new;
end; $$;
create trigger appointment_reviews_publication_candidate after insert on public.appointment_reviews
for each row execute function private.register_review_publication();

create or replace function public.set_review_publication(p_review_id uuid,p_is_public boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_appointment_id uuid;
begin
  if p_is_public is null then raise exception 'invalid_publication' using errcode='22023'; end if;
  select appointment_id into v_appointment_id from public.appointment_reviews where id=p_review_id;
  if not found then raise exception 'review_unavailable' using errcode='P0002'; end if;
  perform 1 from public.appointments where id=v_appointment_id for update;
  if p_is_public and not private.review_release_ready(v_appointment_id) then
    raise exception 'review_release_not_ready' using errcode='40001';
  end if;
  insert into private.review_publication(review_id,is_public,publication_source) values(p_review_id,p_is_public,'override')
    on conflict(review_id) do update set is_public=excluded.is_public,publication_source='override';
end; $$;

create function public.process_review_automation(p_limit integer,p_model_version text,p_prompt_version text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid; v_profile uuid; v_snapshot jsonb; v_published integer:=0; v_processed integer:=0;
  v_enqueued integer:=0; v_rows integer; v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 1000 or p_model_version is null
    or p_model_version !~ '^[A-Za-z0-9_.-]{1,64}$' or p_prompt_version is null
    or p_prompt_version !~ '^[A-Za-z0-9_.-]{1,64}$' then
    raise exception 'invalid_automation_input' using errcode='22023';
  end if;
  -- Appointment -> projection -> outbox is the same lock order as submission.
  for v_id in select ap.id from public.appointments ap
    where private.review_release_ready(ap.id) and exists(select 1 from public.appointment_reviews r
      join private.review_publication p on p.review_id=r.id
      where r.appointment_id=ap.id and p.publication_source='policy' and not p.is_public)
    order by ap.id for update of ap skip locked limit p_limit
  loop
    update private.review_publication p set is_public=true from public.appointment_reviews r
      where r.id=p.review_id and r.appointment_id=v_id and p.publication_source='policy' and not p.is_public
        and private.review_release_ready(v_id);
    get diagnostics v_rows=row_count; v_published:=v_published+v_rows;
  end loop;
  -- Lock projection FIRST. Locking outbox first would deadlock source writers.
  for v_profile in select s.profile_id from private.review_summary_state s
    join private.review_refresh_outbox o on o.profile_id=s.profile_id
    order by s.profile_id for update of s skip locked limit p_limit
  loop
    v_snapshot:=private.refresh_review_summary_state(v_profile);
    if (v_snapshot->>'eligibleCount')::integer>=3 then
      v_result:=public.enqueue_job('review_summary',
        'review_summary:'||v_profile::text||':'||(v_snapshot->>'sourceRevision')||':'||p_model_version||':'||p_prompt_version,
        jsonb_build_object('profileId',v_profile,'sourceRevision',v_snapshot->>'sourceRevision',
          'modelVersion',p_model_version,'promptVersion',p_prompt_version),clock_timestamp());
      if not (v_result->>'deduplicated')::boolean then v_enqueued:=v_enqueued+1; end if;
    end if;
    delete from private.review_refresh_outbox where profile_id=v_profile;
    v_processed:=v_processed+1;
  end loop;
  return jsonb_build_object('publishedCount',v_published,'processedCount',v_processed,'enqueuedCount',v_enqueued);
end; $$;

create function public.submit_appointment_review(p_appointment_id uuid,p_rating integer,p_comment text,
  p_experience text,p_praises text[])
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_ap public.appointments; v_existing public.appointment_reviews;
  v_comment text:=nullif(btrim(coalesce(p_comment,'')),''); v_praises text[];
begin
  if v_uid is null then raise exception 'login_required' using errcode='28000'; end if;
  select * into v_ap from public.appointments where id=p_appointment_id for update;
  if v_ap.id is null or private.appointment_role(p_appointment_id) is null then
    raise exception 'appointment_unavailable' using errcode='PT404';
  end if;
  if p_rating is null or p_rating not between 1 and 5 or p_experience is null
    or p_experience not in ('positive','neutral','negative') or length(v_comment)>300
    or p_praises is null or cardinality(p_praises)>3
    or (p_experience<>'positive' and cardinality(p_praises)>0)
    or exists(select 1 from unnest(p_praises) p where p is null or not exists(select 1 from private.review_praise_catalog c where c.code=p))
    or cardinality(p_praises)<>(select count(distinct p) from unnest(p_praises) p) then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  select coalesce(array_agg(p order by p),'{}') into v_praises from unnest(p_praises) p;
  select * into v_existing from public.appointment_reviews where appointment_id=p_appointment_id and reviewer_id=v_uid;
  if v_existing.id is not null then
    if v_existing.rating=p_rating and v_existing.comment is not distinct from v_comment
      and v_existing.experience=p_experience and v_existing.praises=v_praises then
      return jsonb_build_object('reviewId',v_existing.id,'submittedAt',v_existing.submitted_at,'deduplicated',true);
    end if;
    raise exception 'already_submitted' using errcode='23505';
  end if;
  if not coalesce(public.review_submission_open(v_ap.completed_at,v_ap.review_deadline_at,v_ap.status,clock_timestamp()),false)
    or exists(select 1 from public.appointment_disputes d where d.appointment_id=v_ap.id and (d.status='open' or d.resolution='no_show')) then
    raise exception 'review_unavailable' using errcode='22023';
  end if;
  if v_ap.completion_method='manual' and (select count(*) from public.appointment_completion_confirmations c
    join public.posts p on p.id=v_ap.post_id join public.join_requests r on r.id=v_ap.join_request_id
    where c.appointment_id=v_ap.id and c.user_id in (p.author_id,r.requester_id))<>2 then
    raise exception 'completion_required' using errcode='42501';
  end if;
  insert into public.appointment_reviews(appointment_id,reviewer_id,rating,comment,experience,praises)
    values(p_appointment_id,v_uid,p_rating,v_comment,p_experience,v_praises) returning * into v_existing;
  return jsonb_build_object('reviewId',v_existing.id,'submittedAt',v_existing.submitted_at,'deduplicated',false);
end; $$;
create or replace function public.get_appointment_review_state(p_appointment_id uuid)
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
  v_released := private.review_release_ready(p_appointment_id);
  v_disputed := v_disputed or exists(select 1 from public.appointment_disputes d where d.appointment_id=p_appointment_id and (d.status='open' or d.resolution='no_show'));
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
    (not v_disputed and v_own.id is null
      and (v_appointment.completion_method='automatic' or (select count(*) from public.appointment_completion_confirmations c
        join public.posts p on p.id=v_appointment.post_id join public.join_requests r on r.id=v_appointment.join_request_id
        where c.appointment_id=v_appointment.id and c.user_id in(p.author_id,r.requester_id))=2)
      and public.review_submission_open(
      v_appointment.completed_at, v_appointment.review_deadline_at, v_appointment.status, now())),
    case when v_own.id is null then null else jsonb_build_object(
      'experience',v_own.experience,'praises',v_own.praises,'rating', v_own.rating, 'comment', v_own.comment, 'submitted_at', v_own.submitted_at) end,
    v_peer.id is not null,
    v_released,
    v_release_reason,
    case when v_released and v_peer.id is not null then jsonb_build_object(
      'experience',v_peer.experience,'praises',v_peer.praises,'rating', v_peer.rating, 'comment', v_peer.comment, 'submitted_at', v_peer.submitted_at) end,
    now();
end;
$$;


-- Old input cannot carry the now-required experience; keep history but disable bypass.
revoke all on function public.submit_appointment_review(uuid,integer,text) from public,anon,authenticated,service_role;

create function public.get_public_profile_reviews(p_profile_id uuid,p_limit integer,p_before uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_reviews jsonb; v_praises jsonb; v_next uuid;
begin
  if auth.uid() is null then raise exception 'login_required' using errcode='28000'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_limit' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id) then raise exception 'profile_unavailable' using errcode='P0002'; end if;
  with eligible as (
    select rv.* from public.appointment_reviews rv join private.review_publication pub on pub.review_id=rv.id and pub.is_public
    join public.appointments ap on ap.id=rv.appointment_id join public.posts p on p.id=ap.post_id
    join public.join_requests r on r.id=ap.join_request_id
    where rv.reviewer_id in(p.author_id,r.requester_id) and p.author_id<>r.requester_id
      and (case when rv.reviewer_id=p.author_id then r.requester_id else p.author_id end)=p_profile_id
      and private.review_release_ready(ap.id)
  ), page as(select * from eligible where p_before is null or id<p_before order by id desc limit p_limit+1),
  visible as(select * from page order by id desc limit p_limit)
  select coalesce((select jsonb_agg(jsonb_build_object('reviewId',id,'rating',rating,'experience',experience,
      'text',comment,'praises',praises,'submittedAt',submitted_at) order by id desc) from visible),'[]'::jsonb),
    case when (select count(*) from page)>p_limit then (select id from visible order by id limit 1) else null::uuid end
  into v_reviews,v_next;
  -- UUID cursor is opaque, deterministic pagination; not a date-order promise.
  select coalesce(jsonb_agg(jsonb_build_object('code',code,'label',label,'count',n) order by n desc,code),'[]'::jsonb)
    into v_praises from (
    select c.code,c.label,count(*) n from public.appointment_reviews rv
    join private.review_publication pub on pub.review_id=rv.id and pub.is_public
    join public.appointments ap on ap.id=rv.appointment_id join public.posts p on p.id=ap.post_id
    join public.join_requests r on r.id=ap.join_request_id cross join lateral unnest(rv.praises) x(code)
    join private.review_praise_catalog c on c.code=x.code
    where rv.experience='positive' and rv.reviewer_id in(p.author_id,r.requester_id) and p.author_id<>r.requester_id
      and (case when rv.reviewer_id=p.author_id then r.requester_id else p.author_id end)=p_profile_id
      and private.review_release_ready(ap.id)
    group by c.code,c.label order by n desc,c.code limit 5) t;
  return jsonb_build_object('reviews',v_reviews,'praisesTop5',v_praises,'nextCursor',v_next);
end; $$;
revoke all on function private.register_review_publication() from public,anon,authenticated,service_role;
revoke all on function public.process_review_automation(integer,text,text),
 public.submit_appointment_review(uuid,integer,text,text,text[]),public.get_public_profile_reviews(uuid,integer,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.process_review_automation(integer,text,text) to service_role;
grant execute on function public.submit_appointment_review(uuid,integer,text,text,text[]),
 public.get_public_profile_reviews(uuid,integer,uuid) to authenticated;
commit;
