-- Remote migration version: 20260917122744.
-- UT follow-up: persistent join-request notifications and authenticated discovery metadata.
-- Additive only: existing product rows are not changed, deleted, or backfilled.
-- Notifications begin with join requests inserted after this migration is applied.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  join_request_id uuid not null references public.join_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_kind_allowed check (kind in ('join_request')),
  constraint notifications_join_request_unique unique (recipient_id, kind, join_request_id)
);

comment on table public.notifications is 'Private, recipient-scoped service notifications. Message bodies are derived from authorized request/post rows.';
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;

create policy notifications_select_recipient on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()));

create function private.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, kind, join_request_id, created_at)
  select p.author_id, 'join_request', new.id, new.created_at
  from public.posts p
  where p.id = new.post_id
  on conflict (recipient_id, kind, join_request_id) do nothing;
  return new;
end;
$$;
revoke all on function private.notify_join_request() from public, anon, authenticated;

create trigger join_requests_create_notification
after insert on public.join_requests
for each row execute function private.notify_join_request();

create function public.mark_my_notification_read(p_notification_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = auth.uid();
end;
$$;
revoke all on function public.mark_my_notification_read(uuid) from public, anon;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;

create function public.mark_all_my_notifications_read()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
end;
$$;
revoke all on function public.mark_all_my_notifications_read() from public, anon;
grant execute on function public.mark_all_my_notifications_read() to authenticated;

-- Authenticated list metadata: masked name, image path, gender and current full age.
-- Birth date, phone number and exact place are never returned.
create function public.get_post_author_discovery_cards(p_post_ids uuid[])
returns table (post_id uuid, author_id uuid, masked_name text, avatar_url text, gender text, age integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  return query
    select p.id, p.author_id, public.mask_real_name(pr.real_name), pr.avatar_url, pr.gender, public.korean_age(pr.birth_date)
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = any (coalesce(p_post_ids, '{}')) and p.status <> 'deleted'
    limit 200;
end;
$$;
revoke all on function public.get_post_author_discovery_cards(uuid[]) from public, anon;
grant execute on function public.get_post_author_discovery_cards(uuid[]) to authenticated;

alter publication supabase_realtime add table public.notifications;
