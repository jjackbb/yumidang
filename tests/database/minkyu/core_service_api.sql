-- Dedicated local database only; all rows and permission probes roll back.
begin;
-- Fixtures use metadata only. Allow the same metadata deletion mode used by the
-- Storage service so the application trigger (not storage.protect_delete) is tested.
set local storage.allow_delete_query = 'true';
insert into auth.users(id) values
('61000000-0000-4000-8000-000000000001'),('61000000-0000-4000-8000-000000000002'),('61000000-0000-4000-8000-000000000003');
insert into public.profiles(id,real_name,birth_date,gender) values
('61000000-0000-4000-8000-000000000001','작성민규','1990-01-01','female'),
('61000000-0000-4000-8000-000000000002','신청종현','1990-01-01','female'),
('61000000-0000-4000-8000-000000000003','외부회원','1990-01-01','female');
do $$
declare
  v_author uuid:='61000000-0000-4000-8000-000000000001';
  v_peer uuid:='61000000-0000-4000-8000-000000000002';
  v_other uuid:='61000000-0000-4000-8000-000000000003';
  v_post uuid:='62000000-0000-4000-8000-000000000001';
  v_post2 uuid:='62000000-0000-4000-8000-000000000002';
  v_request uuid; v_request2 uuid; v_input jsonb; v_result jsonb; v_consent jsonb; v_first jsonb;
