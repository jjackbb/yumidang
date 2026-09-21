-- Remote migration version: 20260917043418 (applied through the project-scoped Supabase MCP).
-- New signups are completed only through complete_signup(). Existing profiles are grandfathered as legacy.
create table private.signup_eligibility (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  signup_route text not null check (signup_route in ('female_direct', 'female_referral', 'institutional_email', 'legacy')),
  institutional_email text,
  completed_at timestamptz not null default now(),
  constraint signup_eligibility_email_shape check (
    institutional_email is null or institutional_email = lower(btrim(institutional_email))
  )
);

create unique index signup_eligibility_institutional_email_unique
  on private.signup_eligibility (institutional_email)
  where institutional_email is not null;

create table private.female_referral_codes (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^YMD-[A-Z0-9]{8}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table private.referral_signup_audit (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint referral_signup_not_self check (referred_user_id <> referrer_user_id)
);

create table private.institutional_email_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  normalized_email text not null check (normalized_email = lower(btrim(normalized_email))),
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  last_attempt_at timestamptz,
  constraint institutional_email_expiry_order check (expires_at > requested_at)
);

alter table private.signup_eligibility enable row level security;
alter table private.female_referral_codes enable row level security;
alter table private.referral_signup_audit enable row level security;
alter table private.institutional_email_verifications enable row level security;

revoke all on table private.signup_eligibility from public, anon, authenticated;
revoke all on table private.female_referral_codes from public, anon, authenticated;
revoke all on table private.referral_signup_audit from public, anon, authenticated;
revoke all on table private.institutional_email_verifications from public, anon, authenticated;

insert into private.signup_eligibility (user_id, signup_route, completed_at)
select id, 'legacy', created_at from public.profiles
on conflict (user_id) do nothing;

drop policy if exists "profiles_insert_own" on public.profiles;
revoke insert (id, real_name, birth_date, gender, avatar_url, bio) on table public.profiles from authenticated;
revoke update (gender) on table public.profiles from authenticated;

create function public.get_or_create_my_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '28000';
  end if;

  perform 1
    from public.profiles p
    join private.signup_eligibility e on e.user_id = p.id
    where p.id = v_uid and p.gender = 'female';
  if not found then
    raise exception 'female_member_required' using errcode = '42501';
  end if;

  select c.code into v_code from private.female_referral_codes c where c.owner_id = v_uid;
  if v_code is not null then return v_code; end if;

  loop
    v_code := 'YMD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into private.female_referral_codes(owner_id, code) values (v_uid, v_code)
      on conflict (owner_id) do nothing;
      select c.code into v_code from private.female_referral_codes c where c.owner_id = v_uid;
      if v_code is not null then return v_code; end if;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

revoke all on function public.get_or_create_my_referral_code() from public, anon;
grant execute on function public.get_or_create_my_referral_code() to authenticated;

create function public.complete_signup(
  p_real_name text,
  p_birth_date date,
  p_gender text,
  p_method text default null,
  p_referral_code text default null
)
returns table (
  id uuid, real_name text, birth_date date, gender text, avatar_url text, bio text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_real_name, ''));
  v_referral text := upper(btrim(coalesce(p_referral_code, '')));
  v_referrer uuid;
  v_email text;
  v_code text;
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  perform 1 from auth.users u where u.id = v_uid for update;
  if not found then raise exception 'login_required' using errcode = '28000'; end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    return query select p.id, p.real_name, p.birth_date, p.gender, p.avatar_url, p.bio, p.created_at, p.updated_at
      from public.profiles p where p.id = v_uid;
    return;
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 10 or v_name !~ '^[가-힣]{2,10}$' then
    raise exception 'invalid_real_name' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > current_date
     or public.korean_age(p_birth_date) < 19 then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
  if p_gender not in ('female', 'male') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;

  if p_gender = 'female' then
    if p_method is not null and p_method <> 'female_direct' then
      raise exception 'invalid_signup_method' using errcode = '22023';
    end if;
    insert into public.profiles(id, real_name, birth_date, gender) values (v_uid, v_name, p_birth_date, p_gender);
    insert into private.signup_eligibility(user_id, signup_route) values (v_uid, 'female_direct');
    loop
      v_code := 'YMD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      begin
        insert into private.female_referral_codes(owner_id, code) values (v_uid, v_code);
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  elsif p_method = 'female_referral' then
    if v_referral !~ '^YMD-[A-Z0-9]{8}$' then
      raise exception 'invalid_referral' using errcode = '22023';
    end if;
    select c.owner_id into v_referrer
      from private.female_referral_codes c
      join public.profiles p on p.id = c.owner_id and p.gender = 'female'
      join private.signup_eligibility e on e.user_id = c.owner_id
      where c.code = v_referral and c.active;
    if v_referrer is null then raise exception 'invalid_referral' using errcode = '22023'; end if;
    insert into public.profiles(id, real_name, birth_date, gender) values (v_uid, v_name, p_birth_date, p_gender);
    insert into private.signup_eligibility(user_id, signup_route) values (v_uid, 'female_referral');
    insert into private.referral_signup_audit(referred_user_id, referrer_user_id) values (v_uid, v_referrer);
  elsif p_method = 'institutional_email' then
    select e.normalized_email into v_email
      from private.institutional_email_verifications e
      where e.user_id = v_uid and e.verified_at is not null;
    if v_email is null then raise exception 'email_verification_required' using errcode = '22023'; end if;
    insert into public.profiles(id, real_name, birth_date, gender) values (v_uid, v_name, p_birth_date, p_gender);
    begin
      insert into private.signup_eligibility(user_id, signup_route, institutional_email)
      values (v_uid, 'institutional_email', v_email);
    exception when unique_violation then
      raise exception 'institutional_email_already_used' using errcode = '23505';
    end;
  else
    raise exception 'male_eligibility_required' using errcode = '22023';
  end if;

  return query select p.id, p.real_name, p.birth_date, p.gender, p.avatar_url, p.bio, p.created_at, p.updated_at
    from public.profiles p where p.id = v_uid;
