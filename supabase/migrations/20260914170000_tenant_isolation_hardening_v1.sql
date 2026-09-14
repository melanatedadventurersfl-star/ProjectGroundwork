-- Tenant Isolation Hardening V1
-- The active platform organization is the private Host Center boundary.
-- Public host profiles remain globally readable only when explicitly published.

-- ---------------------------------------------------------------------------
-- Host identities belong to an existing platform organization.
-- Editing a public host identity must never create, rename, or rebrand a tenant.
-- ---------------------------------------------------------------------------

update public.host_organizations h
set platform_organization_id = coalesce(
  private.active_organization_for_profile(h.created_by),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where h.platform_organization_id is null;

alter table public.host_organizations
  alter column platform_organization_id set not null;

create or replace function private.sync_host_organization_platform()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  v_profile := coalesce(new.created_by, auth.uid());

  if new.platform_organization_id is null then
    new.platform_organization_id := private.active_organization_for_profile(v_profile);
  end if;

  if new.platform_organization_id is null then
    select id into new.platform_organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  if new.platform_organization_id is null then
    raise exception 'A platform organization is required for every host profile';
  end if;

  if v_profile is not null
    and not private.is_organization_member(new.platform_organization_id, v_profile)
    and not private.is_platform_operator(v_profile)
  then
    raise exception 'Host profile owner does not belong to the selected organization';
  end if;

  -- Intentionally do not update public.organizations here. A tenant can own multiple
  -- public brands/host profiles, so public-profile edits cannot mutate tenant identity.
  return new;
end;
$$;

revoke all on function private.sync_host_organization_platform() from public;

-- Keep the existing compatibility trigger name, but its function now only validates
-- and assigns tenant ownership. It no longer provisions a tenant as a side effect.
drop trigger if exists host_organizations_sync_platform on public.host_organizations;
create trigger host_organizations_sync_platform
before insert or update of name, is_public, logo_url, cover_image_url, website_url,
  tagline, public_email, phone, instagram_url, facebook_url, platform_organization_id
on public.host_organizations
for each row execute function private.sync_host_organization_platform();

-- Private Host Center reads must use the active tenant. Published profiles remain
-- public so visitor/profile routes continue to work across tenant boundaries.
drop policy if exists "Public host organizations are readable" on public.host_organizations;
drop policy if exists "Organization creators manage organizations" on public.host_organizations;
drop policy if exists "Organization owners and admins manage organizations" on public.host_organizations;

create policy "Published or active tenant host organizations are readable"
on public.host_organizations
for select
to authenticated
using (
  is_public
  or (
    platform_organization_id = private.active_organization_for_profile((select auth.uid()))
    and private.is_organization_member(platform_organization_id, (select auth.uid()))
  )
);

create policy "Active tenant managers manage host organizations"
on public.host_organizations
for all
to authenticated
using (
  platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'organization.settings.manage',
    (select auth.uid())
  )
)
with check (
  platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'organization.settings.manage',
    (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Host profile imports carry both the public host identity and platform tenant.
-- ---------------------------------------------------------------------------

alter table public.host_profile_imports
  add column if not exists platform_organization_id uuid references public.organizations(id) on delete restrict;

update public.host_profile_imports i
set platform_organization_id = h.platform_organization_id
from public.host_organizations h
where h.id = i.organization_id
  and i.platform_organization_id is null;

alter table public.host_profile_imports
  alter column platform_organization_id set not null;

create index if not exists host_profile_imports_platform_org_idx
  on public.host_profile_imports(platform_organization_id, created_at desc);

create or replace function private.inherit_host_profile_import_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select h.platform_organization_id
    into new.platform_organization_id
  from public.host_organizations h
  where h.id = new.organization_id;

  if new.platform_organization_id is null then
    raise exception 'Host profile tenant could not be resolved';
  end if;

  return new;
end;
$$;

revoke all on function private.inherit_host_profile_import_tenant() from public;
drop trigger if exists host_profile_imports_inherit_tenant on public.host_profile_imports;
create trigger host_profile_imports_inherit_tenant
before insert or update of organization_id, platform_organization_id
on public.host_profile_imports
for each row execute function private.inherit_host_profile_import_tenant();

drop policy if exists "Organization teams read profile imports" on public.host_profile_imports;
drop policy if exists "Organization owners and admins manage profile imports" on public.host_profile_imports;

create policy "Active tenant teams read profile imports"
on public.host_profile_imports
for select
to authenticated
using (
  platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'organization.view',
    (select auth.uid())
  )
);

create policy "Active tenant managers manage profile imports"
on public.host_profile_imports
for all
to authenticated
using (
  platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'organization.settings.manage',
    (select auth.uid())
  )
)
with check (
  platform_organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(
    platform_organization_id,
    'organization.settings.manage',
    (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Host media management is limited to the active tenant. Public media read policies
-- remain intact. This policy only controls mutation rights.
-- ---------------------------------------------------------------------------

drop policy if exists "Hosts manage their media" on public.host_media;
drop policy if exists "Hosts and organization admins manage media" on public.host_media;

create policy "Active tenant teams manage host media"
on public.host_media
for all
to authenticated
using (
  (
    organization_id is not null
    and exists (
      select 1
      from public.host_organizations h
      where h.id = host_media.organization_id
        and h.platform_organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          host_media.owner_profile_id = (select auth.uid())
          or private.has_organization_permission(
            h.platform_organization_id,
            'files.manage',
            (select auth.uid())
          )
        )
    )
  )
  or (
    adventure_id is not null
    and exists (
      select 1
      from public.adventures a
      where a.id = host_media.adventure_id
        and a.platform_organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          host_media.owner_profile_id = (select auth.uid())
          or private.has_organization_permission(
            a.platform_organization_id,
            'files.manage',
            (select auth.uid())
          )
        )
    )
  )
)
with check (
  (
    organization_id is not null
    and exists (
      select 1
      from public.host_organizations h
      where h.id = host_media.organization_id
        and h.platform_organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          host_media.owner_profile_id = (select auth.uid())
          or private.has_organization_permission(
            h.platform_organization_id,
            'files.manage',
            (select auth.uid())
          )
        )
    )
  )
  or (
    adventure_id is not null
    and exists (
      select 1
      from public.adventures a
      where a.id = host_media.adventure_id
        and a.platform_organization_id = private.active_organization_for_profile((select auth.uid()))
        and (
          host_media.owner_profile_id = (select auth.uid())
          or private.has_organization_permission(
            a.platform_organization_id,
            'files.manage',
            (select auth.uid())
          )
        )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Vendor Center records are private tenant business records. A cross-tenant public
-- marketplace should use a separate publishable catalog instead of exposing this table.
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read vendor profiles" on public.host_vendor_profiles;
drop policy if exists "Vendor owners and admins can create vendor profiles" on public.host_vendor_profiles;
drop policy if exists "Vendor owners and admins can update vendor profiles" on public.host_vendor_profiles;
drop policy if exists "Vendor owners and admins can delete vendor profiles" on public.host_vendor_profiles;

create policy "Active tenant teams read vendor profiles"
on public.host_vendor_profiles
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'vendors.view', (select auth.uid()))
);

create policy "Active tenant managers create vendor profiles"
on public.host_vendor_profiles
for insert
to authenticated
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'vendors.manage', (select auth.uid()))
);

