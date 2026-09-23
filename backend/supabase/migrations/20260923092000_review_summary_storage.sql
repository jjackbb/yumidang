-- Private summary projection. Existing participant-to-participant release never
-- implies permission to use a review on a public profile. No publication backfill.
create table private.review_publication (
  review_id uuid primary key references public.appointment_reviews(id) on delete cascade,
  is_public boolean not null default false
);
create table private.review_summary_state (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  fingerprint text,
  visible_summary_id uuid
);
create table private.review_summaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_revision bigint not null,
  evidence_review_ids uuid[] not null,
  summary_text text not null check (char_length(btrim(summary_text)) between 1 and 4000),
  model_version text not null check (model_version ~ '^[A-Za-z0-9_.-]{1,64}$'),
  prompt_version text not null check (prompt_version ~ '^[A-Za-z0-9_.-]{1,64}$'),
  published_at timestamptz not null default clock_timestamp(),
  unique (profile_id, source_revision, model_version, prompt_version),
  check (cardinality(evidence_review_ids) >= 3)
);
alter table private.review_publication enable row level security;
alter table private.review_summary_state enable row level security;
alter table private.review_summaries enable row level security;
revoke all on private.review_publication, private.review_summary_state, private.review_summaries from public, anon, authenticated, service_role;

-- Shared predicate, independent of auth.uid and never exposed as an API.
create function private.review_release_ready(p_appointment_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  select coalesce((select ap.status = 'completed'
    and ap.completed_at is not null
    and (ap.completion_method = 'automatic' or (ap.completion_method = 'manual'
      and exists (select 1 from public.appointment_completion_confirmations c
        join public.posts p on p.id = ap.post_id where c.appointment_id = ap.id and c.user_id = p.author_id)
      and exists (select 1 from public.appointment_completion_confirmations c
        join public.join_requests jr on jr.id = ap.join_request_id
        where c.appointment_id = ap.id and c.user_id = jr.requester_id)))
    and clock_timestamp() >= ap.completion_notified_at + interval '24 hours'
    and clock_timestamp() >= ap.dispute_deadline_at
    and not exists (select 1 from public.appointment_disputes d
      where d.appointment_id = ap.id and (d.status = 'open' or d.resolution = 'no_show'))
    and ((exists (select 1 from public.appointment_reviews r join public.posts p on p.id = ap.post_id
        where r.appointment_id = ap.id and r.reviewer_id = p.author_id)
      and exists (select 1 from public.appointment_reviews r join public.join_requests jr on jr.id = ap.join_request_id
        where r.appointment_id = ap.id and r.reviewer_id = jr.requester_id))
      or clock_timestamp() >= ap.review_deadline_at)
    from public.appointments ap where ap.id = p_appointment_id), false);
$$;

create function private.review_summary_sources(p_profile_id uuid)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('reviewId', rv.id, 'text', btrim(rv.comment)) order by rv.id), '[]'::jsonb)
  from public.appointment_reviews rv
  join private.review_publication pub on pub.review_id = rv.id and pub.is_public
  join public.appointments ap on ap.id = rv.appointment_id
  join public.posts p on p.id = ap.post_id
  join public.join_requests jr on jr.id = ap.join_request_id
  where rv.reviewer_id in (p.author_id, jr.requester_id)
    and p.author_id <> jr.requester_id
    and (case when rv.reviewer_id = p.author_id then jr.requester_id else p.author_id end) = p_profile_id
    and nullif(btrim(rv.comment), '') is not null
    and private.review_release_ready(ap.id);
$$;

-- Every projection operation holds this row lock until transaction end. Refresh
-- also detects elapsed-time changes; revision is an opaque decimal string on wire.
create function private.refresh_review_summary_state(p_profile_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_state private.review_summary_state; v_sources jsonb; v_fingerprint text;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'profile_unavailable' using errcode = 'P0002';
  end if;
  insert into private.review_summary_state(profile_id) values (p_profile_id) on conflict do nothing;
  select * into v_state from private.review_summary_state where profile_id = p_profile_id for update;
  v_sources := private.review_summary_sources(p_profile_id);
  v_fingerprint := md5(v_sources::text);
  if v_state.fingerprint is distinct from v_fingerprint then
    update private.review_summary_state set revision = revision + 1,
      fingerprint = v_fingerprint, visible_summary_id = null where profile_id = p_profile_id
      returning * into v_state;
  end if;
  return jsonb_build_object('profileId', p_profile_id, 'sourceRevision', v_state.revision::text,
    'reviews', v_sources, 'eligibleCount', jsonb_array_length(v_sources));
end;
$$;

-- BEFORE source mutations take the projection lock before changing their rows.
-- A publish observes the committed source or is invalidated before the source commits.
-- Both participant rows use UUID order to keep multi-profile locking consistent.
create function private.invalidate_appointment_review_summaries(p_appointment_ids uuid[])
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_profile_id uuid;
begin
  for v_profile_id in
    select distinct ids.id from public.appointments ap
    join public.posts p on p.id = ap.post_id
    join public.join_requests jr on jr.id = ap.join_request_id
    cross join lateral (values (p.author_id), (jr.requester_id)) ids(id)
    where ap.id = any(p_appointment_ids) order by ids.id
  loop
    insert into private.review_summary_state(profile_id) values (v_profile_id) on conflict do nothing;
    update private.review_summary_state set revision = revision + 1, fingerprint = null,
      visible_summary_id = null where profile_id = v_profile_id;
  end loop;
end;
$$;

create function private.review_source_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[] := '{}'; v_review_id uuid;
begin
  if tg_table_name = 'review_publication' then
    if tg_op <> 'DELETE' then v_review_id := new.review_id; else v_review_id := old.review_id; end if;
    select array[rv.appointment_id] into v_ids from public.appointment_reviews rv where rv.id = v_review_id;
  elsif tg_table_name = 'appointments' then
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.id); end if;
  else
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.appointment_id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.appointment_id); end if;
  end if;
  perform private.invalidate_appointment_review_summaries(v_ids);
  return coalesce(new, old);
