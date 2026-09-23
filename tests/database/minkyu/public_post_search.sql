-- Run as the local database owner after migrations; every fixture is rolled back.
begin;
insert into auth.users(id) values ('91000000-0000-4000-8000-000000000001');
insert into public.profiles(id, real_name, birth_date, gender)
values ('91000000-0000-4000-8000-000000000001', '검색민규', '1990-01-01', 'male');
insert into public.posts(id, author_id, title, description, category,
  starts_at, ends_at, recruitment_ends_at, public_area, status)
select ('92000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '91000000-0000-4000-8000-000000000001', '검증검색fixture 공고 ' || n,
  '소개전용fixture', case when n = 2 then '식사' else '전시' end,
  now() + interval '3 days', now() + interval '3 days 2 hours',
  case when n = 6 then now() - interval '1 minute' else now() + interval '2 days' end,
  '서울특별시 성동구 성수동',
  case when n = 4 then 'deleted' when n = 5 then 'closed' else 'recruiting' end
from generate_series(1, 6) n;
insert into public.post_private_details(post_id, exact_location)
values ('92000000-0000-4000-8000-000000000003', '이전주소fixture 3층 상세만남fixture 좌석 9');

-- Only the service entry point writes; ordinary users cannot write even their own post.
set local role service_role;
select public.set_post_search_location('92000000-0000-4000-8000-000000000001',
  '등록장소fixture', '서울특별시 성동구 주소전용fixture 123');
select public.set_post_search_location('92000000-0000-4000-8000-000000000002',
  '이전장소fixture', '서울특별시 성동구 주소전용fixture 456');
select public.set_post_search_location('92000000-0000-4000-8000-000000000002',
  '변경장소fixture', '서울특별시 성동구 갱신주소fixture 456');
do $$
begin
  begin
    perform public.set_post_search_location('92000000-0000-4000-8000-000000000004', null, '삭제된공고 주소');
    raise exception 'deleted post write succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.set_post_search_location('92000000-0000-4000-8000-000000000001', null, ' ');
    raise exception 'empty address accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  v_result jsonb;
  v_page2 jsonb;
  v_cursor jsonb;
  v_item jsonb;
  v_query text;
  v_count integer;
begin
  foreach v_query in array array['공고 1', '등록장소fixture', '주소전용fixture'] loop
    v_result := public.search_public_posts(p_query => v_query);
    if jsonb_array_length(v_result->'items') <> 1
       or v_result #>> '{items,0,postId}' <> '92000000-0000-4000-8000-000000000001' then
      raise exception 'title/place/address search failed for %', v_query;
    end if;
    v_item := v_result #> '{items,0}';
    select count(*) into v_count from jsonb_object_keys(v_item);
    if v_count <> 4 or not v_item ?& array['postId', 'title', 'publicArea', 'authorDisplayName']
       or v_item->>'authorDisplayName' <> '동행-92000000000040008000000000000001'
       or v_result::text like '%주소전용fixture%' or v_result::text like '%검색민규%' then
      raise exception 'minimal public card or anonymous alias failed';
    end if;
  end loop;
  foreach v_query in array array['소개전용fixture', '이전주소fixture', '상세만남fixture',
    '성수동', '이전장소fixture', '%', '_', '검색민규'] loop
    v_result := public.search_public_posts(p_query => v_query);
    if v_result <> '{"items":[],"nextCursor":null}'::jsonb then
      raise exception 'forbidden/literal search unexpectedly matched: %', v_query;
    end if;
  end loop;
  if jsonb_array_length(public.search_public_posts(p_query => '갱신주소fixture')->'items') <> 1 then
    raise exception 'service upsert did not replace registered input';
  end if;
  v_result := public.search_public_posts(p_query => '검증검색fixture', p_limit => 2);
  if jsonb_array_length(v_result->'items') <> 2
     or v_result #>> '{items,0,postId}' <> '92000000-0000-4000-8000-000000000001'
     or v_result #>> '{items,1,postId}' <> '92000000-0000-4000-8000-000000000002' then
    raise exception 'stable tied-date ordering failed';
  end if;
  v_cursor := v_result->'nextCursor';
  v_page2 := public.search_public_posts(p_query => '검증검색fixture',
    p_after_starts_at => (v_cursor->>'startsAt')::timestamptz,
    p_after_id => (v_cursor->>'postId')::uuid, p_limit => 2);
  if jsonb_array_length(v_page2->'items') <> 1
     or v_page2 #>> '{items,0,postId}' <> '92000000-0000-4000-8000-000000000003'
     or v_page2->'nextCursor' <> 'null'::jsonb then
    raise exception 'pagination or closed/deleted/deadline filtering failed';
  end if;
  if public.search_public_posts(p_query => '검증검색fixture', p_limit => 2) <> v_result then
    raise exception 'anonymous alias/pagination was not stable';
  end if;
  v_result := public.search_public_posts(p_query => '검증검색fixture', p_category => '식사',
    p_date => ((now() + interval '3 days') at time zone 'Asia/Seoul')::date,
    p_area => '서울특별시 성동구');
  if jsonb_array_length(v_result->'items') <> 1 then raise exception 'combined filters failed'; end if;
  if jsonb_array_length(public.search_public_posts(p_query => '검증검색fixture',
       p_date => ((now() + interval '7 days') at time zone 'Asia/Seoul')::date)->'items') <> 0 then
    raise exception 'date filter ignored';
  end if;
  if jsonb_array_length(public.search_public_posts(p_query => '검증검색fixture', p_area => '%')->'items') <> 0 then
    raise exception 'area treated as wildcard';
  end if;
  foreach v_count in array array[0, 51, -1] loop
    begin
      perform public.search_public_posts(p_limit => v_count);
      raise exception 'invalid page limit accepted';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.search_public_posts(p_limit => null);
    raise exception 'null page limit accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_public_posts(p_after_id => '92000000-0000-4000-8000-000000000001');
    raise exception 'partial cursor accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_public_posts(p_after_starts_at => 'infinity',
      p_after_id => '92000000-0000-4000-8000-000000000001');
    raise exception 'infinite cursor accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_public_posts(p_query => repeat('x', 301));
    raise exception 'oversize query accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_public_posts(p_category => 'unknown');
    raise exception 'invalid category accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_post_search_location('92000000-0000-4000-8000-000000000001', null, '임의 주소');
    raise exception 'anonymous write succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.post_search_locations;
    raise exception 'anonymous raw address read succeeded';
  exception when insufficient_privilege then null;
  end;
  -- Legacy endpoint does not join the new private data; compatibility is preserved.
  if exists (select 1 from public.list_posts('주소전용fixture')) then
    raise exception 'new address leaked into legacy public list';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000001"}', true);
do $$
declare v_result jsonb;
begin
  v_result := public.search_public_posts(p_query => '주소전용fixture');
  if v_result #>> '{items,0,authorDisplayName}' <> '검**규'
     or v_result::text like '%주소전용fixture%' or v_result::text like '%검색민규%' then
    raise exception 'member masking failed';
  end if;
  begin
    perform public.set_post_search_location('92000000-0000-4000-8000-000000000001', null, '임의 주소');
    raise exception 'member direct write succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.post_search_locations;
    raise exception 'member raw address read succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from private.post_search_locations
    where post_id = '92000000-0000-4000-8000-000000000003') then
    raise exception 'legacy exact_location was automatically migrated';
  end if;
  if (select count(*) from public.post_private_details
    where post_id = '92000000-0000-4000-8000-000000000003'
      and exact_location = '이전주소fixture 3층 상세만남fixture 좌석 9') <> 1 then
    raise exception 'legacy private detail was changed';
  end if;
end;
$$;
rollback;