create policy "Active tenant managers update vendor profiles"
on public.host_vendor_profiles
for update
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'vendors.manage', (select auth.uid()))
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'vendors.manage', (select auth.uid()))
);

create policy "Active tenant managers delete vendor profiles"
on public.host_vendor_profiles
for delete
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'vendors.manage', (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- Reusable library items are tenant-scoped, including records historically called
-- system items. This stops Go Melanated camping starters from becoming another
-- client's implicit defaults.
-- ---------------------------------------------------------------------------

drop policy if exists "Hosts can read reusable library" on public.host_library_items;
drop policy if exists "Hosts can create personal library items" on public.host_library_items;
drop policy if exists "Hosts can update owned library items" on public.host_library_items;
drop policy if exists "Hosts can delete owned library items" on public.host_library_items;

create policy "Active tenant teams read reusable library"
on public.host_library_items
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and is_active
  and (
    scope in ('system','organization')
    or owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

create policy "Active tenant teams create reusable library"
on public.host_library_items
for insert
to authenticated
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    (scope = 'personal' and owner_profile_id = (select auth.uid()))
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

create policy "Active tenant teams update reusable library"
on public.host_library_items
for update
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

create policy "Active tenant teams delete reusable library"
on public.host_library_items
for delete
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

-- ---------------------------------------------------------------------------
-- Communication templates and event-import staging data follow the same tenant.
-- ---------------------------------------------------------------------------

drop policy if exists "Owners can read communication templates" on public.host_communication_templates;
drop policy if exists "Owners can manage communication templates" on public.host_communication_templates;

create policy "Active tenant teams read communication templates"
on public.host_communication_templates
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'communications.view', (select auth.uid()))
);