end;
$$;
create trigger review_summary_review_change before insert or update or delete on public.appointment_reviews
for each row execute function private.review_source_changed();
create trigger review_summary_confirmation_change before insert or update or delete on public.appointment_completion_confirmations
for each row execute function private.review_source_changed();
create trigger review_summary_publication_change before insert or update or delete on private.review_publication
for each row execute function private.review_source_changed();
create trigger review_summary_appointment_change before update or delete on public.appointments
for each row execute function private.review_source_changed();
create trigger review_summary_dispute_change before insert or update or delete on public.appointment_disputes
for each row execute function private.review_source_changed();

create function public.set_review_publication(p_review_id uuid, p_is_public boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_appointment_id uuid;
begin
  if p_is_public is null then raise exception 'invalid_publication' using errcode = '22023'; end if;
  -- Follow existing review write lock order: appointment, then projection state.
  select rv.appointment_id into v_appointment_id from public.appointment_reviews rv where rv.id = p_review_id;
  if not found then raise exception 'review_unavailable' using errcode = 'P0002'; end if;
  perform 1 from public.appointments where id = v_appointment_id for update;
  if p_is_public and not private.review_release_ready(v_appointment_id) then
    raise exception 'review_release_not_ready' using errcode = '40001';
  end if;
  insert into private.review_publication(review_id, is_public) values (p_review_id, p_is_public)
    on conflict (review_id) do update set is_public = excluded.is_public;
end;
$$;
create function public.load_public_review_snapshot(p_profile_id uuid)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select private.refresh_review_summary_state(p_profile_id);
$$;

create function public.publish_review_summary(p_profile_id uuid, p_source_revision text,
  p_evidence_review_ids uuid[], p_summary text, p_model_version text, p_prompt_version text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_snapshot jsonb; v_ids uuid[]; v_summary private.review_summaries;
begin
  if p_source_revision is null or p_source_revision !~ '^(0|[1-9][0-9]{0,18})$'
    or p_summary is null or char_length(btrim(p_summary)) not between 1 and 4000
    or p_model_version is null or p_model_version !~ '^[A-Za-z0-9_.-]{1,64}$'
    or p_prompt_version is null or p_prompt_version !~ '^[A-Za-z0-9_.-]{1,64}$' then
    raise exception 'invalid_summary_input' using errcode = '22023';
  end if;
  v_snapshot := private.refresh_review_summary_state(p_profile_id);
  select array_agg((x->>'reviewId')::uuid order by (x->>'reviewId')::uuid) into v_ids
    from jsonb_array_elements(v_snapshot->'reviews') x;
  if v_snapshot->>'sourceRevision' <> p_source_revision
    or coalesce(cardinality(v_ids), 0) < 3
    or p_evidence_review_ids is null
    or cardinality(p_evidence_review_ids) <> cardinality(v_ids)
    or not (p_evidence_review_ids @> v_ids and p_evidence_review_ids <@ v_ids) then
    raise exception 'summary_source_conflict' using errcode = '40001';
  end if;
  insert into private.review_summaries(profile_id, source_revision, evidence_review_ids,
    summary_text, model_version, prompt_version)
  values (p_profile_id, (v_snapshot->>'sourceRevision')::bigint, v_ids, btrim(p_summary), p_model_version, p_prompt_version)
  on conflict (profile_id, source_revision, model_version, prompt_version) do nothing;
  select * into strict v_summary from private.review_summaries where profile_id = p_profile_id
    and source_revision = (v_snapshot->>'sourceRevision')::bigint
    and model_version = p_model_version and prompt_version = p_prompt_version;
  update private.review_summary_state set visible_summary_id = v_summary.id where profile_id = p_profile_id;
  return jsonb_build_object('summaryId', v_summary.id, 'sourceRevision', v_summary.source_revision::text,
    'sourceCount', cardinality(v_ids), 'publishedAt', v_summary.published_at);
end;
$$;

create function public.get_visible_review_summary(p_profile_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_snapshot jsonb; v_summary private.review_summaries;
begin
  if auth.uid() is null then raise exception 'login_required' using errcode = '28000'; end if;
  v_snapshot := private.refresh_review_summary_state(p_profile_id);
  select s.* into v_summary from private.review_summaries s
    join private.review_summary_state st on st.visible_summary_id = s.id
    where st.profile_id = p_profile_id and s.source_revision = st.revision;
  if v_summary.id is null or (v_snapshot->>'eligibleCount')::integer < 3 then
    return jsonb_build_object('summary', null);
  end if;
  return jsonb_build_object('summary', jsonb_build_object('summaryId', v_summary.id,
    'text', v_summary.summary_text, 'sourceCount', cardinality(v_summary.evidence_review_ids), 'updatedAt', v_summary.published_at));
end;
$$;

revoke all on function private.review_release_ready(uuid), private.review_summary_sources(uuid),
  private.refresh_review_summary_state(uuid), private.invalidate_appointment_review_summaries(uuid[]),
  private.review_source_changed() from public, anon, authenticated, service_role;
revoke all on function public.set_review_publication(uuid, boolean), public.load_public_review_snapshot(uuid),
  public.publish_review_summary(uuid, text, uuid[], text, text, text), public.get_visible_review_summary(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_review_publication(uuid, boolean), public.load_public_review_snapshot(uuid),
  public.publish_review_summary(uuid, text, uuid[], text, text, text) to service_role;
grant execute on function public.get_visible_review_summary(uuid) to authenticated;
