begin;
do $$
declare a uuid:=md5('bilateral-a')::uuid; b uuid:=md5('bilateral-b')::uuid; outsider uuid:=md5('bilateral-outsider')::uuid;
 p uuid; r uuid; ap uuid; x record; at_before timestamptz; n integer; auto_result jsonb;
begin
 insert into auth.users(id) values(a),(b),(outsider);
 insert into public.profiles(id,real_name,birth_date) values(a,'완료작성자','1990-01-01'),(b,'완료신청자','1990-01-01'),(outsider,'외부회원','1990-01-01');
 for i in 1..6 loop
 p:=md5('bilateral-p'||i)::uuid; r:=md5('bilateral-r'||i)::uuid; ap:=md5('bilateral-ap'||i)::uuid;
 insert into public.posts(id,author_id,title,description,category,starts_at,ends_at,recruitment_ends_at,public_area)
 values(p,a,'완료 테스트','검증용 동행','산책',now()-interval '3 days',
 case when i=1 then now()-interval '1 hour' when i=4 then now()+interval '1 hour' else now()-interval '2 days' end,
 now()-interval '4 days','서울특별시 강남구 역삼동');
 insert into public.join_requests(id,post_id,requester_id,message,status) values(r,p,b,'함께 동행하는 테스트입니다','matched');
 insert into public.appointments(id,post_id,join_request_id,status) values(ap,p,r,case when i=3 then 'cancelled' else 'confirmed' end);
 end loop;
 update public.appointments set status='no_show',completed_at=now(),completion_method='automatic',completion_notified_at=now(),dispute_deadline_at=now()+interval '24 hours',review_deadline_at=now()+interval '7 days' where id=md5('bilateral-ap6')::uuid;
 ap:=md5('bilateral-ap1')::uuid;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin perform public.confirm_appointment_completion(ap); raise exception 'outsider allowed'; exception when sqlstate 'PT404' then null; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select * into x from public.confirm_appointment_completion(ap);
 assert x.status='confirmed' and x.completed_at is null and x.completion_notified_at is null;
 assert not exists(select 1 from public.notifications where kind='appointment_completed' and join_request_id=md5('bilateral-r1')::uuid);
 select * into x from public.get_appointment_state(ap); assert not x.can_confirm_completion and x.my_completion_at is not null and x.peer_completion_at is null;
 perform public.confirm_appointment_completion(ap);
 assert (select count(*) from public.appointment_completion_confirmations where appointment_id=ap)=1;
 perform set_config('request.jwt.claim.sub',b::text,true);
 select * into x from public.confirm_appointment_completion(ap);
 assert x.status='completed' and x.completion_method='manual'; at_before:=x.completed_at;
 assert (select review_deadline_at=completed_at+interval '7 days' from public.appointments where id=ap);
 select * into x from public.confirm_appointment_completion(ap); assert x.completed_at=at_before;
 assert (select count(*) from public.notifications where kind='appointment_completed' and join_request_id=md5('bilateral-r1')::uuid)=2;
 begin perform public.confirm_appointment_completion(md5('bilateral-ap3')::uuid); raise exception 'cancelled allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.confirm_appointment_completion(md5('bilateral-ap6')::uuid); raise exception 'no_show allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.confirm_appointment_completion(md5('bilateral-ap4')::uuid); raise exception 'early allowed'; exception when invalid_parameter_value then null; end;
 -- An inconsistent confirmed row with an open dispute must also be excluded.
 insert into public.appointment_disputes(appointment_id,raised_by_user_id,reason,review_time_remaining)
 values(md5('bilateral-ap5')::uuid,a,'자동 처리 제외 검증',interval '7 days');
 at_before:=clock_timestamp(); auto_result:=public.process_due_completions(1000);
 assert (select status='completed' and completion_method='automatic' and completed_by_user_id is null
   and completed_at>=at_before and review_deadline_at=completed_at+interval '7 days'
   from public.appointments where id=md5('bilateral-ap2')::uuid),'Delayed auto uses actual processing time';
 assert not exists(select 1 from public.appointment_completion_confirmations where appointment_id=md5('bilateral-ap2')::uuid);
 assert (select status='confirmed' from public.appointments where id=md5('bilateral-ap5')::uuid);
 assert (select count(*) from public.notifications where kind='appointment_completed' and join_request_id=md5('bilateral-r2')::uuid)=2;
 select completed_at into at_before from public.appointments where id=md5('bilateral-ap2')::uuid;
 perform public.process_due_completions(1000);
 assert (select completed_at=at_before from public.appointments where id=md5('bilateral-ap2')::uuid);
 assert not has_function_privilege('authenticated','public.process_due_completions(integer)','execute');
 raise notice 'PASS bilateral confirmations, idempotency, actual auto time, notification atomicity, outsiders, cancelled, early, disputes';
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',md5('bilateral-a')::uuid::text,true);
select status from public.get_appointment_state(md5('bilateral-ap1')::uuid);
do $$ begin
 begin perform public.process_due_completions(1); raise exception 'member executed internal'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role service_role;
select public.process_due_completions(1);
reset role;
rollback;
