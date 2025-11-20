-- Create storage bucket for video reference images
insert into storage.buckets (id, name, public)
values ('video-images', 'video-images', true)
on conflict (id) do nothing;

-- Set up storage policies
create policy "Allow authenticated users to upload images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'video-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Allow public access to images"
on storage.objects for select
to public
using (bucket_id = 'video-images');

create policy "Allow users to delete their own images"
on storage.objects for delete
to authenticated
using (bucket_id = 'video-images' and auth.uid()::text = (storage.foldername(name))[1]);
