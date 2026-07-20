-- Migration 013: Fix video_processed_webhook_events.user_id foreign key
--
-- 010_create_processed_webhook_events.sql pointed this column at public.users,
-- which belongs to a different project sharing this Supabase instance — not
-- this app's user table (public.video_users). Repoint the FK at the correct
-- table.

alter table public.video_processed_webhook_events
  drop constraint if exists video_processed_webhook_events_user_id_fkey;

alter table public.video_processed_webhook_events
  add constraint video_processed_webhook_events_user_id_fkey
  foreign key (user_id) references public.video_users(id) on delete set null;
