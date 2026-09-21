-- Remote migration version: 20260917141449.
-- Forward-only performance follow-up for the notification -> join request foreign key.
-- Existing rows are not modified or deleted.
create index notifications_join_request_idx
on public.notifications (join_request_id);
