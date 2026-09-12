-- Scope Host Center operational access to the profile's active organization.
-- Platform operators still retain authority, but must switch into a tenant before
-- reading or mutating that tenant's operational records.

create or replace function app_private.can_access_host_campaign(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.host_campaigns c
      where c.id = target_campaign
        and c.organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          app_private.is_master_account()
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.platform_role = 'admin'
          )
          or c.owner_profile_id = (select auth.uid())
          or exists (
            select 1
            from public.adventure_staff_assignments asa
            where asa.adventure_id = c.adventure_id
              and asa.profile_id = (select auth.uid())
          )
        )
    );
$$;

create or replace function app_private.can_manage_host_campaign(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.host_campaigns c
      where c.id = target_campaign
        and c.organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          app_private.is_master_account()
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.platform_role = 'admin'
          )
          or c.owner_profile_id = (select auth.uid())
          or exists (
            select 1
            from public.adventure_staff_assignments asa
            where asa.adventure_id = c.adventure_id
              and asa.profile_id = (select auth.uid())
              and asa.role = 'lead'
          )
        )
    );
$$;

-- Campaign creation must land in the caller's active organization.
drop policy if exists "Campaign managers can create campaigns" on public.host_campaigns;
create policy "Campaign managers can create campaigns"
on public.host_campaigns
for insert
to authenticated
with check (
  owner_profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    (select public.is_platform_admin())
    or exists (
      select 1
      from public.adventures a
      where a.id = host_campaigns.adventure_id
        and a.created_by = (select auth.uid())
    )
  )
);

-- Opportunities were historically scoped only by profile owner. A person can now
-- belong to multiple organizations, so organization ownership is required too.
drop policy if exists "Hosts read own opportunities" on public.host_opportunities;
create policy "Hosts read own opportunities"
on public.host_opportunities
for select
to authenticated
using (
  (select auth.uid()) = owner_profile_id
  and organization_id = private.active_organization_for_profile((select auth.uid()))
);

drop policy if exists "Hosts insert own opportunities" on public.host_opportunities;
create policy "Hosts insert own opportunities"
on public.host_opportunities
for insert
to authenticated
with check (
  (select auth.uid()) = owner_profile_id
  and organization_id = private.active_organization_for_profile((select auth.uid()))
  and public.is_approved_outing_host((select auth.uid()))
);

drop policy if exists "Hosts update own opportunities" on public.host_opportunities;
create policy "Hosts update own opportunities"
on public.host_opportunities
for update
to authenticated
using (
  (select auth.uid()) = owner_profile_id
  and organization_id = private.active_organization_for_profile((select auth.uid()))
)
with check (
  (select auth.uid()) = owner_profile_id
  and organization_id = private.active_organization_for_profile((select auth.uid()))
);

drop policy if exists "Hosts delete own opportunities" on public.host_opportunities;
create policy "Hosts delete own opportunities"
on public.host_opportunities
for delete
to authenticated
using (
  (select auth.uid()) = owner_profile_id
  and organization_id = private.active_organization_for_profile((select auth.uid()))
);
