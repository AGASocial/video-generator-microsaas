-- Migration 012: Add an isolated auth trigger that creates public.video_users rows
--
-- This Supabase project is shared with another app that already owns a trigger
-- named on_auth_user_created on auth.users (inserts into public.users, not ours).
-- 002_create_user_trigger.sql used that same generic trigger/function name, which
-- risks one project's DROP TRIGGER IF EXISTS silently deleting the other's trigger
-- on next run. Postgres allows multiple independent AFTER INSERT triggers on the
-- same table, so instead of renaming/touching the existing on_auth_user_created
-- trigger (unknown ownership from this migration's point of view), we add a
-- second, uniquely-named trigger that only ever manages itself.

create or replace function public.handle_new_video_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.video_users (id, email, credits)
  values (
    new.id,
    new.email,
    0
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Safe: this name is unique to this project, so it can only ever be our own
-- trigger from a prior run of this same migration.
drop trigger if exists on_auth_video_user_created on auth.users;

create trigger on_auth_video_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_video_user();