create policy "Active tenant teams manage communication templates"
on public.host_communication_templates
for all
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'communications.send', (select auth.uid()))
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and private.has_organization_permission(organization_id, 'communications.send', (select auth.uid()))
);

drop policy if exists "Hosts read own event imports" on public.host_event_imports;
drop policy if exists "Hosts create own event imports" on public.host_event_imports;
drop policy if exists "Hosts update own event imports" on public.host_event_imports;
drop policy if exists "Hosts delete own event imports" on public.host_event_imports;

create policy "Active tenant hosts read event imports"
on public.host_event_imports
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'events.view', (select auth.uid()))
  )
);

create policy "Active tenant hosts create event imports"
on public.host_event_imports
for insert
to authenticated
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
);

create policy "Active tenant hosts update event imports"
on public.host_event_imports
for update
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
  )
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
  )
);

create policy "Active tenant hosts delete event imports"
on public.host_event_imports
for delete
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
  )
);

drop policy if exists "Hosts read own import files" on public.host_event_import_files;
drop policy if exists "Hosts create own import files" on public.host_event_import_files;
drop policy if exists "Hosts update own import files" on public.host_event_import_files;
drop policy if exists "Hosts delete own import files" on public.host_event_import_files;

create policy "Active tenant hosts read import files"
on public.host_event_import_files
for select
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.view', (select auth.uid()))
  )
);

create policy "Active tenant hosts create import files"
on public.host_event_import_files
for insert
to authenticated
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and owner_profile_id = (select auth.uid())
  and private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
);

create policy "Active tenant hosts update import files"
on public.host_event_import_files
for update
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
)
with check (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

create policy "Active tenant hosts delete import files"
on public.host_event_import_files
for delete
to authenticated
using (
  organization_id = private.active_organization_for_profile((select auth.uid()))
  and (
    owner_profile_id = (select auth.uid())
    or private.has_organization_permission(organization_id, 'files.manage', (select auth.uid()))
  )
);

-- ---------------------------------------------------------------------------
-- Storage keeps legacy user-prefixed paths for existing member/event workflows.
-- New Host Center paths begin with tenants/<platform-org>/... and are active-tenant
-- scoped. Uploaders are always encoded at folder position 6.
-- ---------------------------------------------------------------------------

drop policy if exists "Host teams upload active tenant media" on storage.objects;
create policy "Host teams upload active tenant media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'tenants'
  and (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
  and (storage.foldername(name))[6] = (select auth.uid())::text
  and private.is_organization_member(
    private.active_organization_for_profile((select auth.uid())),
    (select auth.uid())
  )
);

drop policy if exists "Host teams read active tenant media" on storage.objects;
create policy "Host teams read active tenant media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'tenants'
  and (
    (
      (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
      and private.is_organization_member(
        private.active_organization_for_profile((select auth.uid())),
        (select auth.uid())
      )
    )
    or exists (
      select 1
      from public.host_media hm
      join public.host_organizations h on h.id = hm.organization_id
      where hm.image_url = storage.objects.name
        and h.is_public = true
    )
  )
);

drop policy if exists "Host teams delete active tenant media" on storage.objects;
create policy "Host teams delete active tenant media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'adventure-photos'
  and (storage.foldername(name))[1] = 'tenants'
  and (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
  and (
    (storage.foldername(name))[6] = (select auth.uid())::text
    or private.has_organization_permission(
      private.active_organization_for_profile((select auth.uid())),
      'files.manage',
      (select auth.uid())
    )
  )
);

drop policy if exists "Host teams upload active tenant imports" on storage.objects;
create policy "Host teams upload active tenant imports"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-imports'
  and (storage.foldername(name))[1] = 'tenants'
  and (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
  and (storage.foldername(name))[6] = (select auth.uid())::text
  and private.has_organization_permission(
    private.active_organization_for_profile((select auth.uid())),
    'files.manage',
    (select auth.uid())
  )
);

drop policy if exists "Host teams read active tenant imports" on storage.objects;
create policy "Host teams read active tenant imports"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-imports'
  and (storage.foldername(name))[1] = 'tenants'
  and (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
  and (
    (storage.foldername(name))[6] = (select auth.uid())::text
    or private.has_organization_permission(
      private.active_organization_for_profile((select auth.uid())),
      'files.view',
      (select auth.uid())
    )
  )
);

drop policy if exists "Host teams delete active tenant imports" on storage.objects;
create policy "Host teams delete active tenant imports"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-imports'
  and (storage.foldername(name))[1] = 'tenants'
  and (storage.foldername(name))[2] = private.active_organization_for_profile((select auth.uid()))::text
  and (
    (storage.foldername(name))[6] = (select auth.uid())::text
    or private.has_organization_permission(
      private.active_organization_for_profile((select auth.uid())),
      'files.manage',
      (select auth.uid())
    )
  )
);

