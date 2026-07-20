-- Add INSERT policy for users table to allow users to create their own record
create policy "users_insert_own"
  on public.video_users for insert
  with check (auth.uid() = id);

