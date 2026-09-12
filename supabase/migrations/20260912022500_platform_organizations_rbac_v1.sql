-- Platform Organizations + RBAC V1
-- Organization is the tenant boundary. Workspaces remain the user-facing work boundary.
-- Existing host_organizations remain intact and bridge into this model.

create schema if not exists private;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'organization_status'
  ) then
    create type public.organization_status as enum ('active', 'suspended', 'archived');
  end if;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null default 'company'
    check (kind in ('community', 'company', 'nonprofit', 'brand', 'team', 'other')),
  status public.organization_status not null default 'active',
  visibility text not null default 'private'
    check (visibility in ('public', 'private')),
  logo_url text,
  cover_image_url text,
  brand_settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  legacy_host_organization_id uuid unique references public.host_organizations(id) on delete set null,
  is_platform_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_one_platform_default_idx
  on public.organizations ((is_platform_default))
  where is_platform_default = true;
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists organizations_status_idx on public.organizations(status);

create table if not exists public.organization_system_roles (
  code text primary key,
  name text not null,
  description text not null default '',
  priority integer not null default 100,
  is_assignable boolean not null default true
);

create table if not exists public.organization_permissions (
  code text primary key,
  name text not null,
  description text not null default ''
);

create table if not exists public.organization_role_permissions (
  role_code text not null references public.organization_system_roles(code) on delete cascade,
  permission_code text not null references public.organization_permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index if not exists organization_memberships_profile_idx
  on public.organization_memberships(profile_id, status);

create table if not exists public.organization_member_roles (
  organization_id uuid not null,
  profile_id uuid not null,
  role_code text not null references public.organization_system_roles(code) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (organization_id, profile_id, role_code),
  foreign key (organization_id, profile_id)
    references public.organization_memberships(organization_id, profile_id)
    on delete cascade
);

create index if not exists organization_member_roles_profile_idx
  on public.organization_member_roles(profile_id, organization_id);
create index if not exists organization_member_roles_role_idx
  on public.organization_member_roles(organization_id, role_code);

create table if not exists public.profile_workspace_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  active_organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

insert into public.organization_system_roles (code, name, description, priority, is_assignable)
values
  ('owner', 'Organization Owner', 'Full organization control, including ownership-sensitive actions.', 10, true),
  ('admin', 'Organization Admin', 'Full day-to-day organization administration.', 20, true),
  ('event_manager', 'Event Manager', 'Event operations, staffing, tasks, communications, and reporting.', 30, true),
  ('marketing', 'Marketing', 'Campaigns, promotions, and marketing communications.', 40, true),
  ('finance', 'Finance', 'Organization and event financial records.', 40, true),
  ('host', 'Host', 'Hosted experiences and related operational work.', 50, true),
  ('staff', 'Team Member', 'Assigned organization and event operations.', 60, true),
  ('worker', 'Worker', 'Assigned shifts, tasks, and worker-facing event information.', 70, true),
  ('vendor', 'Vendor', 'Vendor-facing opportunities and event relationships.', 70, true),
  ('member', 'Member / Attendee', 'Community and experience participation.', 80, true),
  ('viewer', 'Viewer', 'Read-only organization operations.', 90, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  priority = excluded.priority,
  is_assignable = excluded.is_assignable;

insert into public.organization_permissions (code, name, description)
values
  ('organization.view', 'View organization', 'View organization workspace information.'),
  ('organization.settings.manage', 'Manage organization settings', 'Change organization configuration.'),
  ('organization.branding.manage', 'Manage branding', 'Change organization branding.'),
  ('members.view', 'View members', 'View organization members and team roster.'),
  ('members.manage', 'Manage members', 'Invite, activate, suspend, and remove organization members.'),
  ('roles.manage', 'Manage roles', 'Assign and remove organization roles.'),
  ('events.view', 'View events', 'View organization events.'),
  ('events.manage', 'Manage events', 'Create and edit organization events.'),
  ('events.publish', 'Publish events', 'Publish and unpublish organization events.'),
  ('tasks.view', 'View tasks', 'View organization and event tasks.'),
  ('tasks.manage', 'Manage tasks', 'Create and edit tasks.'),
  ('tasks.assign', 'Assign tasks', 'Assign tasks to organization members.'),
  ('vendors.view', 'View vendors', 'View organization vendor records.'),
  ('vendors.manage', 'Manage vendors', 'Manage vendor relationships.'),
  ('workers.view', 'View workers', 'View worker and staffing records.'),
  ('workers.manage', 'Manage workers', 'Manage staffing and worker assignments.'),
  ('communications.view', 'View communications', 'View organization communications.'),
  ('communications.send', 'Send communications', 'Create, schedule, and send communications.'),
  ('marketing.view', 'View marketing', 'View campaign and promotion activity.'),
  ('marketing.manage', 'Manage marketing', 'Create and manage campaigns.'),
  ('finance.view', 'View finance', 'View financial records and reporting.'),
  ('finance.manage', 'Manage finance', 'Create and modify financial records.'),
  ('analytics.view', 'View analytics', 'View organization and event analytics.'),
  ('files.view', 'View files', 'View organization files and documents.'),
  ('files.manage', 'Manage files', 'Upload and organize organization files.'),
  ('integrations.view', 'View integrations', 'View organization integrations.'),
  ('integrations.manage', 'Manage integrations', 'Configure organization integrations.'),
  ('ai.use', 'Use AI', 'Use organization-scoped AI assistance.'),
  ('ai.manage', 'Manage AI', 'Manage organization AI configuration and knowledge.'),
  ('audit.view', 'View audit history', 'View organization audit history.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.organization_role_permissions (role_code, permission_code)
select r.code, p.code
from public.organization_system_roles r
cross join public.organization_permissions p
where r.code in ('owner', 'admin')
on conflict do nothing;

insert into public.organization_role_permissions (role_code, permission_code)
values
  ('event_manager','organization.view'), ('event_manager','members.view'),
  ('event_manager','events.view'), ('event_manager','events.manage'), ('event_manager','events.publish'),
  ('event_manager','tasks.view'), ('event_manager','tasks.manage'), ('event_manager','tasks.assign'),
  ('event_manager','vendors.view'), ('event_manager','vendors.manage'),
  ('event_manager','workers.view'), ('event_manager','workers.manage'),
  ('event_manager','communications.view'), ('event_manager','communications.send'),
  ('event_manager','marketing.view'), ('event_manager','finance.view'), ('event_manager','analytics.view'),
  ('event_manager','files.view'), ('event_manager','files.manage'), ('event_manager','ai.use'),

  ('marketing','organization.view'), ('marketing','events.view'), ('marketing','communications.view'),
  ('marketing','communications.send'), ('marketing','marketing.view'), ('marketing','marketing.manage'),
  ('marketing','analytics.view'), ('marketing','files.view'), ('marketing','files.manage'), ('marketing','ai.use'),

  ('finance','organization.view'), ('finance','events.view'), ('finance','finance.view'),
  ('finance','finance.manage'), ('finance','analytics.view'), ('finance','files.view'),

  ('host','organization.view'), ('host','members.view'), ('host','events.view'), ('host','events.manage'),
  ('host','events.publish'), ('host','tasks.view'), ('host','tasks.manage'), ('host','tasks.assign'),
  ('host','vendors.view'), ('host','workers.view'), ('host','workers.manage'),
  ('host','communications.view'), ('host','communications.send'), ('host','marketing.view'),
  ('host','finance.view'), ('host','analytics.view'), ('host','files.view'), ('host','files.manage'), ('host','ai.use'),

  ('staff','organization.view'), ('staff','members.view'), ('staff','events.view'),
  ('staff','tasks.view'), ('staff','tasks.manage'), ('staff','vendors.view'),
  ('staff','communications.view'), ('staff','files.view'), ('staff','ai.use'),

  ('worker','organization.view'), ('worker','events.view'), ('worker','tasks.view'),
  ('worker','communications.view'), ('worker','files.view'),

  ('vendor','organization.view'), ('vendor','events.view'), ('vendor','tasks.view'),
  ('vendor','communications.view'), ('vendor','files.view'),

  ('member','organization.view'), ('member','events.view'),

  ('viewer','organization.view'), ('viewer','members.view'), ('viewer','events.view'),
  ('viewer','tasks.view'), ('viewer','vendors.view'), ('viewer','workers.view'),
  ('viewer','communications.view'), ('viewer','marketing.view'), ('viewer','finance.view'),
  ('viewer','analytics.view'), ('viewer','files.view'), ('viewer','integrations.view')
on conflict do nothing;

create or replace function private.is_platform_operator(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.platform_role in ('admin', 'founder')
      and p.status::text = 'active'
  );
$$;

create or replace function private.is_organization_member(
  p_organization_id uuid,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.profile_id = p_profile_id
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[],
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_member_roles r
    join public.organization_memberships m
      on m.organization_id = r.organization_id and m.profile_id = r.profile_id
    join public.organizations o on o.id = r.organization_id
    where r.organization_id = p_organization_id
      and r.profile_id = p_profile_id
      and r.role_code = any(p_roles)
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function private.organization_owner_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.organization_member_roles r
  join public.organization_memberships m
    on m.organization_id = r.organization_id and m.profile_id = r.profile_id
  where r.organization_id = p_organization_id
    and r.role_code = 'owner'
    and m.status = 'active';
$$;

create or replace function private.has_organization_permission(
  p_organization_id uuid,
  p_permission_code text,
  p_profile_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_operator(p_profile_id)
    or exists (
      select 1
      from public.organization_member_roles r
      join public.organization_role_permissions rp on rp.role_code = r.role_code
      join public.organization_memberships m
        on m.organization_id = r.organization_id and m.profile_id = r.profile_id
      join public.organizations o on o.id = r.organization_id
      where r.organization_id = p_organization_id
        and r.profile_id = p_profile_id
        and rp.permission_code = p_permission_code
        and m.status = 'active'
        and o.status = 'active'
    );
$$;

create or replace function private.active_organization_for_profile(p_profile_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select wp.active_organization_id
      from public.profile_workspace_preferences wp
      join public.organization_memberships m
        on m.organization_id = wp.active_organization_id and m.profile_id = wp.profile_id
      join public.organizations o on o.id = wp.active_organization_id
      where wp.profile_id = p_profile_id
        and m.status = 'active'
        and o.status = 'active'
      limit 1
    ),
    (
      select m.organization_id
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.profile_id = p_profile_id
        and m.status = 'active'
        and o.status = 'active'
      order by o.is_platform_default desc, m.joined_at asc
      limit 1
    )
  );
$$;

revoke all on function private.is_platform_operator(uuid) from public;
revoke all on function private.is_organization_member(uuid, uuid) from public;
revoke all on function private.has_organization_role(uuid, text[], uuid) from public;
revoke all on function private.organization_owner_count(uuid) from public;
revoke all on function private.has_organization_permission(uuid, text, uuid) from public;
revoke all on function private.active_organization_for_profile(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_operator(uuid) to authenticated;
grant execute on function private.is_organization_member(uuid, uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[], uuid) to authenticated;
grant execute on function private.organization_owner_count(uuid) to authenticated;
grant execute on function private.has_organization_permission(uuid, text, uuid) to authenticated;
grant execute on function private.active_organization_for_profile(uuid) to authenticated;

create or replace function private.bootstrap_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.organization_memberships (organization_id, profile_id, status, invited_by)
    values (new.id, new.created_by, 'active', new.created_by)
    on conflict (organization_id, profile_id)
    do update set status = 'active', updated_at = now();

    insert into public.organization_member_roles (organization_id, profile_id, role_code, assigned_by)
    values (new.id, new.created_by, 'owner', new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.bootstrap_organization_owner() from public;
drop trigger if exists organizations_bootstrap_owner on public.organizations;
create trigger organizations_bootstrap_owner
after insert on public.organizations
for each row execute function private.bootstrap_organization_owner();

-- Go Melanated is tenant one. No generated profile IDs are hard-coded.
insert into public.organizations (
  name, slug, kind, status, visibility, created_by, is_platform_default
)
select
  'Go Melanated',
  'go-melanated',
  'community',
  'active'::public.organization_status,
  'public',
  (
    select p.id
    from public.profiles p
    where p.platform_role = 'founder'
    order by p.created_at asc
    limit 1
  ),
  true
where not exists (select 1 from public.organizations where slug = 'go-melanated');

update public.organizations
set name = 'Go Melanated',
    kind = 'community',
    visibility = 'public',
    is_platform_default = true,
    updated_at = now()
where slug = 'go-melanated';

insert into public.organization_memberships (organization_id, profile_id, status)
select o.id, p.id, 'active'
from public.organizations o
cross join public.profiles p
where o.slug = 'go-melanated'
on conflict (organization_id, profile_id)
do update set status = 'active', updated_at = now();

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select o.id, p.id, 'member'
from public.organizations o
cross join public.profiles p
where o.slug = 'go-melanated'
on conflict do nothing;

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select o.id, p.id,
  case when p.platform_role = 'founder' then 'owner' else 'admin' end
from public.organizations o
cross join public.profiles p
where o.slug = 'go-melanated'
  and p.platform_role in ('founder', 'admin')
on conflict do nothing;

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select distinct o.id, h.profile_id, 'host'
from public.organizations o
join public.outing_hosts h on h.status = 'approved'
where o.slug = 'go-melanated'
on conflict do nothing;

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select distinct o.id, v.profile_id, 'vendor'
from public.organizations o
join public.vendor_center_access v on v.status = 'approved'
where o.slug = 'go-melanated'
on conflict do nothing;

alter table public.host_organizations
  add column if not exists platform_organization_id uuid references public.organizations(id) on delete set null;
create index if not exists host_organizations_platform_org_idx
  on public.host_organizations(platform_organization_id)
  where platform_organization_id is not null;

-- Current Melanated Adventurers public host identities are Go Melanated identities,
-- not separate SaaS customers.
update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where h.platform_organization_id is null
  and o.slug = 'go-melanated'
  and lower(h.name) in ('melanated adventurers', 'the melanated adventurers');

-- Any other legacy host/business organization becomes its own platform organization.
insert into public.organizations (
  name, slug, kind, status, visibility, logo_url, cover_image_url,
  created_by, legacy_host_organization_id, brand_settings
)
select
  h.name,
  h.slug,
  'company',
  'active'::public.organization_status,
  case when h.is_public then 'public' else 'private' end,
  h.logo_url,
  h.cover_image_url,
  h.created_by,
  h.id,
  jsonb_strip_nulls(jsonb_build_object(
    'website_url', h.website_url,
    'tagline', h.tagline,
    'public_email', h.public_email,
    'phone', h.phone,
    'instagram_url', h.instagram_url,
    'facebook_url', h.facebook_url
  ))
from public.host_organizations h
where h.platform_organization_id is null
on conflict (slug) do nothing;

update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where h.platform_organization_id is null
  and (o.legacy_host_organization_id = h.id or o.slug = h.slug);

insert into public.organization_memberships (organization_id, profile_id, status)
select distinct h.platform_organization_id, m.profile_id, 'active'
from public.host_organization_members m
join public.host_organizations h on h.id = m.organization_id
where h.platform_organization_id is not null
on conflict (organization_id, profile_id)
do update set status = 'active', updated_at = now();

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select distinct h.platform_organization_id, m.profile_id,
  case m.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'host' then 'host'
    else 'staff'
  end
from public.host_organization_members m
join public.host_organizations h on h.id = m.organization_id
where h.platform_organization_id is not null
on conflict do nothing;

create or replace function private.sync_host_organization_platform()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_platform_id uuid;
begin
  if new.platform_organization_id is null then
    insert into public.organizations (
      name, slug, kind, status, visibility, logo_url, cover_image_url,
      created_by, legacy_host_organization_id, brand_settings
    ) values (
      new.name, new.slug, 'company', 'active',
      case when new.is_public then 'public' else 'private' end,
      new.logo_url, new.cover_image_url, new.created_by, new.id,
      jsonb_strip_nulls(jsonb_build_object(
        'website_url', new.website_url,
        'tagline', new.tagline,
        'public_email', new.public_email,
        'phone', new.phone,
        'instagram_url', new.instagram_url,
        'facebook_url', new.facebook_url
      ))
    )
    returning id into v_platform_id;
    new.platform_organization_id := v_platform_id;
  else
    update public.organizations
    set name = new.name,
        visibility = case when new.is_public then 'public' else 'private' end,
        logo_url = new.logo_url,
        cover_image_url = new.cover_image_url,
        brand_settings = jsonb_strip_nulls(jsonb_build_object(
          'website_url', new.website_url,
          'tagline', new.tagline,
          'public_email', new.public_email,
          'phone', new.phone,
          'instagram_url', new.instagram_url,
          'facebook_url', new.facebook_url
        )),
        updated_at = now()
    where id = new.platform_organization_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_host_organization_platform() from public;
drop trigger if exists host_organizations_sync_platform on public.host_organizations;
create trigger host_organizations_sync_platform
before insert or update of name, is_public, logo_url, cover_image_url, website_url,
  tagline, public_email, phone, instagram_url, facebook_url, platform_organization_id
on public.host_organizations
for each row execute function private.sync_host_organization_platform();

create or replace function private.sync_host_organization_member_platform()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_profile uuid;
  v_role text;
  v_is_default boolean;
begin
  if tg_op = 'DELETE' then
    select h.platform_organization_id, o.is_platform_default
      into v_org, v_is_default
    from public.host_organizations h
    left join public.organizations o on o.id = h.platform_organization_id
    where h.id = old.organization_id;

    v_profile := old.profile_id;
    v_role := case old.role
      when 'owner' then 'owner'
      when 'admin' then 'admin'
      when 'host' then 'host'
      else 'staff'
    end;

    if v_org is not null then
      delete from public.organization_member_roles
      where organization_id = v_org
        and profile_id = v_profile
        and role_code = v_role;

      if coalesce(v_is_default, false) = false
        and not exists (
          select 1
          from public.host_organization_members hm
          join public.host_organizations ho on ho.id = hm.organization_id
          where hm.profile_id = v_profile
            and ho.platform_organization_id = v_org
        )
      then
        update public.organization_memberships
        set status = 'removed', updated_at = now()
        where organization_id = v_org and profile_id = v_profile;
      end if;
    end if;
    return old;
  end if;

  select platform_organization_id into v_org
  from public.host_organizations
  where id = new.organization_id;

  if v_org is null then return new; end if;

  insert into public.organization_memberships (organization_id, profile_id, status, invited_by)
  values (v_org, new.profile_id, 'active', auth.uid())
  on conflict (organization_id, profile_id)
  do update set status = 'active', updated_at = now();

  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    delete from public.organization_member_roles
    where organization_id = v_org
      and profile_id = new.profile_id
      and role_code = case old.role
        when 'owner' then 'owner'
        when 'admin' then 'admin'
        when 'host' then 'host'
        else 'staff'
      end;
  end if;

  v_role := case new.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'host' then 'host'
    else 'staff'
  end;

  insert into public.organization_member_roles (organization_id, profile_id, role_code, assigned_by)
  values (v_org, new.profile_id, v_role, auth.uid())
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.sync_host_organization_member_platform() from public;
drop trigger if exists host_organization_members_sync_platform on public.host_organization_members;
create trigger host_organization_members_sync_platform
after insert or update or delete on public.host_organization_members
for each row execute function private.sync_host_organization_member_platform();

insert into public.profile_workspace_preferences (profile_id, active_organization_id)
select p.id, o.id
from public.profiles p
join public.organizations o on o.is_platform_default = true
on conflict (profile_id) do nothing;

create or replace function private.bootstrap_profile_default_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where is_platform_default = true
  limit 1;

  if v_org is null then return new; end if;

  insert into public.organization_memberships (organization_id, profile_id, status)
  values (v_org, new.id, 'active')
  on conflict (organization_id, profile_id)
  do update set status = 'active', updated_at = now();

  insert into public.organization_member_roles (organization_id, profile_id, role_code)
  values (v_org, new.id, 'member')
  on conflict do nothing;

  insert into public.profile_workspace_preferences (profile_id, active_organization_id)
  values (new.id, v_org)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

revoke all on function private.bootstrap_profile_default_organization() from public;
drop trigger if exists profiles_bootstrap_default_organization on public.profiles;
create trigger profiles_bootstrap_default_organization
after insert on public.profiles
for each row execute function private.bootstrap_profile_default_organization();

create or replace function private.sync_approved_host_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.status <> 'approved' then return new; end if;
  select id into v_org from public.organizations where is_platform_default = true limit 1;
  if v_org is null then return new; end if;
  insert into public.organization_memberships (organization_id, profile_id, status)
  values (v_org, new.profile_id, 'active')
  on conflict (organization_id, profile_id) do update set status = 'active', updated_at = now();
  insert into public.organization_member_roles (organization_id, profile_id, role_code)
  values (v_org, new.profile_id, 'host')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.sync_approved_host_role() from public;
drop trigger if exists outing_hosts_sync_org_role on public.outing_hosts;
create trigger outing_hosts_sync_org_role
after insert or update of status on public.outing_hosts
for each row execute function private.sync_approved_host_role();

create or replace function private.sync_approved_vendor_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.status <> 'approved' then return new; end if;
  select id into v_org from public.organizations where is_platform_default = true limit 1;
  if v_org is null then return new; end if;
  insert into public.organization_memberships (organization_id, profile_id, status)
  values (v_org, new.profile_id, 'active')
  on conflict (organization_id, profile_id) do update set status = 'active', updated_at = now();
  insert into public.organization_member_roles (organization_id, profile_id, role_code)
  values (v_org, new.profile_id, 'vendor')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.sync_approved_vendor_role() from public;
drop trigger if exists vendor_center_access_sync_org_role on public.vendor_center_access;
create trigger vendor_center_access_sync_org_role
after insert or update of status on public.vendor_center_access
for each row execute function private.sync_approved_vendor_role();

-- RLS and explicit API privileges for new tenancy tables.
alter table public.organizations enable row level security;
alter table public.organization_system_roles enable row level security;
alter table public.organization_permissions enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_member_roles enable row level security;
alter table public.profile_workspace_preferences enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_system_roles from anon, authenticated;
revoke all on public.organization_permissions from anon, authenticated;
revoke all on public.organization_role_permissions from anon, authenticated;
revoke all on public.organization_memberships from anon, authenticated;
revoke all on public.organization_member_roles from anon, authenticated;
revoke all on public.profile_workspace_preferences from anon, authenticated;

grant select, insert, update, delete on public.organizations to authenticated;
grant select on public.organization_system_roles to authenticated;
grant select on public.organization_permissions to authenticated;
grant select on public.organization_role_permissions to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, delete on public.organization_member_roles to authenticated;
grant select, insert, update, delete on public.profile_workspace_preferences to authenticated;

drop policy if exists "Organizations visible to allowed users" on public.organizations;
create policy "Organizations visible to allowed users"
on public.organizations for select to authenticated
using (
  visibility = 'public'
  or private.is_organization_member(id, (select auth.uid()))
  or private.is_platform_operator((select auth.uid()))
);

drop policy if exists "Users create organizations for themselves" on public.organizations;
create policy "Users create organizations for themselves"
on public.organizations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Organization settings managers update organizations" on public.organizations;
create policy "Organization settings managers update organizations"
on public.organizations for update to authenticated
using (private.has_organization_permission(id, 'organization.settings.manage', (select auth.uid())))
with check (private.has_organization_permission(id, 'organization.settings.manage', (select auth.uid())));

drop policy if exists "Organization owners delete organizations" on public.organizations;
create policy "Organization owners delete organizations"
on public.organizations for delete to authenticated
using (
  private.has_organization_role(id, array['owner'], (select auth.uid()))
  or private.is_platform_operator((select auth.uid()))
);

drop policy if exists "System roles readable" on public.organization_system_roles;
create policy "System roles readable"
on public.organization_system_roles for select to authenticated using (true);

drop policy if exists "Permission catalog readable" on public.organization_permissions;
create policy "Permission catalog readable"
on public.organization_permissions for select to authenticated using (true);

drop policy if exists "Role permission matrix readable" on public.organization_role_permissions;
create policy "Role permission matrix readable"
on public.organization_role_permissions for select to authenticated using (true);

drop policy if exists "Organization members view membership" on public.organization_memberships;
create policy "Organization members view membership"
on public.organization_memberships for select to authenticated
using (
  private.is_organization_member(organization_id, (select auth.uid()))
  or private.is_platform_operator((select auth.uid()))
);

drop policy if exists "Membership managers add members" on public.organization_memberships;
create policy "Membership managers add members"
on public.organization_memberships for insert to authenticated
with check (private.has_organization_permission(organization_id, 'members.manage', (select auth.uid())));

drop policy if exists "Membership managers update members" on public.organization_memberships;
create policy "Membership managers update members"
on public.organization_memberships for update to authenticated
using (
  private.has_organization_permission(organization_id, 'members.manage', (select auth.uid()))
  and (
    not private.has_organization_role(organization_id, array['owner'], profile_id)
    or private.is_platform_operator((select auth.uid()))
    or (
      private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
      and private.organization_owner_count(organization_id) > 1
    )
  )
)
with check (private.has_organization_permission(organization_id, 'members.manage', (select auth.uid())));

drop policy if exists "Membership managers remove members" on public.organization_memberships;
create policy "Membership managers remove members"
on public.organization_memberships for delete to authenticated
using (
  private.has_organization_permission(organization_id, 'members.manage', (select auth.uid()))
  and (
    not private.has_organization_role(organization_id, array['owner'], profile_id)
    or private.is_platform_operator((select auth.uid()))
    or (
      private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
      and private.organization_owner_count(organization_id) > 1
    )
  )
);

drop policy if exists "Organization members view roles" on public.organization_member_roles;
create policy "Organization members view roles"
on public.organization_member_roles for select to authenticated
using (
  private.is_organization_member(organization_id, (select auth.uid()))
  or private.is_platform_operator((select auth.uid()))
);

drop policy if exists "Role managers assign roles" on public.organization_member_roles;
create policy "Role managers assign roles"
on public.organization_member_roles for insert to authenticated
with check (
  private.has_organization_permission(organization_id, 'roles.manage', (select auth.uid()))
  and (
    role_code <> 'owner'
    or private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
    or private.is_platform_operator((select auth.uid()))
  )
);

drop policy if exists "Role managers remove roles" on public.organization_member_roles;
create policy "Role managers remove roles"
on public.organization_member_roles for delete to authenticated
using (
  private.has_organization_permission(organization_id, 'roles.manage', (select auth.uid()))
  and (
    role_code <> 'owner'
    or private.is_platform_operator((select auth.uid()))
    or (
      private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
      and private.organization_owner_count(organization_id) > 1
    )
  )
);

drop policy if exists "Members read own workspace preference" on public.profile_workspace_preferences;
create policy "Members read own workspace preference"
on public.profile_workspace_preferences for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "Members create own workspace preference" on public.profile_workspace_preferences;
create policy "Members create own workspace preference"
on public.profile_workspace_preferences for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and private.is_organization_member(active_organization_id, (select auth.uid()))
);

drop policy if exists "Members update own workspace preference" on public.profile_workspace_preferences;
create policy "Members update own workspace preference"
on public.profile_workspace_preferences for update to authenticated
using (profile_id = (select auth.uid()))
with check (
  profile_id = (select auth.uid())
  and private.is_organization_member(active_organization_id, (select auth.uid()))
);

drop policy if exists "Members delete own workspace preference" on public.profile_workspace_preferences;
create policy "Members delete own workspace preference"
on public.profile_workspace_preferences for delete to authenticated
using (profile_id = (select auth.uid()));

create or replace function public.list_my_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  kind text,
  status text,
  visibility text,
  logo_url text,
  cover_image_url text,
  roles text[],
  is_active boolean,
  is_platform_default boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.kind,
    o.status::text,
    o.visibility,
    o.logo_url,
    o.cover_image_url,
    coalesce(
      (
        select array_agg(r.role_code order by sr.priority, r.role_code)
        from public.organization_member_roles r
        join public.organization_system_roles sr on sr.code = r.role_code
        where r.organization_id = o.id
          and r.profile_id = (select auth.uid())
      ),
      '{}'::text[]
    ) as roles,
    coalesce(wp.active_organization_id = o.id, false) as is_active,
    o.is_platform_default
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  left join public.profile_workspace_preferences wp on wp.profile_id = m.profile_id
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and o.status = 'active'
  order by is_active desc, o.is_platform_default desc, o.name asc;
$$;

create or replace function public.set_active_organization(p_organization_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_organization_member(p_organization_id, (select auth.uid())) then
    raise exception 'You do not have access to this organization';
  end if;

  insert into public.profile_workspace_preferences (profile_id, active_organization_id, updated_at)
  values ((select auth.uid()), p_organization_id, now())
  on conflict (profile_id)
  do update set active_organization_id = excluded.active_organization_id, updated_at = now();

  return true;
end;
$$;

create or replace function public.organization_has_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_organization_permission(
    p_organization_id,
    p_permission_code,
    (select auth.uid())
  );
$$;

revoke all on function public.list_my_organizations() from public;
revoke all on function public.set_active_organization(uuid) from public;
revoke all on function public.organization_has_permission(uuid, text) from public;
grant execute on function public.list_my_organizations() to authenticated;
grant execute on function public.set_active_organization(uuid) to authenticated;
grant execute on function public.organization_has_permission(uuid, text) to authenticated;

notify pgrst, 'reload schema';