end;
$$;

revoke all on function public.complete_signup(text,date,text,text,text) from public, anon;
grant execute on function public.complete_signup(text,date,text,text,text) to authenticated;

create function public.request_test_institutional_email_verification(p_user_id uuid, p_email text)
returns table (expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text := split_part(v_email, '@', 2);
  v_previous private.institutional_email_verifications%rowtype;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_institutional_email' using errcode = '22023';
  end if;
  if v_domain = any(array['gmail.com','naver.com','daum.net','hanmail.net','kakao.com','nate.com','yahoo.com','yahoo.co.kr','hotmail.com','outlook.com','icloud.com']) then
    raise exception 'free_email_not_allowed' using errcode = '22023';
  end if;
  if exists (select 1 from private.signup_eligibility e where e.institutional_email = v_email and e.user_id <> p_user_id) then
    raise exception 'institutional_email_already_used' using errcode = '23505';
  end if;
  select * into v_previous from private.institutional_email_verifications e where e.user_id = p_user_id for update;
  if found and v_previous.requested_at > now() - interval '30 seconds' then
    raise exception 'email_request_rate_limited' using errcode = 'P0001';
  end if;
  insert into private.institutional_email_verifications(user_id, normalized_email, requested_at, expires_at, verified_at, attempt_count, last_attempt_at)
  values (p_user_id, v_email, now(), now() + interval '10 minutes', null, 0, null)
  on conflict (user_id) do update set normalized_email = excluded.normalized_email, requested_at = excluded.requested_at,
    expires_at = excluded.expires_at, verified_at = null, attempt_count = 0, last_attempt_at = null;
  return query select e.expires_at from private.institutional_email_verifications e where e.user_id = p_user_id;
end;
$$;

create function public.verify_test_institutional_email(p_user_id uuid, p_email text, p_code_valid boolean)
returns table (verified boolean, status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row private.institutional_email_verifications%rowtype;
begin
  select * into v_row from private.institutional_email_verifications e where e.user_id = p_user_id for update;
  if not found or v_row.normalized_email <> v_email then
    return query select false, 'email_request_missing'::text; return;
  end if;
  if v_row.expires_at <= now() then return query select false, 'email_code_expired'::text; return; end if;
  if v_row.attempt_count >= 5 then return query select false, 'email_attempts_exceeded'::text; return; end if;
  if not coalesce(p_code_valid, false) then
    update private.institutional_email_verifications set attempt_count = attempt_count + 1, last_attempt_at = now() where user_id = p_user_id;
    return query select false, 'invalid_email_code'::text; return;
  end if;
  if exists (select 1 from private.signup_eligibility e where e.institutional_email = v_email and e.user_id <> p_user_id) then
    return query select false, 'institutional_email_already_used'::text; return;
  end if;
  update private.institutional_email_verifications set verified_at = now(), last_attempt_at = now() where user_id = p_user_id;
  return query select true, 'verified'::text;
end;
$$;

revoke all on function public.request_test_institutional_email_verification(uuid,text) from public, anon, authenticated;
revoke all on function public.verify_test_institutional_email(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.request_test_institutional_email_verification(uuid,text) to service_role;
grant execute on function public.verify_test_institutional_email(uuid,text,boolean) to service_role;

drop function public.get_post_author_profile(uuid);
create function public.get_post_author_profile(p_post_id uuid)
returns table (masked_name text, gender text, age integer, avatar_url text, bio text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'login_required' using errcode = '28000'; end if;
  return query
    select public.mask_real_name(pr.real_name), pr.gender, public.korean_age(pr.birth_date), pr.avatar_url, pr.bio
    from public.posts p join public.profiles pr on pr.id = p.author_id
    where p.id = p_post_id and p.status <> 'deleted';
  if not found then raise exception 'profile_unavailable' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.get_post_author_profile(uuid) from public, anon;
grant execute on function public.get_post_author_profile(uuid) to authenticated;

comment on table private.institutional_email_verifications is 'Test-only institutional email challenges. No mail is sent; access is server-only.';
comment on function public.complete_signup(text,date,text,text,text) is 'Atomic, authenticated signup completion and male eligibility enforcement.';
