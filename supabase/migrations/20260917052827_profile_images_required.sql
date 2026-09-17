-- EXPANSION ONLY. Keep complete_signup(...) executable until the new frontend has been deployed and smoke-tested.
-- Apply this expansion before relying on the versioned profile-image RPCs in production.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 2097152, array['image/jpeg']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_images_authenticated_read" on storage.objects;
create policy "profile_images_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'profile-images');

drop policy if exists "profile_images_insert_own" on storage.objects;
create policy "profile_images_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg$')
);

-- Replacement uses INSERT(new unique path) -> RPC pointer swap -> DELETE(old path), never upsert.
drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-images'
  and owner_id = auth.uid()::text
  and name ~ ('^' || auth.uid()::text || '/')
);

create or replace function private.assert_owned_profile_image(p_uid uuid, p_avatar_path text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_id text;
  v_metadata jsonb;
begin
  if p_uid is null or p_avatar_path is null
     or p_avatar_path !~ ('^' || p_uid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg$') then
    raise exception 'invalid_profile_image_path' using errcode = '22023';
  end if;

  select o.owner_id, o.metadata into v_owner_id, v_metadata
    from storage.objects o
    where o.bucket_id = 'profile-images' and o.name = p_avatar_path;
  if not found then raise exception 'profile_image_missing' using errcode = '22023'; end if;
  if v_owner_id is distinct from p_uid::text then
    raise exception 'profile_image_not_owned' using errcode = '42501';
  end if;
  if coalesce(v_metadata->>'mimetype', '') <> 'image/jpeg'
     or coalesce(v_metadata->>'size', '') !~ '^[0-9]+$' then
    raise exception 'invalid_profile_image_object' using errcode = '22023';
  end if;
  if (v_metadata->>'size')::numeric not between 1 and 2097152 then
    raise exception 'invalid_profile_image_object' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.assert_owned_profile_image(uuid,text) from public, anon, authenticated;

create or replace function public.check_signup_eligibility(p_method text, p_referral_code text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_referral text := upper(btrim(coalesce(p_referral_code, '')));
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles p where p.id = v_uid) then return true; end if;
  if p_method = 'female_referral' then
    if not exists (
      select 1
      from private.female_referral_codes c
      join public.profiles p on p.id = c.owner_id and p.gender = 'female'
      join private.signup_eligibility e on e.user_id = c.owner_id
      where c.code = v_referral and c.active
    ) then raise exception 'invalid_referral' using errcode = '22023'; end if;
    return true;
  end if;
  if p_method = 'institutional_email' then
    if not exists (
      select 1 from private.institutional_email_verifications v
      where v.user_id = v_uid and v.verified_at is not null and v.expires_at > v.verified_at
    ) then raise exception 'email_verification_required' using errcode = '22023'; end if;
    return true;
  end if;
  raise exception 'male_eligibility_required' using errcode = '22023';
end;
$$;

revoke all on function public.check_signup_eligibility(text,text) from public, anon;
grant execute on function public.check_signup_eligibility(text,text) to authenticated;

create or replace function public.complete_signup_with_avatar(
  p_real_name text,
  p_birth_date date,
  p_gender text,
  p_avatar_path text,
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
  v_avatar_path text := btrim(coalesce(p_avatar_path, ''));
  v_referral text := upper(btrim(coalesce(p_referral_code, '')));
  v_referrer uuid;
  v_email text;
  v_code text;
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  perform 1 from auth.users u where u.id = v_uid for update;
  if not found then raise exception 'login_required' using errcode = '28000'; end if;

  -- Retries after a committed signup are idempotent and preserve legacy accounts, including null/URL avatars.
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

  perform private.assert_owned_profile_image(v_uid, v_avatar_path);

  if p_gender = 'female' then
    if p_method is not null and p_method <> 'female_direct' then
      raise exception 'invalid_signup_method' using errcode = '22023';
    end if;
    insert into public.profiles(id, real_name, birth_date, gender, avatar_url)
      values (v_uid, v_name, p_birth_date, p_gender, v_avatar_path);
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
    if v_referral !~ '^YMD-[A-Z0-9]{8}$' then raise exception 'invalid_referral' using errcode = '22023'; end if;
    select c.owner_id into v_referrer
      from private.female_referral_codes c
      join public.profiles p on p.id = c.owner_id and p.gender = 'female'
      join private.signup_eligibility e on e.user_id = c.owner_id
      where c.code = v_referral and c.active;
    if v_referrer is null then raise exception 'invalid_referral' using errcode = '22023'; end if;
    insert into public.profiles(id, real_name, birth_date, gender, avatar_url)
      values (v_uid, v_name, p_birth_date, p_gender, v_avatar_path);
    insert into private.signup_eligibility(user_id, signup_route) values (v_uid, 'female_referral');
    insert into private.referral_signup_audit(referred_user_id, referrer_user_id) values (v_uid, v_referrer);
  elsif p_method = 'institutional_email' then
    select e.normalized_email into v_email
      from private.institutional_email_verifications e
      where e.user_id = v_uid and e.verified_at is not null and e.expires_at > e.verified_at;
    if v_email is null then raise exception 'email_verification_required' using errcode = '22023'; end if;
    insert into public.profiles(id, real_name, birth_date, gender, avatar_url)
      values (v_uid, v_name, p_birth_date, p_gender, v_avatar_path);
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

revoke all on function public.complete_signup_with_avatar(text,date,text,text,text,text) from public, anon;
grant execute on function public.complete_signup_with_avatar(text,date,text,text,text,text) to authenticated;

create or replace function public.set_my_profile_avatar(p_avatar_path text)
returns table (avatar_url text, previous_avatar_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_previous text;
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  perform private.assert_owned_profile_image(v_uid, btrim(coalesce(p_avatar_path, '')));
  select p.avatar_url into v_previous from public.profiles p where p.id = v_uid for update;
  if not found then raise exception 'profile_required' using errcode = '22023'; end if;
  update public.profiles p set avatar_url = btrim(p_avatar_path) where p.id = v_uid;
  return query select btrim(p_avatar_path), v_previous;
end;
$$;

create or replace function public.clear_my_profile_avatar()
returns table (avatar_url text, previous_avatar_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_previous text;
begin
  if v_uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  select p.avatar_url into v_previous from public.profiles p where p.id = v_uid for update;
  if not found then raise exception 'profile_required' using errcode = '22023'; end if;
  update public.profiles p set avatar_url = null where p.id = v_uid;
  return query select null::text, v_previous;
end;
$$;

revoke all on function public.set_my_profile_avatar(text) from public, anon;
revoke all on function public.clear_my_profile_avatar() from public, anon;
grant execute on function public.set_my_profile_avatar(text) to authenticated;
grant execute on function public.clear_my_profile_avatar() to authenticated;

-- New clients must use the validating RPCs. Existing rows and legacy URL/data values are left untouched.
revoke update (avatar_url) on table public.profiles from authenticated;

comment on function public.complete_signup_with_avatar(text,date,text,text,text,text)
  is 'Versioned signup completion: validates an owned private JPEG object and atomically stores its stable path.';
comment on function public.set_my_profile_avatar(text)
  is 'Validates an owned private JPEG object before swapping the current member profile path.';
