-- NOTE: this Supabase project is shared with another app that also owns a
-- trigger named on_auth_user_created on auth.users. Do not re-run the DROP/CREATE
-- below expecting it to be safe — see 012_add_isolated_video_users_trigger.sql
-- (trigger: on_auth_video_user_created) for the isolated, collision-safe version
-- that supersedes this file going forward.

-- Create function to auto-create user profile on signup
create or replace function public.handle_new_user()
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

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger to run function when new user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
