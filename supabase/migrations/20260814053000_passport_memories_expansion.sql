-- Passport Memories expansion: richer personal scrapbook metadata and privacy.

alter table public.adventure_memory_photos
  add column if not exists reflection text,
  add column if not exists featured boolean not null default false,
  add column if not exists source_kind text not null default 'personal',
  add column if not exists source_photo_id text,
  add column if not exists media_type text not null default 'photo';

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_visibility_check;
alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_visibility_check
  check (visibility in ('private', 'group', 'public'));

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_source_kind_check;
alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_source_kind_check
  check (source_kind in ('personal', 'event_gallery'));

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_media_type_check;
alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_media_type_check
  check (media_type in ('photo', 'video'));

create unique index if not exists adventure_memory_photos_saved_source_unique
  on public.adventure_memory_photos (profile_id, adventure_id, source_photo_id)
  where source_kind = 'event_gallery' and source_photo_id is not null;

create index if not exists adventure_memory_photos_featured_idx
  on public.adventure_memory_photos (profile_id, featured, created_at desc);

drop policy if exists "Members read their memory photos" on public.adventure_memory_photos;
create policy "Members read their memory photos"
on public.adventure_memory_photos for select to authenticated
using (
  profile_id = auth.uid()
  or visibility = 'public'
  or (visibility = 'group' and public.is_paid_adventure_attendee(adventure_id, auth.uid()))
);

drop policy if exists "Members update their memory photos" on public.adventure_memory_photos;
create policy "Members update their memory photos"
on public.adventure_memory_photos for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

grant update on public.adventure_memory_photos to authenticated;