-- ---------------------------------------------------------------------------
-- Legacy host-team RPCs honor the active tenant for private management paths.
-- Public profiles can still expose selected team/follower information.
-- ---------------------------------------------------------------------------

create or replace function public.get_host_organization_team(p_organization_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  role text,
  public_label text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, m.role, m.public_label
  from public.host_organization_members m
  join public.profiles p on p.id = m.profile_id
  join public.host_organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and (
      o.is_public
      or (
        o.platform_organization_id = private.active_organization_for_profile(auth.uid())
        and private.is_organization_member(o.platform_organization_id, auth.uid())
      )
    )
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'host' then 3 else 4 end, p.display_name;
$$;

create or replace function public.get_host_organization_followers(p_organization_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  followed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, f.created_at
  from public.host_follows f
  join public.profiles p on p.id = f.follower_profile_id
  join public.host_organizations o on o.id = f.organization_id
  where f.organization_id = p_organization_id
    and (
      o.is_public
      or (
        o.platform_organization_id = private.active_organization_for_profile(auth.uid())
        and private.is_organization_member(o.platform_organization_id, auth.uid())
      )
    )
  order by f.created_at desc;
$$;

create or replace function public.add_host_organization_member(
  p_organization_id uuid,
  p_username text,
  p_role text default 'host'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  v_platform_organization_id uuid;
begin
  if p_role not in ('admin','host','team') then
    raise exception 'Invalid organization role';
  end if;

  select o.platform_organization_id into v_platform_organization_id
  from public.host_organizations o
  where o.id = p_organization_id;

  if v_platform_organization_id is null
    or v_platform_organization_id <> private.active_organization_for_profile(auth.uid())
    or not private.has_organization_permission(v_platform_organization_id, 'members.manage', auth.uid())
  then
    raise exception 'You do not have permission to manage this organization team';
  end if;

  select p.id into target_profile_id
  from public.profiles p
  where lower(trim(coalesce(p.username, ''))) = lower(trim(p_username))
  limit 1;

  if target_profile_id is null then
    raise exception 'No member found with that username';
  end if;

  insert into public.host_organization_members (organization_id, profile_id, role)
  values (p_organization_id, target_profile_id, p_role)
  on conflict (organization_id, profile_id)
  do update set role = excluded.role;

  return target_profile_id;
end;
$$;

create or replace function public.remove_host_organization_member(
  p_organization_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform_organization_id uuid;
begin
  select o.platform_organization_id into v_platform_organization_id
  from public.host_organizations o
  where o.id = p_organization_id;

  if v_platform_organization_id is null
    or v_platform_organization_id <> private.active_organization_for_profile(auth.uid())
    or not private.has_organization_permission(v_platform_organization_id, 'members.manage', auth.uid())
  then
    raise exception 'You do not have permission to manage this organization team';
  end if;

  if exists (
    select 1 from public.host_organizations o
    where o.id = p_organization_id and o.created_by = p_profile_id
  ) then
    raise exception 'The organization owner cannot be removed';
  end if;

  delete from public.host_organization_members
  where organization_id = p_organization_id and profile_id = p_profile_id;
end;
$$;

grant execute on function public.get_host_organization_team(uuid) to authenticated;
grant execute on function public.get_host_organization_followers(uuid) to authenticated;
grant execute on function public.add_host_organization_member(uuid,text,text) to authenticated;
grant execute on function public.remove_host_organization_member(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
