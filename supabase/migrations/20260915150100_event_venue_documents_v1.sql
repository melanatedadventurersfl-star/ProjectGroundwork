drop policy if exists "Organization event managers upload venue documents" on storage.objects;
create policy "Organization event managers upload venue documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'venue-docs'
  and exists (
    select 1
    from public.adventures a
    where a.id = ((storage.foldername(name))[3])::uuid
      and a.platform_organization_id is not null
      and private.has_organization_permission(
        a.platform_organization_id,
        'events.manage',
        (select auth.uid())
      )
  )
);

drop policy if exists "Organization event managers delete venue documents" on storage.objects;
create policy "Organization event managers delete venue documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'venue-docs'
  and exists (
    select 1
    from public.adventures a
    where a.id = ((storage.foldername(name))[3])::uuid
      and a.platform_organization_id is not null
      and private.has_organization_permission(
        a.platform_organization_id,
        'events.manage',
        (select auth.uid())
      )
  )
);
