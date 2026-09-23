-- Core service RPCs. Existing records are preserved; unsupported paid/provider
-- flows fail closed. A valid Auth session is not evidence of PASS verification.
alter table public.posts add column cost_type text check (cost_type is null or cost_type = 'free');
alter table public.posts add column amount bigint check (amount is null or amount = 0);
alter table public.posts add constraint posts_cost_pair check ((cost_type is null) = (amount is null));
comment on column public.posts.cost_type is 'NULL: historical cost unknown. New supported writes are free only until bank/provider policy is connected.';

create table private.service_post_inputs (
  post_id uuid primary key references public.posts(id) on delete cascade,
  input jsonb not null
);
create table private.match_consents (
  request_id uuid primary key references public.join_requests(id) on delete cascade,
  condition_version text not null,
  condition_fingerprint text not null,
  conditions jsonb not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz
);
alter table private.service_post_inputs enable row level security;
alter table private.match_consents enable row level security;
revoke all on private.service_post_inputs, private.match_consents from public, anon, authenticated, service_role;

-- Remove old direct signup/identity and one-person match bypasses. No data conversion.
revoke insert on public.profiles from anon, authenticated;
revoke insert (id,real_name,birth_date,avatar_url,bio,gender) on public.profiles from anon, authenticated;
revoke update (real_name,birth_date,gender) on public.profiles from anon, authenticated;
revoke all on function public.complete_signup_with_avatar(text,date,text,text,text,text),
  public.complete_signup(text,date,text,text,text), public.check_signup_eligibility(text,text),
  public.confirm_match(uuid), public.create_join_request(uuid,text),public.clear_my_profile_avatar(),
  public.create_post(uuid,text,text,text,timestamptz,timestamptz,timestamptz,text,text,text,text[],text)
  from public, anon, authenticated, service_role;
revoke insert on public.chat_messages from anon,authenticated;
revoke insert (id,join_request_id,sender_id,content) on public.chat_messages from anon,authenticated;

-- Pointer swaps and object deletion both lock the owning profile. The image row
-- also stays locked until a successful swap commits; competing operations may
-- safely abort with a database deadlock instead of losing the current photo.
create or replace function public.set_my_profile_avatar(p_avatar_path text)
returns table(avatar_url text,previous_avatar_path text)
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_previous text;
begin
  if v_uid is null then raise exception 'login_required' using errcode='28000'; end if;
  select p.avatar_url into v_previous from public.profiles p where p.id=v_uid for update;
  if not found then raise exception 'profile_required' using errcode='42501'; end if;
  perform 1 from storage.objects where bucket_id='profile-images' and name=btrim(p_avatar_path) for share;
  perform private.assert_owned_profile_image(v_uid,btrim(coalesce(p_avatar_path,'')));
  update public.profiles p set avatar_url=btrim(p_avatar_path) where p.id=v_uid;
  return query select btrim(p_avatar_path),v_previous;
end; $$;
create function private.protect_current_profile_image()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_avatar text;
begin
  if old.bucket_id='profile-images' then
    select avatar_url into v_avatar from public.profiles where id::text=old.owner_id for update;
    if v_avatar=old.name then raise exception 'current_profile_image_required' using errcode='42501'; end if;
  end if;
  return old;
end; $$;
revoke all on function private.protect_current_profile_image() from public,anon,authenticated,service_role;
create trigger protect_current_profile_image before delete on storage.objects
for each row execute function private.protect_current_profile_image();

create function private.require_service_profile()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'login_required' using errcode='28000'; end if;
  if not exists(select 1 from public.profiles where id=v_uid) then
    raise exception 'profile_required' using errcode='42501';
  end if;
  return v_uid;
end;
$$;
revoke all on function private.require_service_profile() from public,anon,authenticated,service_role;

create function public.get_my_profile()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid := private.require_service_profile(); v_result jsonb;
begin
  select jsonb_build_object('userId',id,'realName',real_name,'avatarUrl',avatar_url,'bio',bio)
    into v_result from public.profiles where id=v_uid;
  return v_result;
end;
$$;

