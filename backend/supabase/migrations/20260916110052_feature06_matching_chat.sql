-- Remote migration version: 20260916110052 (applied through the project-scoped Supabase MCP).
-- Feature 6: matching chat keyed by join_request_id. Participants read; senders insert their own messages.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  join_request_id uuid not null references public.join_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_length check (content = btrim(content) and char_length(content) between 1 and 1000)
);

comment on table public.chat_messages is 'Immutable text messages of a join request conversation. id is client-generated for retry de-duplication.';
comment on column public.chat_messages.sender_id is 'Must equal auth.uid(); enforced by RLS WITH CHECK.';
comment on column public.chat_messages.created_at is 'Server time; ordering key together with id.';

create index chat_messages_conversation_idx on public.chat_messages (join_request_id, created_at desc, id desc);
create index chat_messages_sender_idx on public.chat_messages (sender_id);

-- Sending window for feature 6: pending request, post not deleted, meetup not started.
create function private.can_send_message(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.join_requests r
    join public.posts p on p.id = r.post_id
    where r.id = p_request_id
      and (r.requester_id = (select auth.uid()) or p.author_id = (select auth.uid()))
      and r.status = 'pending'
      and p.status <> 'deleted'
      and now() < p.starts_at
  );
$$;
revoke all on function private.can_send_message(uuid) from public, anon;
grant execute on function private.can_send_message(uuid) to authenticated;

alter table public.chat_messages enable row level security;
revoke all on table public.chat_messages from anon, authenticated;
grant select on table public.chat_messages to authenticated;
grant insert (id, join_request_id, sender_id, content) on table public.chat_messages to authenticated;

create policy chat_messages_select_participants on public.chat_messages
for select to authenticated
using ((select private.request_role(join_request_id)) is not null);

create policy chat_messages_insert_own_open on public.chat_messages
for insert to authenticated
with check (sender_id = (select auth.uid()) and (select private.can_send_message(join_request_id)));

-- Conversation header. Unknown or foreign request ids raise the same generic error.
create function public.get_conversation(p_request_id uuid)
returns table (
  request_id uuid, my_role text, request_status text, request_message text, request_created_at timestamptz,
  post_id uuid, post_title text, post_starts_at timestamptz, post_ends_at timestamptz, post_public_area text, post_status text,
  counterpart_masked_name text, counterpart_avatar_url text, can_send boolean, appointment_id uuid, server_now timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.request_role(p_request_id);
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'request_unavailable' using errcode = 'P0002';
  end if;
  return query
    select r.id, v_role, r.status, r.message, r.created_at,
           p.id, p.title, p.starts_at, p.ends_at, p.public_area, p.status,
           public.mask_real_name(pr.real_name), pr.avatar_url,
           private.can_send_message(r.id), null::uuid, now()
    from public.join_requests r
    join public.posts p on p.id = r.post_id
    join public.profiles pr on pr.id = case when v_role = 'requester' then p.author_id else r.requester_id end
    where r.id = p_request_id;
end;
$$;

create function public.list_conversations()
returns table (
  request_id uuid, my_role text, request_status text, post_id uuid, post_title text, post_starts_at timestamptz,
  counterpart_masked_name text, counterpart_avatar_url text, last_message text, last_message_at timestamptz, last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         case when r.requester_id = (select auth.uid()) then 'requester' else 'author' end,
         r.status, p.id, p.title, p.starts_at,
         public.mask_real_name(pr.real_name), pr.avatar_url,
         m.content, m.created_at, greatest(r.updated_at, coalesce(m.created_at, r.created_at))
  from public.join_requests r
  join public.posts p on p.id = r.post_id
  join public.profiles pr on pr.id = case when r.requester_id = (select auth.uid()) then p.author_id else r.requester_id end
  left join lateral (
    select cm.content, cm.created_at from public.chat_messages cm
    where cm.join_request_id = r.id order by cm.created_at desc, cm.id desc limit 1
  ) m on true
  where (r.requester_id = (select auth.uid()) or p.author_id = (select auth.uid()))
    and p.status <> 'deleted'
  order by 11 desc;
$$;

revoke all on function public.get_conversation(uuid) from public, anon;
revoke all on function public.list_conversations() from public, anon;
grant execute on function public.get_conversation(uuid) to authenticated;
grant execute on function public.list_conversations() to authenticated;

-- Realtime delivery; postgres_changes events are filtered by the SELECT policies above.
alter publication supabase_realtime add table public.chat_messages, public.join_requests;