begin
  v_input:=jsonb_build_object('title','핵심동행 검사','description','업무 연결 검증','category','산책',
    'startsAt',clock_timestamp()+interval '3 days','endsAt',clock_timestamp()+interval '3 days 2 hours',
    'recruitmentEndsAt',clock_timestamp()+interval '2 days','publicArea','서울특별시 강남구 역삼동',
    'registeredPlaceName','등록장소검증','registeredAddress','비공개주소검증 123','meetingDetail','비공개상세 만남지점',
    'preferenceNote',null,'tags','[]'::jsonb,'costType','free','amount',0);
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  v_result:=public.create_service_post(v_post,v_input);
  assert v_result->>'alreadyCreated'='false';
  assert public.create_service_post(v_post,v_input)->>'alreadyCreated'='true';
  begin
    perform public.create_service_post(v_post,v_input||'{"title":"바뀐내용"}'::jsonb);
    raise exception 'duplicate payload change accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.create_service_post(gen_random_uuid(),v_input||'{"costType":"paid_request","amount":10000}'::jsonb);
    raise exception 'unverified paid creation accepted';
  exception when sqlstate 'PT503' then null; end;
  assert public.get_service_post(v_post)#>>'{privateDetails,registeredAddress}'='비공개주소검증 123';
  perform set_config('request.jwt.claim.sub','',true);
  v_result:=public.get_service_post(v_post);
  assert not (v_result ? 'privateDetails') and not (v_result ? 'participantNames');
  assert v_result->>'authorDisplayName' like '동행-%';
  perform set_config('request.jwt.claim.sub',v_peer::text,true);
  v_result:=public.get_service_post(v_post);
  assert v_result->>'authorDisplayName'='작**규' and not (v_result ? 'privateDetails');
  v_request:=(public.request_service_post(v_post,'함께하는 동행을 신청합니다')->>'id')::uuid;
  assert public.get_match_consent(v_request)='{"consent":null}'::jsonb;
  v_first:=public.send_conversation_message(v_request,'63000000-0000-4000-8000-000000000001','안녕하세요');
  assert v_first->>'alreadySent'='false';
  assert public.send_conversation_message(v_request,'63000000-0000-4000-8000-000000000001','안녕하세요')->>'alreadySent'='true';
  begin
    perform public.send_conversation_message(v_request,'63000000-0000-4000-8000-000000000001','다른내용');
    raise exception 'message overwrite accepted';
  exception when serialization_failure then null; end;
  assert jsonb_array_length(public.list_conversation_messages(v_request,10)->'items')=1;
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  v_consent:=public.propose_match(v_request);
  assert char_length(v_consent->>'conditionVersion')=36, 'external condition version is not random UUID';
  assert not exists(select 1 from public.appointments where post_id=v_post), 'author proposal finalized alone';
  begin
    perform public.accept_match(v_request,v_consent->>'conditionVersion');
    raise exception 'author accepted for requester';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  begin
    perform public.get_match_consent(v_request);
    raise exception 'outsider read consent';
  exception when no_data_found then null; end;
  begin
    perform public.list_conversation_messages(v_request,10);
    raise exception 'outsider read messages';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub',v_peer::text,true);
  assert public.get_match_consent(v_request)->>'conditionVersion'=v_consent->>'conditionVersion';
  update public.posts set title='변경된 핵심동행 검사' where id=v_post;
  begin
    perform public.accept_match(v_request,v_consent->>'conditionVersion');
    raise exception 'stale conditions accepted';
  exception when serialization_failure then null; end;
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  v_consent:=public.propose_match(v_request);
  perform set_config('request.jwt.claim.sub',v_peer::text,true);
  v_first:=public.accept_match(v_request,v_consent->>'conditionVersion');
  assert v_first->>'alreadyConfirmed'='false';
  assert public.accept_match(v_request,v_consent->>'conditionVersion')->>'alreadyConfirmed'='true';
  v_result:=public.get_service_post(v_post);
  assert v_result#>>'{privateDetails,meetingDetail}'='비공개상세 만남지점';
  assert jsonb_array_length(v_result->'participantNames')=2;
  assert (select count(*) from public.appointments where post_id=v_post)=1;
  assert jsonb_array_length(public.list_my_notifications(20)->'items')=2;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  assert not (public.get_service_post(v_post) ? 'privateDetails');
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  perform public.create_service_post(v_post2,v_input);
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  v_request2:=(public.request_service_post(v_post2,'두번째 동행도 신청합니다')->>'id')::uuid;
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  v_consent:=public.propose_match(v_request2);
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  begin
    perform public.accept_match(v_request2,v_consent->>'conditionVersion');
    raise exception 'overlapping confirmed schedule accepted';
  exception when serialization_failure then null; end;
  assert not exists(select 1 from public.appointments where post_id=v_post2);
  assert not has_function_privilege('authenticated','public.confirm_match(uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','public.create_join_request(uuid,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.complete_signup_with_avatar(text,date,text,text,text,text)','EXECUTE');
  assert not has_column_privilege('authenticated','public.profiles','real_name','UPDATE');
  assert not has_column_privilege('authenticated','public.profiles','id','INSERT');
  assert not has_column_privilege('authenticated','public.chat_messages','content','INSERT');
  assert not has_function_privilege('authenticated','public.clear_my_profile_avatar()','EXECUTE');
  assert not has_table_privilege('authenticated','private.service_post_inputs','SELECT');
  perform set_config('request.jwt.claim.sub',v_author::text,true);
  insert into storage.objects(bucket_id,name,owner_id,metadata) values
    ('profile-images',v_author::text||'/65000000-0000-4000-8000-000000000001.jpg',v_author::text,'{"mimetype":"image/jpeg","size":100}'::jsonb),
    ('profile-images',v_author::text||'/65000000-0000-4000-8000-000000000002.jpg',v_author::text,'{"mimetype":"image/jpeg","size":100}'::jsonb);
  perform public.set_my_profile_avatar(v_author::text||'/65000000-0000-4000-8000-000000000001.jpg');
  begin
    delete from storage.objects where bucket_id='profile-images' and name=v_author::text||'/65000000-0000-4000-8000-000000000001.jpg';
    raise exception 'current photo removed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_my_profile_avatar(v_author::text||'/65000000-0000-4000-8000-000000000003.jpg');
    raise exception 'missing photo replaced current';
  exception when invalid_parameter_value then null; end;
  assert (select avatar_url from public.profiles where id=v_author)=v_author::text||'/65000000-0000-4000-8000-000000000001.jpg';
  perform public.set_my_profile_avatar(v_author::text||'/65000000-0000-4000-8000-000000000002.jpg');
  delete from storage.objects where bucket_id='profile-images' and name=v_author::text||'/65000000-0000-4000-8000-000000000001.jpg';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select public.get_my_profile();
do $$ begin
  begin
    perform public.confirm_match('64000000-0000-4000-8000-000000000001');
    raise exception 'legacy matching privilege bypass';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from private.match_consents;
    raise exception 'private consent table leaked';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
