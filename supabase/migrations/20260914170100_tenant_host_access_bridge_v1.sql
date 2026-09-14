-- Tenant Host Access Bridge V1
-- Legacy Go Melanated hosting approval remains authoritative in the platform-default
-- tenant. Non-default client tenants use organization RBAC instead.

create or replace function public.is_approved_outing_host(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.outing_hosts oh
      where oh.profile_id = p_profile_id
        and oh.status = 'approved'
    )
    or exists (
      select 1
      from public.organizations o
      where o.id = private.active_organization_for_profile(p_profile_id)
        and o.status = 'active'
        and o.is_platform_default = false
        and private.has_organization_permission(o.id, 'events.manage', p_profile_id)
    );
$$;

grant execute on function public.is_approved_outing_host(uuid) to authenticated;

-- Opportunities are private tenant work records. The old policy mixed an
-- account-level host approval with tenant ownership. Replace it with active-tenant
-- RBAC so non-default clients do not depend on Go Melanated host approval.
drop policy if exists "Hosts read own opportunities" on public.host_opportunities;
drop policy if exists "Hosts create own opportunities" on public.host_opportunities;
drop policy if exists "Hosts update own opportunities" on public.host_opportunities;
drop policy if exists "Hosts delete own opportunities" on public.host_opportunities;

create policy "Active tenant hosts read opportunities"
on public.host_opportunities
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.view', (select auth.uid()))
);

create policy "Active tenant hosts create opportunities"
on public.host_opportunities
for insert
to authenticated
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
);

create policy "Active tenant hosts update opportunities"
on public.host_opportunities
for update
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
);

create policy "Active tenant hosts delete opportunities"
on public.host_opportunities
for delete
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
);

notify pgrst, 'reload schema';
