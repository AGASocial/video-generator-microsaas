-- Migration 014: Backfill video_users for existing auth.users rows
--
-- The on_auth_video_user_created trigger (012) only fires on new signups going
-- forward. This one-time backfill mirrors its logic for auth.users rows that
-- already existed before the trigger was created. Safe to re-run — ON CONFLICT
-- DO NOTHING skips rows that already have a video_users profile.
--
-- NOTE: auth.users is shared with another project on this Supabase instance,
-- so this will also create a (harmless, 0-credit) video_users row for any user
-- who only ever signed up for the other app. RLS still isolates each row to
-- its owner, so this carries no access/privacy risk — just extra rows.

insert into public.video_users (id, email, credits)
select id, email, 0
from auth.users
on conflict (id) do nothing;
