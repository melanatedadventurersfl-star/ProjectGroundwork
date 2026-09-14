-- Tenant Adventure Management RLS V1
-- Align adventures with platform organization RBAC used by Host Center.

create policy "Organization event teams read tenant adventures"
on public.adventures for select to authenticated
using (
  platform_organization_id is not null
  and platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'events.view',
    (select auth.uid())
  )
);

create policy "Organization event managers create tenant adventures"
on public.adventures for insert to authenticated
with check (
  created_by = (select auth.uid())
  and platform_organization_id is not null
  and platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'events.manage',
    (select auth.uid())
  )
  and is_featured = false
);

create policy "Organization event managers update tenant adventures"
on public.adventures for update to authenticated
using (
  platform_organization_id is not null
  and platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'events.manage',
    (select auth.uid())
  )
)
with check (
  platform_organization_id is not null
  and platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'events.manage',
    (select auth.uid())
  )
  and is_featured = false
);

create policy "Organization event managers delete tenant draft adventures"
on public.adventures for delete to authenticated
using (
  platform_organization_id is not null
  and platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and status in ('draft', 'scheduled')
  and private.has_organization_permission(
    platform_organization_id,
    'events.manage',
    (select auth.uid())
  )
);

notify pgrst, 'reload schema';
