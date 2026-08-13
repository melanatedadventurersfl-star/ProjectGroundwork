drop policy if exists "Members read their memory photos" on public.adventure_memory_photos;

create policy "Members read permitted memory photos"
on public.adventure_memory_photos for select
using (
  profile_id = auth.uid()
  or (
    visibility = 'group'
    and exists (
      select 1
      from public.community_groups g
      where g.adventure_id = adventure_memory_photos.adventure_id
        and public.is_group_member(g.id)
    )
  )
);
