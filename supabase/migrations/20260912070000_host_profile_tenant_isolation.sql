-- Host Center setup/preferences were historically keyed only by profile_id.
-- A person can now work in multiple platform organizations, so these records must
-- be owned by the active organization instead of following the person globally.

alter table public.host_center_profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- Existing Host Center setup belongs to the original Go Melanated tenant.
-- Restore the canonical organization name while assigning that ownership so a
-- test-tenant label cannot remain attached to the Go Melanated setup row.
update public.host_center_profiles hcp
set organization_id = default_org.id,
    organization_name = default_org.name
from lateral (
  select o.id, o.name
  from public.organizations o
  where o.is_platform_default = true
  order by o.created_at
  limit 1
) default_org
where hcp.organization_id is null;

alter table public.host_center_profiles
  alter column organization_id set not null;

alter table public.host_center_profiles
  drop constraint if exists host_center_profiles_pkey;
alter table public.host_center_profiles
  add constraint host_center_profiles_pkey primary key (organization_id, profile_id);

create index if not exists host_center_profiles_profile_idx
  on public.host_center_profiles (profile_id);

-- The current user may only see or change their Host Center setup row for the
-- organization they have actively selected.
drop policy if exists "Hosts can read own Host Center profile" on public.host_center_profiles;
drop policy if exists "Hosts can create own Host Center profile" on public.host_center_profiles;
drop policy if exists "Hosts can update own Host Center profile" on public.host_center_profiles;

create policy "Hosts can read active organization Host Center profile"
on public.host_center_profiles
for select to authenticated
using (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
);

create policy "Hosts can create active organization Host Center profile"
on public.host_center_profiles
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
  and public.is_approved_outing_host((select auth.uid()))
);

create policy "Hosts can update active organization Host Center profile"
on public.host_center_profiles
for update to authenticated
using (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
)
with check (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
  and public.is_approved_outing_host((select auth.uid()))
);

comment on column public.host_center_profiles.organization_id is
  'Platform organization that owns this Host Center setup/preferences row.';