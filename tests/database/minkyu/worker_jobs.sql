-- 실행: psql -X -v ON_ERROR_STOP=1 -f tests/database/minkyu/worker_jobs.sql <격리 로컬 DB>
-- postgres/소유자로 실행한다. 모든 데이터 변경은 rollback한다. pgTAP 불필요.
begin;
truncate private.worker_jobs;

do $$
declare
  v_role text;
  v_function text;
begin
  if not (select relrowsecurity from pg_class where oid = 'private.worker_jobs'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
  foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
    if has_table_privilege(v_role, 'private.worker_jobs', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'direct table access for %', v_role;
    end if;
  end loop;
  foreach v_function in array array[
    'public.enqueue_job(text,text,jsonb,timestamptz)', 'public.claim_job(uuid,integer)',
    'public.complete_job(uuid,uuid)', 'public.retry_job(uuid,uuid,timestamptz,text)'] loop
    if not has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'service role missing execute for %', v_function;
    end if;
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception 'public role has execute for %', v_function;
      end if;
    end loop;
  end loop;
end;
$$;

set local role anon;
do $$ begin
  begin
    perform public.claim_job('11111111-1111-4111-8111-111111111111', 60);
    raise exception 'anon RPC must fail';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from private.worker_jobs;
    raise exception 'anon table read must fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.enqueue_job('review_summary', 'denied', '{}'::jsonb, clock_timestamp());
    raise exception 'member RPC must fail';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from private.worker_jobs;
    raise exception 'member table read must fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Privileged fixture edits only simulate passage of time; every production RPC uses service_role.
do $$
declare
  v_payload jsonb := '{"profileId":"22222222-2222-4222-8222-222222222222","sourceRevision":"7","modelVersion":"test-model-v1","promptVersion":"test-prompt-v1"}';
  v_result jsonb;
  v_job uuid;
  v_token uuid;
  v_new_token uuid;
  v_worker uuid := '11111111-1111-4111-8111-111111111111';
  v_rejected jsonb;
begin
  execute 'set local role service_role';
  begin
    perform count(*) from private.worker_jobs;
    raise exception 'service_role direct table read must fail';
  exception when insufficient_privilege then null; end;
  if public.claim_job(v_worker, 60) <> '{"job":null}'::jsonb then raise exception 'empty claim'; end if;
  begin
    perform public.claim_job(v_worker, 0);
    raise exception 'zero lease accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.claim_job(v_worker, 86401);
    raise exception 'unbounded lease accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.enqueue_job('unknown_kind', 'invalid-kind', v_payload, clock_timestamp());
    raise exception 'unknown kind accepted';
  exception when invalid_parameter_value then null; end;
  foreach v_rejected in array array[
    v_payload || '{"text":"PRIVATE REVIEW"}'::jsonb,
    v_payload || '{"sourceRevision":7}'::jsonb,
    v_payload || '{"profileId":null}'::jsonb,
    v_payload - 'promptVersion', 'null'::jsonb, '[]'::jsonb
  ] loop
    begin
      perform public.enqueue_job('review_summary', 'invalid-payload', v_rejected, clock_timestamp());
      raise exception 'invalid payload accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  v_result := public.enqueue_job('review_summary', 'test:7:model:prompt', v_payload, clock_timestamp());
  v_job := (v_result->>'jobId')::uuid;
  if v_result->>'status' <> 'queued' or (v_result->>'deduplicated')::boolean then raise exception 'enqueue result'; end if;
  v_result := public.enqueue_job('review_summary', 'test:7:model:prompt', v_payload, clock_timestamp() + interval '1 day');
  if not (v_result->>'deduplicated')::boolean or (v_result->>'jobId')::uuid <> v_job then raise exception 'dedupe'; end if;
  begin
    perform public.enqueue_job('review_summary', 'test:7:model:prompt', v_payload || '{"sourceRevision":"8"}', clock_timestamp());
    raise exception 'different payload accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'state_conflict' then raise; end if;
  end;
  v_result := public.claim_job(v_worker, 60)->'job';
  v_token := (v_result->>'leaseToken')::uuid;
  if (v_result->>'jobId')::uuid <> v_job or (v_result->>'attempt')::int <> 1
    or v_result->'payload' <> v_payload or (v_result->>'leaseExpiresAt')::timestamptz <= clock_timestamp() then
    raise exception 'first claim';
  end if;
  if public.claim_job(v_worker, 60) <> '{"job":null}'::jsonb then raise exception 'active lease stolen'; end if;
  begin
    perform public.complete_job(v_job, pg_catalog.gen_random_uuid());
    raise exception 'wrong token accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;

  execute 'reset role';
  update private.worker_jobs set lease_expires_at = clock_timestamp() - interval '1 second' where id = v_job;
  execute 'set local role service_role';
  begin
    perform public.complete_job(v_job, v_token);
    raise exception 'expired completion accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;
  begin
    perform public.retry_job(v_job, v_token, clock_timestamp() + interval '1 day', 'TIMEOUT');
    raise exception 'expired retry accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;
  v_result := public.claim_job(v_worker, 60)->'job';
  v_new_token := (v_result->>'leaseToken')::uuid;
  if (v_result->>'jobId')::uuid <> v_job or (v_result->>'attempt')::int <> 2
    or v_new_token = v_token then raise exception 'reclaim did not replace lease'; end if;
  begin
    perform public.retry_job(v_job, v_token, clock_timestamp() + interval '1 day', 'TIMEOUT');
    raise exception 'former worker accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;
  begin
    perform public.retry_job(v_job, v_new_token, clock_timestamp() + interval '1 day', 'PRIVATE SQL ERROR');
    raise exception 'raw error accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.retry_job(v_job, v_new_token, clock_timestamp() - interval '1 day', 'TIMEOUT');
    raise exception 'past retry accepted';
  exception when invalid_parameter_value then null; end;
  v_result := public.retry_job(v_job, v_new_token, clock_timestamp() + interval '1 day', 'TIMEOUT');
  if v_result->>'status' <> 'retry_wait' then raise exception 'retry result'; end if;
  if public.claim_job(v_worker, 60) <> '{"job":null}'::jsonb then raise exception 'future retry claimed early'; end if;
  begin
    perform public.complete_job(v_job, v_new_token);
    raise exception 'discarded retry lease accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;
  execute 'reset role';
  update private.worker_jobs set available_at = clock_timestamp() - interval '1 second' where id = v_job;
  execute 'set local role service_role';
  v_result := public.claim_job(v_worker, 60)->'job';
  v_token := (v_result->>'leaseToken')::uuid;
  if (v_result->>'attempt')::int <> 3 then raise exception 'retry attempt'; end if;
  v_result := public.complete_job(v_job, v_token);
  if v_result->>'status' <> 'succeeded' then raise exception 'complete result'; end if;
  begin
    perform public.complete_job(v_job, v_token);
    raise exception 'repeated completion accepted';
  exception when sqlstate 'P0001' then if sqlerrm <> 'state_conflict' then raise; end if; end;
  v_result := public.enqueue_job('review_summary', 'test:7:model:prompt', v_payload, clock_timestamp());
  if v_result->>'status' <> 'succeeded' or not (v_result->>'deduplicated')::boolean then raise exception 'terminal dedupe'; end if;
  if public.claim_job(v_worker, 60) <> '{"job":null}'::jsonb then raise exception 'terminal reclaimed'; end if;
  perform public.enqueue_job('review_summary', 'future', v_payload, clock_timestamp() + interval '1 day');
  if public.claim_job(v_worker, 60) <> '{"job":null}'::jsonb then raise exception 'future queued claimed'; end if;
  execute 'reset role';
end;
$$;
rollback;
