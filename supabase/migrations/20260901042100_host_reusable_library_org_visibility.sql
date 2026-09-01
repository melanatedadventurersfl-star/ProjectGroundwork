drop policy if exists "Hosts can read reusable library" on public.host_library_items;

create policy "Hosts can read reusable library" on public.host_library_items
for select to authenticated
using (
  is_active
  and (
    scope in ('system','organization')
    or owner_profile_id = (select auth.uid())
    or (select is_platform_admin())
    or (select app_private.is_master_account())
  )
);
