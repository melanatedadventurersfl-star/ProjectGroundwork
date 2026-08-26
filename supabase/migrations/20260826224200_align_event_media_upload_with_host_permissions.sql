drop policy if exists "Trusted hosts upload event media" on storage.objects;

create policy "Eligible hosts upload event media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    public.can_create_local_event()
    or exists (
      select 1
      from public.local_events le
      where le.host_id = (select auth.uid())
        and (
          le.group_id is null
          or public.can_create_group_campfire(le.group_id)
        )
    )
  )
);
