-- Allow Passport memories to be added for historical/seeded stamps that are
-- legitimately owned by the current member, even when no paid order exists.
-- This keeps the existing ownership and moderation requirements intact.

drop policy if exists "Members add their memory photos" on public.adventure_memory_photos;

create policy "Members add their memory photos"
on public.adventure_memory_photos
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and (
    public.is_paid_adventure_attendee(adventure_id, auth.uid())
    or exists (
      select 1
      from public.member_passport_stamps mps
      where mps.profile_id = auth.uid()
        and mps.adventure_id = adventure_memory_photos.adventure_id
    )
  )
  and moderation_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);
