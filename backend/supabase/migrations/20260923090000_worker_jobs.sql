-- 민규: 내부 작업 큐 v1. 업무 정책/재시도 간격/운영 lease 기본값은 결정하지 않는다.
begin;

create schema if not exists private;
create table private.worker_jobs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  kind text not null check (kind = 'review_summary'),
  dedupe_key text not null check (length(dedupe_key) between 1 and 512 and dedupe_key ~ '^[A-Za-z0-9_.:-]+$'),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object'
    and payload ?& array['profileId', 'sourceRevision', 'modelVersion', 'promptVersion']
    and payload - array['profileId', 'sourceRevision', 'modelVersion', 'promptVersion'] = '{}'::jsonb
    and jsonb_typeof(payload->'profileId') = 'string'
    and (payload->>'profileId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and jsonb_typeof(payload->'sourceRevision') = 'string'
    and (payload->>'sourceRevision') ~ '^(0|[1-9][0-9]{0,18})$'
    and jsonb_typeof(payload->'modelVersion') = 'string'
    and (payload->>'modelVersion') ~ '^[A-Za-z0-9_.-]{1,64}$'
    and jsonb_typeof(payload->'promptVersion') = 'string'
    and (payload->>'promptVersion') ~ '^[A-Za-z0-9_.-]{1,64}$', false)),
  status text not null default 'queued' check (status in ('queued', 'running', 'retry_wait', 'succeeded')),
  available_at timestamptz not null check (isfinite(available_at)),
  attempt bigint not null default 0 check (attempt >= 0),
  worker_id uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code in ('UPSTREAM_UNAVAILABLE', 'RATE_LIMITED', 'TIMEOUT', 'STATE_CHANGED', 'INTERNAL_ERROR')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique (kind, dedupe_key),
  check ((status = 'running' and worker_id is not null and lease_token is not null and lease_expires_at is not null)
    or (status <> 'running' and worker_id is null and lease_token is null and lease_expires_at is null)),
  check ((status = 'succeeded') = (completed_at is not null))
);
create index worker_jobs_due on private.worker_jobs (available_at, id) where status in ('queued', 'retry_wait');
create index worker_jobs_expired on private.worker_jobs (lease_expires_at, id) where status = 'running';
alter table private.worker_jobs enable row level security;
-- No policies: direct access is denied, including service_role table grants.
revoke all on private.worker_jobs from public, anon, authenticated, service_role;

create function public.enqueue_job(p_kind text, p_dedupe_key text, p_payload jsonb, p_available_at timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_job private.worker_jobs%rowtype;
  v_inserted boolean;
begin
  if p_kind is distinct from 'review_summary' or p_dedupe_key is null
    or length(p_dedupe_key) not between 1 and 512 or p_dedupe_key !~ '^[A-Za-z0-9_.:-]+$'
    or p_available_at is null or not isfinite(p_available_at) then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;
  -- The CHECK validates the complete allowlist without retaining arbitrary payload text.
  begin
    insert into private.worker_jobs(kind, dedupe_key, payload, available_at)
      values (p_kind, p_dedupe_key, p_payload, p_available_at)
      on conflict (kind, dedupe_key) do nothing returning * into v_job;
    v_inserted := found;
  exception when check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'invalid_input';
  end;
  if not v_inserted then
    -- Separate statement sees a concurrently committed unique-key winner at READ COMMITTED.
    select * into v_job from private.worker_jobs
      where kind = p_kind and dedupe_key = p_dedupe_key for update;
    if not found or v_job.payload is distinct from p_payload then
      raise exception using errcode = 'P0001', message = 'state_conflict';
    end if;
  end if;
  return jsonb_build_object('jobId', v_job.id, 'deduplicated', not v_inserted, 'status', v_job.status);
end;
$$;

create function public.claim_job(p_worker_id uuid, p_lease_seconds integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_job private.worker_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  -- 86400 is a technical bound, not an operational timeout recommendation/default.
  if p_worker_id is null or p_lease_seconds is null or p_lease_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;
  select * into v_job from private.worker_jobs
    where (status in ('queued', 'retry_wait') and available_at <= v_now)
       or (status = 'running' and lease_expires_at <= v_now)
    order by case when status = 'running' then lease_expires_at else available_at end, id
    for update skip locked limit 1;
  if not found then return jsonb_build_object('job', null); end if;
  v_now := clock_timestamp();
  update private.worker_jobs set status = 'running', worker_id = p_worker_id,
    lease_token = pg_catalog.gen_random_uuid(), lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
    attempt = attempt + 1, updated_at = v_now
    where id = v_job.id returning * into v_job;
  return jsonb_build_object('job', jsonb_build_object('jobId', v_job.id, 'kind', v_job.kind,
    'payload', v_job.payload, 'leaseToken', v_job.lease_token, 'leaseExpiresAt', v_job.lease_expires_at,
    'attempt', v_job.attempt));
end;
$$;

create function public.complete_job(p_job_id uuid, p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_job private.worker_jobs%rowtype;
  v_now timestamptz;
begin
  select * into v_job from private.worker_jobs where id = p_job_id for update;
  -- Read the actual clock after acquiring the row lock, not transaction-start time.
  v_now := clock_timestamp();
  if not found or v_job.status <> 'running' or p_lease_token is null
    or v_job.lease_token is distinct from p_lease_token or v_job.lease_expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'state_conflict';
  end if;
  update private.worker_jobs set status = 'succeeded', worker_id = null, lease_token = null,
    lease_expires_at = null, completed_at = v_now, updated_at = v_now where id = v_job.id;
  return jsonb_build_object('jobId', v_job.id, 'status', 'succeeded');
end;
$$;

create function public.retry_job(p_job_id uuid, p_lease_token uuid, p_available_at timestamptz, p_error_code text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_job private.worker_jobs%rowtype;
  v_now timestamptz;
begin
  if p_available_at is null or not isfinite(p_available_at) or p_error_code is null
    or p_error_code not in ('UPSTREAM_UNAVAILABLE', 'RATE_LIMITED', 'TIMEOUT', 'STATE_CHANGED', 'INTERNAL_ERROR') then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;
  select * into v_job from private.worker_jobs where id = p_job_id for update;
  v_now := clock_timestamp();
  if not found or v_job.status <> 'running' or p_lease_token is null
    or v_job.lease_token is distinct from p_lease_token or v_job.lease_expires_at <= v_now then
    raise exception using errcode = 'P0001', message = 'state_conflict';
  end if;
  if p_available_at < v_now then
    raise exception using errcode = '22023', message = 'invalid_input';
  end if;
  update private.worker_jobs set status = 'retry_wait', worker_id = null, lease_token = null,
    lease_expires_at = null, available_at = p_available_at, last_error_code = p_error_code,
    updated_at = v_now where id = v_job.id;
  return jsonb_build_object('jobId', v_job.id, 'status', 'retry_wait');
end;
$$;

revoke all on function public.enqueue_job(text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.retry_job(uuid, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.enqueue_job(text, text, jsonb, timestamptz) to service_role;
grant execute on function public.claim_job(uuid, integer) to service_role;
grant execute on function public.complete_job(uuid, uuid) to service_role;
grant execute on function public.retry_job(uuid, uuid, timestamptz, text) to service_role;
commit;
