-- Host profile/configuration records were historically keyed only by profile_id.
-- A person can now work in multiple platform organizations, so those records must
-- be owned by the active organization instead of following the person globally.

alter table public.host_center_profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.host_profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- Existing Host Center and host-profile rows belong to the original Go Melanated
-- tenant. New rows are created against the caller's active organization in app code
-- and are enforced by RLS below.
update public.host_center_profiles hcp
set organization_id = default_org.id
from lateral (
  select o.id
  from public.organizations o
  where o.is_platform_default = true
  order by o.created_at
  limit 1
) default_org
where hcp.organization_id is null;

update public.host_profiles hp
set organization_id = default_org.id
from lateral (
  select o.id
  from public.organizations o
  where o.is_platform_default = true
  order by o.created_at
  limit 1
) default_org
where hp.organization_id is null;

alter table public.host_center_profiles
  alter column organization_id set not null;

alter table public.host_profiles
  alter column organization_id set not null;

alter table public.host_center_profiles
  drop constraint if exists host_center_profiles_pkey;
alter table public.host_center_profiles
  add constraint host_center_profiles_pkey primary key (organization_id, profile_id);

alter table public.host_profiles
  drop constraint if exists host_profiles_pkey;
alter table public.host_profiles
  add constraint host_profiles_pkey primary key (organization_id, profile_id);

create index if not exists host_center_profiles_profile_idx
  on public.host_center_profiles (profile_id);
create index if not exists host_profiles_profile_idx
  on public.host_profiles (profile_id);

-- Host Center profile rows are private operational preferences. The current user
-- may only see or change the row for the organization they have actively selected.
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

-- A public host profile is also tenant-owned. Even a public row is only exposed
-- through the viewer's active organization so one tenant cannot surface another
-- tenant's host identity.
drop policy if exists "Public host profiles are readable" on public.host_profiles;
drop policy if exists "Hosts manage their profile" on public.host_profiles;

create policy "Active organization host profiles are readable"
on public.host_profiles
for select to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (is_public or profile_id = (select auth.uid()))
);

create policy "Hosts manage active organization profile"
on public.host_profiles
for all to authenticated
using (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
)
with check (
  profile_id = (select auth.uid())
  and organization_id = private.active_organization_for_profile((select auth.uid()))
);

comment on column public.host_center_profiles.organization_id is
  'Platform organization that owns this Host Center setup/preferences row.';
comment on column public.host_profiles.organization_id is
  'Platform organization that owns this public host identity row.';