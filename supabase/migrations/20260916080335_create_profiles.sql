-- Remote migration version: 20260916080335 (applied through the project-scoped Supabase MCP).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  birth_date date not null,
  neighborhood text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_trimmed check (nickname = btrim(nickname)),
  constraint profiles_nickname_length check (char_length(nickname) between 2 and 20),
  constraint profiles_birth_date_range check (
    birth_date >= date '1900-01-01'
    and birth_date <= current_date
  ),
  constraint profiles_neighborhood_trimmed check (neighborhood = btrim(neighborhood)),
  constraint profiles_neighborhood_length check (char_length(neighborhood) between 1 and 100),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 300)
);

comment on table public.profiles is 'Minimal application profile for a Supabase Auth user.';
comment on column public.profiles.id is 'One-to-one owner key. PK and FK to auth.users.id.';
comment on column public.profiles.nickname is 'Public display name chosen during signup.';
comment on column public.profiles.birth_date is 'Private source date used to calculate current Korean full age.';
comment on column public.profiles.neighborhood is 'Default activity neighborhood.';
comment on column public.profiles.avatar_url is 'Optional profile image URL for a later profile feature.';
comment on column public.profiles.bio is 'Optional introduction for a later profile feature.';
comment on column public.profiles.created_at is 'Time basic profile registration completed.';
comment on column public.profiles.updated_at is 'Time profile data was last changed.';

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_profiles_updated_at() from public;
revoke all on function public.set_profiles_updated_at() from anon;
revoke all on function public.set_profiles_updated_at() from authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