create function public.create_service_post(p_post_id uuid,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid := private.require_service_profile(); v_post public.posts;
  v_key text; v_tags text[]; v_input jsonb; v_prior jsonb;
begin
  if p_post_id is null or p_input is null or jsonb_typeof(p_input)<>'object'
    or not p_input ?& array['title','description','category','startsAt','endsAt','recruitmentEndsAt','publicArea',
      'registeredPlaceName','registeredAddress','meetingDetail','preferenceNote','tags','costType','amount']
    or p_input - array['title','description','category','startsAt','endsAt','recruitmentEndsAt','publicArea',
      'registeredPlaceName','registeredAddress','meetingDetail','preferenceNote','tags','costType','amount'] <> '{}'::jsonb then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  foreach v_key in array array['title','description','category','startsAt','endsAt','recruitmentEndsAt','publicArea','registeredAddress','meetingDetail','costType'] loop
    if jsonb_typeof(p_input->v_key) is distinct from 'string' then raise exception 'invalid_input' using errcode='22023'; end if;
  end loop;
  foreach v_key in array array['registeredPlaceName','preferenceNote'] loop
    if jsonb_typeof(p_input->v_key) not in ('string','null') then raise exception 'invalid_input' using errcode='22023'; end if;
  end loop;
  if p_input->>'costType'<>'free' then raise exception 'bank_integration_unavailable' using errcode='PT503'; end if;
  if p_input->'amount'<>'0'::jsonb or jsonb_typeof(p_input->'tags')<>'array'
    or jsonb_array_length(p_input->'tags')>5 then raise exception 'invalid_input' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_input->'tags') t where jsonb_typeof(t)<>'string') then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  if char_length(btrim(p_input->>'registeredAddress')) not between 1 and 300
    or char_length(coalesce(p_input->>'registeredPlaceName',''))>200
    or not isfinite((p_input->>'startsAt')::timestamptz)
    or not isfinite((p_input->>'endsAt')::timestamptz)
    or not isfinite((p_input->>'recruitmentEndsAt')::timestamptz) then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  -- One key cannot race into different payloads. Only server-validated UUID text is hashed.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text, 320));
  select input into v_prior from private.service_post_inputs where post_id=p_post_id;
  if found then
    if v_prior<>p_input or not exists(select 1 from public.posts where id=p_post_id and author_id=v_uid) then
      raise exception 'post_conflict' using errcode='40001';
    end if;
    return jsonb_build_object('postId',p_post_id,'alreadyCreated',true);
  end if;
  if exists(select 1 from public.posts where id=p_post_id) then raise exception 'post_conflict' using errcode='40001'; end if;
  select coalesce(array_agg(value),'{}'::text[]) into v_tags from jsonb_array_elements_text(p_input->'tags');
  select * into v_post from public.create_post(p_post_id,p_input->>'title',p_input->>'description',p_input->>'category',
    (p_input->>'startsAt')::timestamptz,(p_input->>'endsAt')::timestamptz,(p_input->>'recruitmentEndsAt')::timestamptz,
    p_input->>'publicArea',p_input->>'meetingDetail',p_input->>'preferenceNote',v_tags,'any');
  update public.posts set cost_type='free',amount=0 where id=p_post_id;
  perform public.set_post_search_location(p_post_id,p_input->>'registeredPlaceName',p_input->>'registeredAddress');
  insert into private.service_post_inputs(post_id,input) values(p_post_id,p_input);
  return jsonb_build_object('postId',p_post_id,'alreadyCreated',false);
exception when invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation then
  raise exception 'invalid_input' using errcode='22023';
end;
$$;

