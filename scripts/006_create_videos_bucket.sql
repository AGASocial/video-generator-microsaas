-- Create storage bucket for videos
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

-- Set up storage policies for videos bucket
-- Allow authenticated users to upload videos to their own folder
create policy "Allow authenticated users to upload videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to videos (for viewing)
create policy "Allow public access to videos"
on storage.objects for select
to public
using (bucket_id = 'videos');

-- Allow users to delete their own videos
create policy "Allow users to delete their own videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

