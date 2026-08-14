insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = true;

create policy "Profile avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'profile-avatars');

create policy "Members can upload their own profile avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Members can update their own profile avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Members can delete their own profile avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
