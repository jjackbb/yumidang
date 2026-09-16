-- Remote migration version: 20260916101123 (applied through the project-scoped Supabase MCP).
-- Feature 1 audit: the signup contract stores a private real-name source, not a public nickname.
-- RENAME keeps every existing row and the column-level INSERT/UPDATE grants (grants follow the column).
-- Existing test values are test data only; they are not verified real names.
alter table public.profiles rename column nickname to real_name;
alter table public.profiles rename constraint profiles_nickname_trimmed to profiles_real_name_trimmed;
alter table public.profiles rename constraint profiles_nickname_length to profiles_real_name_length;

comment on column public.profiles.real_name is
  'Private real-name source typed by the member (not identity-verified). Only the owner reads it; other members receive mask_real_name() output from server RPCs.';
comment on column public.profiles.birth_date is
  'Private exact birth date. Only the owner reads it; other members receive korean_age() output from server RPCs.';

-- Masking rule: 변종 -> 변*, 변종현 -> 변*현, 변종현미 -> 변**미. Pure function without table access.
create function public.mask_real_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_name is null or char_length(btrim(p_name)) = 0 then ''
    when char_length(btrim(p_name)) = 1 then '*'
    when char_length(btrim(p_name)) = 2 then left(btrim(p_name), 1) || '*'
    else left(btrim(p_name), 1) || repeat('*', char_length(btrim(p_name)) - 2) || right(btrim(p_name), 1)
  end;
$$;

-- Full age on the Asia/Seoul calendar date; never stored.
create function public.korean_age(p_birth_date date, p_on date default ((now() at time zone 'Asia/Seoul')::date))
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select case when p_birth_date is null then null
    else extract(year from age(p_on, p_birth_date))::integer end;
$$;

revoke all on function public.mask_real_name(text) from public, anon;
revoke all on function public.korean_age(date, date) from public, anon;
grant execute on function public.mask_real_name(text) to authenticated;
grant execute on function public.korean_age(date, date) to authenticated;

-- Private helper schema: not exposed through the Data API; used by RLS policies and RPCs.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
