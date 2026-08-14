insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adventure-photos',
  'adventure-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload adventure photos" on storage.objects;
drop policy if exists "Members read permitted adventure photos" on storage.objects;
drop policy if exists "Members delete own adventure photos" on storage.objects;

create policy "Members upload adventure photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Members read permitted adventure photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'adventure-photos'
  and (
    owner_id = (select auth.uid()::text)
    or exists (
      select 1
      from public.adventure_memory_photos p
      where p.image_url = storage.objects.name
        and (
          p.profile_id = (select auth.uid())
          or (
            p.moderation_status = 'approved'
            and p.visibility = 'group'
            and public.is_paid_adventure_attendee(p.adventure_id, (select auth.uid()))
          )
        )
    )
  )
);

create policy "Members delete own adventure photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'adventure-photos'
  and owner_id = (select auth.uid()::text)
);