create function public.get_service_post(p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_post public.posts; v_details jsonb; v_names jsonb; v_result jsonb;
begin
  select * into v_post from public.posts where id=p_post_id and status<>'deleted';
  if not found then raise exception 'post_unavailable' using errcode='P0002'; end if;
  select jsonb_build_object('postId',v_post.id,'title',v_post.title,'description',v_post.description,
    'category',v_post.category,'startsAt',v_post.starts_at,'endsAt',v_post.ends_at,
    'publicArea',v_post.public_area,'status',v_post.status,'costType',v_post.cost_type,'amount',v_post.amount,
    'authorDisplayName',case when v_uid is null then '동행-'||replace(v_post.id::text,'-','') else public.mask_real_name(pr.real_name) end)
    into v_result from public.profiles pr where pr.id=v_post.author_id;
  if v_uid is not null and (v_post.author_id=v_uid or private.is_confirmed_companion(p_post_id)) then
    select jsonb_build_object('registeredPlaceName',l.registered_place_name,'registeredAddress',l.registered_address,
      'meetingDetail',d.exact_location) into v_details from private.post_search_locations l
      join public.post_private_details d on d.post_id=l.post_id where l.post_id=p_post_id;
    select jsonb_agg(jsonb_build_object('userId',pr.id,'realName',pr.real_name) order by pr.id) into v_names
      from public.profiles pr where pr.id=v_post.author_id or pr.id in (
        select jr.requester_id from public.appointments ap join public.join_requests jr on jr.id=ap.join_request_id where ap.post_id=p_post_id);
    v_result:=v_result||jsonb_build_object('privateDetails',v_details,'participantNames',v_names);
  end if;
  return v_result;
end;
$$;

create function public.request_service_post(p_post_id uuid,p_message text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_post public.posts; v_result jsonb;
begin
  select * into v_post from public.posts where id=p_post_id and status<>'deleted' for update;
  if not found then raise exception 'post_unavailable' using errcode='P0002'; end if;
  if v_post.cost_type is distinct from 'free' then raise exception 'bank_integration_unavailable' using errcode='PT503'; end if;
  select to_jsonb(r) into v_result from public.create_join_request(p_post_id,p_message) r;
  return v_result;
end;
$$;

create function private.match_conditions(p_post_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('postId',id,'title',title,'startsAt',starts_at,'endsAt',ends_at,
    'publicArea',public_area,'costType',cost_type,'amount',amount,'paymentDirection','none')
  from public.posts where id=p_post_id;
$$;
create function private.match_condition_version(p_post_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select md5((private.match_conditions(p_post_id)||jsonb_build_object('address',l.registered_address,
    'place',l.registered_place_name,'detail',d.exact_location))::text)
  from public.post_private_details d left join private.post_search_locations l on l.post_id=d.post_id
  where d.post_id=p_post_id;
$$;
revoke all on function private.match_conditions(uuid),private.match_condition_version(uuid) from public,anon,authenticated,service_role;

alter table public.notifications drop constraint notifications_kind_allowed;
alter table public.notifications add constraint notifications_kind_allowed
  check(kind in ('join_request','appointment_completed','match_consent_requested','match_confirmed'));

create function public.propose_match(p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_request public.join_requests; v_post public.posts;
  v_conditions jsonb; v_version text; v_fingerprint text;
begin
  select * into v_request from public.join_requests where id=p_request_id;
  select * into v_post from public.posts where id=v_request.post_id for update;
  if v_post.id is null or v_post.author_id<>v_uid or v_post.status='deleted' then raise exception 'request_unavailable' using errcode='P0002'; end if;
  select * into v_request from public.join_requests where id=p_request_id for update;
  if v_request.status<>'pending' or v_post.status<>'recruiting' or v_post.starts_at<=clock_timestamp() then
    raise exception 'match_conflict' using errcode='40001';
  end if;
  if v_post.cost_type is distinct from 'free' then raise exception 'bank_integration_unavailable' using errcode='PT503'; end if;
  v_conditions:=private.match_conditions(v_post.id); v_fingerprint:=private.match_condition_version(v_post.id);
  if v_fingerprint is null then raise exception 'location_required' using errcode='40001'; end if;
  -- External versions are random, so undisclosed address/details cannot be guessed
  -- by hashing candidate locations against a publicly returned digest.
  insert into private.match_consents(request_id,condition_version,condition_fingerprint,conditions,requested_by)
    values(p_request_id,gen_random_uuid()::text,v_fingerprint,v_conditions,v_uid)
    on conflict(request_id) do update set condition_version=excluded.condition_version,condition_fingerprint=excluded.condition_fingerprint,conditions=excluded.conditions,
      requested_by=excluded.requested_by,requested_at=clock_timestamp(),accepted_at=null
      where private.match_consents.condition_fingerprint<>excluded.condition_fingerprint;
  select condition_version into v_version from private.match_consents where request_id=p_request_id;
  insert into public.notifications(recipient_id,kind,join_request_id) values(v_request.requester_id,'match_consent_requested',p_request_id)
    on conflict(recipient_id,kind,join_request_id) do nothing;
  return jsonb_build_object('requestId',p_request_id,'conditionVersion',v_version,'conditions',v_conditions,'status','awaiting_consent');
end;
$$;

create function public.get_match_consent(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_consent private.match_consents;
begin
  if private.request_role(p_request_id) is null then raise exception 'request_unavailable' using errcode='P0002'; end if;
  select * into v_consent from private.match_consents where request_id=p_request_id;
  if not found then return jsonb_build_object('consent',null); end if;
  return jsonb_build_object('requestId',p_request_id,'conditionVersion',v_consent.condition_version,
    'conditions',v_consent.conditions,'status',case when v_consent.accepted_at is null then 'awaiting_consent' else 'accepted' end);
end;
$$;

create function public.accept_match(p_request_id uuid,p_condition_version text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_request public.join_requests; v_post public.posts;
  v_consent private.match_consents; v_appointment public.appointments; v_participant uuid;
begin
  select * into v_request from public.join_requests where id=p_request_id;
  if not found or v_request.requester_id<>v_uid then raise exception 'request_unavailable' using errcode='P0002'; end if;
  select * into v_post from public.posts where id=v_request.post_id for update;
  if v_post.status='deleted' then raise exception 'request_unavailable' using errcode='P0002'; end if;
  -- All finalizers lock both participants in a single total order, across posts.
  for v_participant in select id from public.profiles where id in(v_uid,v_post.author_id) order by id loop
    perform pg_advisory_xact_lock(hashtextextended(v_participant::text,321));
  end loop;
  select * into v_request from public.join_requests where id=p_request_id for update;
  select * into v_consent from private.match_consents where request_id=p_request_id for update;
  if v_consent.request_id is null or p_condition_version is null or p_condition_version<>v_consent.condition_version then
    raise exception 'condition_conflict' using errcode='40001';
  end if;
  select * into v_appointment from public.appointments where post_id=v_post.id;
  if found then
    if v_appointment.join_request_id<>p_request_id or v_consent.accepted_at is null then raise exception 'match_conflict' using errcode='40001'; end if;
    return jsonb_build_object('appointmentId',v_appointment.id,'postId',v_post.id,'requestId',p_request_id,'status',v_appointment.status,'alreadyConfirmed',true);
  end if;
  if v_post.cost_type is distinct from 'free' then raise exception 'bank_integration_unavailable' using errcode='PT503'; end if;
  if v_request.status<>'pending' or v_post.status<>'recruiting' or v_post.starts_at<=clock_timestamp()
    or private.match_condition_version(v_post.id) is distinct from v_consent.condition_fingerprint then raise exception 'condition_conflict' using errcode='40001'; end if;
  if exists(select 1 from public.appointments ap join public.posts p on p.id=ap.post_id
    join public.join_requests jr on jr.id=ap.join_request_id
    where ap.status='confirmed' and (p.author_id in(v_uid,v_post.author_id) or jr.requester_id in(v_uid,v_post.author_id))
      and tstzrange(p.starts_at,p.ends_at,'[)') && tstzrange(v_post.starts_at,v_post.ends_at,'[)')) then
    raise exception 'schedule_conflict' using errcode='40001';
  end if;
  insert into public.appointments(post_id,join_request_id) values(v_post.id,p_request_id) returning * into v_appointment;
  update public.join_requests set status='matched' where id=p_request_id;
  update public.posts set status='closed' where id=v_post.id;
  update private.match_consents set accepted_at=clock_timestamp() where request_id=p_request_id;
  -- Other pending requests are preserved: their termination policy is not invented here.
  insert into public.notifications(recipient_id,kind,join_request_id)
    values(v_uid,'match_confirmed',p_request_id),(v_post.author_id,'match_confirmed',p_request_id)
    on conflict(recipient_id,kind,join_request_id) do nothing;
  return jsonb_build_object('appointmentId',v_appointment.id,'postId',v_post.id,'requestId',p_request_id,'status',v_appointment.status,'alreadyConfirmed',false);
end;
$$;

create function public.list_my_notifications(p_limit integer,p_before uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_before public.notifications; v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_input' using errcode='22023'; end if;
  if p_before is not null then
    select * into v_before from public.notifications where id=p_before and recipient_id=v_uid;
    if not found then raise exception 'cursor_unavailable' using errcode='P0002'; end if;
  end if;
  with candidates as materialized(select * from public.notifications where recipient_id=v_uid
    and (p_before is null or (created_at,id)<(v_before.created_at,v_before.id)) order by created_at desc,id desc limit p_limit+1),
    page as(select * from candidates order by created_at desc,id desc limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('notificationId',id,'kind',kind,
    'requestId',join_request_id,'createdAt',created_at,'readAt',read_at) order by created_at desc,id desc) from page),'[]'::jsonb),
    'nextCursor',case when (select count(*) from candidates)>p_limit then
      (select id from page order by created_at,id limit 1) else null end) into v_result;
  return v_result;
end;
$$;

create function public.list_conversation_messages(p_request_id uuid,p_limit integer,p_before uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_before public.chat_messages; v_result jsonb;
begin
  if private.request_role(p_request_id) is null then raise exception 'request_unavailable' using errcode='P0002'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_input' using errcode='22023'; end if;
  if p_before is not null then
    select * into v_before from public.chat_messages where id=p_before and join_request_id=p_request_id;
    if not found then raise exception 'cursor_unavailable' using errcode='P0002'; end if;
  end if;
  with candidates as materialized(select * from public.chat_messages where join_request_id=p_request_id
    and(p_before is null or (created_at,id)<(v_before.created_at,v_before.id)) order by created_at desc,id desc limit p_limit+1),
    page as(select * from candidates order by created_at desc,id desc limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('messageId',id,'senderId',sender_id,
    'content',content,'createdAt',created_at) order by created_at desc,id desc) from page),'[]'::jsonb),
    'nextCursor',case when (select count(*) from candidates)>p_limit then(select id from page order by created_at,id limit 1) else null end)
    into v_result;
  return v_result;
end;
$$;

create function public.send_conversation_message(p_request_id uuid,p_message_id uuid,p_content text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=private.require_service_profile(); v_msg public.chat_messages;
begin
  if private.request_role(p_request_id) is null then raise exception 'request_unavailable' using errcode='P0002'; end if;
  if p_message_id is null or p_content is null or char_length(btrim(p_content)) not between 1 and 1000 then
    raise exception 'invalid_input' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_message_id::text,322));
  select * into v_msg from public.chat_messages where id=p_message_id;
  if found then
    if v_msg.sender_id<>v_uid or v_msg.join_request_id<>p_request_id or v_msg.content<>btrim(p_content) then
      raise exception 'message_conflict' using errcode='40001';
    end if;
    return jsonb_build_object('messageId',v_msg.id,'createdAt',v_msg.created_at,'alreadySent',true);
  end if;
  perform 1 from public.join_requests where id=p_request_id for update;
  if not private.can_send_message(p_request_id) then raise exception 'conversation_closed' using errcode='42501'; end if;
  insert into public.chat_messages(id,join_request_id,sender_id,content) values(p_message_id,p_request_id,v_uid,btrim(p_content)) returning * into v_msg;
  return jsonb_build_object('messageId',v_msg.id,'createdAt',v_msg.created_at,'alreadySent',false);
end;
$$;

revoke all on function public.get_my_profile(), public.create_service_post(uuid,jsonb), public.get_service_post(uuid),
  public.request_service_post(uuid,text),public.propose_match(uuid),public.get_match_consent(uuid),public.accept_match(uuid,text),
  public.list_my_notifications(integer,uuid),public.list_conversation_messages(uuid,integer,uuid),public.send_conversation_message(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.get_my_profile(), public.create_service_post(uuid,jsonb), public.get_service_post(uuid),
  public.request_service_post(uuid,text),public.propose_match(uuid),public.get_match_consent(uuid),public.accept_match(uuid,text),
  public.list_my_notifications(integer,uuid),public.list_conversation_messages(uuid,integer,uuid),public.send_conversation_message(uuid,uuid,text)
  to authenticated;
grant execute on function public.get_service_post(uuid) to anon;
