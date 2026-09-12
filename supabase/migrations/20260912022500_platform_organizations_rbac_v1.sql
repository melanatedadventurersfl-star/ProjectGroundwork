-- Platform Organizations + RBAC V1
-- Introduces the tenant boundary without breaking the existing host_organizations model.
-- host_organizations remains the public host/business identity layer and is bridged to
-- the broader platform organization model.

create schema if not exists private;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
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
    check (kind in ('community','company','nonprofit','brand','team','other')),
  status public.organization_status not null default 'active',
  visibility text not null default 'private'
    check (visibility in ('public','private')),
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
    check (status in ('invited','active','suspended','removed')),
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
  ('owner', 'Organization Owner', 'Full organization control, including ownership-sensitive role changes.', 10, true),
  ('admin', 'Organization Admin', 'Full day-to-day organization administration.', 20, true),
  ('event_manager', 'Event Manager', 'Creates and operates events, staffing, tasks, communications, and event reporting.', 30, true),
  ('marketing', 'Marketing', 'Manages campaigns, promotions, and marketing communications.', 40, true),
  ('finance', 'Finance', 'Views and manages organization and event financial records.', 40, true),
  ('host', 'Host', 'Creates and manages hosted experiences and related operational work.', 50, true),
  ('staff', 'Team Member', 'Works assigned operational tasks and event responsibilities.', 60, true),
  ('worker', 'Worker', 'Accesses assigned shifts, tasks, and worker-facing event information.', 70, true),
  ('vendor', 'Vendor', 'Accesses vendor-facing opportunities, assignments, and organization relationships.', 70, true),
  ('member', 'Member / Attendee', 'Participates in the organization community and its experiences.', 80, true),
  ('viewer', 'Viewer', 'Read-only access to allowed organization operations.', 90, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  priority = excluded.priority,
  is_assignable = excluded.is_assignable;

insert into public.organization_permissions (code, name, description)
values
  ('organization.view', 'View organization', 'View organization workspace information.'),
  ('organization.settings.manage', 'Manage organization settings', 'Change organization configuration and operational settings.'),
  ('organization.branding.manage', 'Manage branding', 'Change organization branding and public identity.'),
  ('members.view', 'View members', 'View organization members and team roster.'),
  ('members.manage', 'Manage members', 'Invite, activate, suspend, and remove organization members.'),
  ('roles.manage', 'Manage roles', 'Assign and remove organization roles within ownership safeguards.'),
  ('events.view', 'View events', 'View organization events and workspaces.'),
  ('events.manage', 'Manage events', 'Create and edit organization events.'),
  ('events.publish', 'Publish events', 'Publish or unpublish organization events.'),
  ('tasks.view', 'View tasks', 'View organization and event tasks.'),
  ('tasks.manage', 'Manage tasks', 'Create and edit tasks.'),
  ('tasks.assign', 'Assign tasks', 'Assign tasks to organization members.'),
  ('vendors.view', 'View vendors', 'View organization vendor records.'),
  ('vendors.manage', 'Manage vendors', 'Create and manage vendor relationships.'),
  ('workers.view', 'View workers', 'View worker and staffing records.'),
  ('workers.manage', 'Manage workers', 'Manage staffing, worker relationships, and assignments.'),
  ('communications.view', 'View communications', 'View organization communications.'),
  ('communications.send', 'Send communications', 'Create, schedule, and send organization communications.'),
  ('marketing.view', 'View marketing', 'View campaigns and promotion activity.'),
  ('marketing.manage', 'Manage marketing', 'Create and manage campaigns and promotions.'),
  ('finance.view', 'View finance', 'View financial records and reporting.'),
  ('finance.manage', 'Manage finance', 'Create and modify financial records.'),
  ('analytics.view', 'View analytics', 'View organization and event analytics.'),
  ('files.view', 'View files', 'View organization files and documents.'),
  ('files.manage', 'Manage files', 'Upload, edit, and organize organization files.'),
  ('integrations.view', 'View integrations', 'View connected organization integrations.'),
  ('integrations.manage', 'Manage integrations', 'Connect, configure, and remove organization integrations.'),
  ('ai.use', 'Use AI', 'Use organization-scoped AI assistance.'),
  ('ai.manage', 'Manage AI', 'Manage organization AI configuration and knowledge.'),
  ('audit.view', 'View audit history', 'View organization audit and administrative history.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- Owners and admins receive all V1 permissions. Ownership-sensitive actions are
-- still protected separately by RLS and role checks.
insert into public.organization_role_permissions (role_code, permission_code)
select r.code, p.code
from public.organization_system_roles r
cross join public.organization_permissions p
where r.code in ('owner','admin')
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
      and p.platform_role in ('admin','founder')
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
revoke all on function private.is_organization_member(uuid,uuid) from public;
revoke all on function private.has_organization_role(uuid,text[],uuid) from public;
revoke all on function private.has_organization_permission(uuid,text,uuid) from public;
revoke all on function private.active_organization_for_profile(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_operator(uuid) to authenticated;
grant execute on function private.is_organization_member(uuid,uuid) to authenticated;
grant execute on function private.has_organization_role(uuid,text[],uuid) to authenticated;
grant execute on function private.has_organization_permission(uuid,text,uuid) to authenticated;
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

-- Seed Go Melanated as the first platform tenant. No generated profile IDs are hard-coded.
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
set is_platform_default = true,
    name = 'Go Melanated',
    kind = 'community',
    visibility = 'public'
where slug = 'go-melanated';

-- Existing Go Melanated accounts remain members of the default organization.
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
  and p.platform_role in ('founder','admin')
on conflict do nothing;

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select distinct o.id, p.id, 'host'
from public.organizations o
join public.profiles p on true
left join public.outing_hosts h on h.profile_id = p.id and h.status = 'approved'
where o.slug = 'go-melanated'
  and (coalesce(p.event_host_level, '') not in ('', 'none') or h.profile_id is not null)
on conflict do nothing;

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select distinct o.id, p.id, 'vendor'
from public.organizations o
join public.profiles p on true
left join public.vendor_center_access v on v.profile_id = p.id and v.status = 'approved'
left join public.host_vendor_profiles hv on hv.owner_profile_id = p.id
where o.slug = 'go-melanated'
  and (v.profile_id is not null or hv.id is not null)
on conflict do nothing;

-- Bridge the existing host/business organization model into the tenant model.
alter table public.host_organizations
  add column if not exists platform_organization_id uuid references public.organizations(id) on delete set null;
create unique index if not exists host_organizations_platform_org_uidx
  on public.host_organizations(platform_organization_id)
  where platform_organization_id is not null;

update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where h.platform_organization_id is null
  and h.slug = 'go-melanated'
  and o.slug = 'go-melanated';

insert into public.organizations (
  name, slug, kind, status, visibility, logo_url, cover_image_url, created_by,
  legacy_host_organization_id, brand_settings
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
  and h.slug <> 'go-melanated'
on conflict (slug) do nothing;

update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where h.platform_organization_id is null
  and (o.legacy_host_organization_id = h.id or o.slug = h.slug);

insert into public.organization_memberships (organization_id, profile_id, status)
select h.platform_organization_id, m.profile_id, 'active'
from public.host_organization_members m
join public.host_organizations h on h.id = m.organization_id
where h.platform_organization_id is not null
on conflict (organization_id, profile_id)
do update set status = 'active', updated_at = now();

insert into public.organization_member_roles (organization_id, profile_id, role_code)
select h.platform_organization_id, m.profile_id,
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
    if new.slug = 'go-melanated' then
      select id into v_platform_id from public.organizations where slug = 'go-melanated' limit 1;
    else
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
      ) returning id into v_platform_id;
    end if;
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
before insert or update of name, slug, is_public, logo_url, cover_image_url, website_url,
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
begin
  if tg_op = 'DELETE' then
    select platform_organization_id into v_org
    from public.host_organizations where id = old.organization_id;
    v_profile := old.profile_id;
    v_role := case old.role when 'owner' then 'owner' when 'admin' then 'admin' when 'host' then 'host' else 'staff' end;
    if v_org is not null then
      delete from public.organization_member_roles
      where organization_id = v_org and profile_id = v_profile and role_code = v_role;
      if not exists (
        select 1 from public.host_organization_members hm
        where hm.organization_id = old.organization_id and hm.profile_id = v_profile
      ) then
        update public.organization_memberships
        set status = 'removed', updated_at = now()
        where organization_id = v_org and profile_id = v_profile;
      end if;
    end if;
    return old;
  end if;

  select platform_organization_id into v_org
  from public.host_organizations where id = new.organization_id;
  if v_org is null then return new; end if;

  insert into public.organization_memberships (organization_id, profile_id, status, invited_by)
  values (v_org, new.profile_id, 'active', auth.uid())
  on conflict (organization_id, profile_id)
  do update set status = 'active', updated_at = now();

  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    delete from public.organization_member_roles
    where organization_id = v_org
      and profile_id = new.profile_id
      and role_code = case old.role when 'owner' then 'owner' when 'admin' then 'admin' when 'host' then 'host' else 'staff' end;
  end if;

  v_role := case new.role when 'owner' then 'owner' when 'admin' then 'admin' when 'host' then 'host' else 'staff' end;
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

-- Durable active organization context. Seed every existing profile into the default tenant.
insert into public.profile_workspace_preferences (profile_id, active_organization_id)
select p.id, o.id
from public.profiles p
join public.organizations o on o.is_platform_default = true
on conflict (profile_id) do nothing;

-- Resource ownership foundation. Existing legacy organization_id on adventures remains
-- untouched because it still references host_organizations.
alter table public.adventures
  add column if not exists platform_organization_id uuid references public.organizations(id) on delete restrict;
create index if not exists adventures_platform_organization_idx
  on public.adventures(platform_organization_id, starts_at);

update public.adventures a
set platform_organization_id = coalesce(h.platform_organization_id, d.id)
from public.organizations d
left join public.host_organizations h on h.id = a.organization_id
where d.is_platform_default = true
  and a.platform_organization_id is null;

create or replace function private.set_adventure_platform_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    select h.platform_organization_id into v_org
    from public.host_organizations h where h.id = new.organization_id;
  end if;
  if v_org is not null then
    new.platform_organization_id := v_org;
  elsif new.platform_organization_id is null then
    new.platform_organization_id := private.active_organization_for_profile(new.created_by);
  end if;
  return new;
end;
$$;

revoke all on function private.set_adventure_platform_organization() from public;

drop trigger if exists adventures_set_platform_organization on public.adventures;
create trigger adventures_set_platform_organization
before insert or update of organization_id, created_by, platform_organization_id
on public.adventures
for each row execute function private.set_adventure_platform_organization();

alter table public.host_campaigns
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
create index if not exists host_campaigns_organization_idx on public.host_campaigns(organization_id, starts_at);

update public.host_campaigns c
set organization_id = coalesce(a.platform_organization_id, private.active_organization_for_profile(c.owner_profile_id))
from public.adventures a
where c.adventure_id = a.id and c.organization_id is null;

update public.host_campaigns c
set organization_id = private.active_organization_for_profile(c.owner_profile_id)
where c.organization_id is null;

create or replace function private.set_campaign_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.adventure_id is not null then
    select a.platform_organization_id into new.organization_id
    from public.adventures a where a.id = new.adventure_id;
  end if;
  if new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(new.owner_profile_id);
  end if;
  return new;
end;
$$;

revoke all on function private.set_campaign_organization() from public;

drop trigger if exists host_campaigns_set_organization on public.host_campaigns;
create trigger host_campaigns_set_organization
before insert or update of adventure_id, owner_profile_id, organization_id
on public.host_campaigns
for each row execute function private.set_campaign_organization();

-- Event-operation records inherit tenant context from their campaign.
alter table public.host_campaign_tasks add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_communications add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_finance_entries add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_analytics_events add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_vendors add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists host_campaign_tasks_organization_idx on public.host_campaign_tasks(organization_id, campaign_id);
create index if not exists host_event_communications_organization_idx on public.host_event_communications(organization_id, campaign_id);
create index if not exists host_event_finance_entries_organization_idx on public.host_event_finance_entries(organization_id, campaign_id);
create index if not exists host_event_analytics_events_organization_idx on public.host_event_analytics_events(organization_id, campaign_id);
create index if not exists host_event_vendors_organization_idx on public.host_event_vendors(organization_id, campaign_id);

update public.host_campaign_tasks x set organization_id = c.organization_id
from public.host_campaigns c where x.campaign_id = c.id and x.organization_id is null;
update public.host_event_communications x set organization_id = c.organization_id
from public.host_campaigns c where x.campaign_id = c.id and x.organization_id is null;
update public.host_event_finance_entries x set organization_id = c.organization_id
from public.host_campaigns c where x.campaign_id = c.id and x.organization_id is null;
update public.host_event_analytics_events x set organization_id = c.organization_id
from public.host_campaigns c where x.campaign_id = c.id and x.organization_id is null;
update public.host_event_vendors x set organization_id = c.organization_id
from public.host_campaigns c where x.campaign_id = c.id and x.organization_id is null;

create or replace function private.inherit_campaign_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.campaign_id is not null then
    select c.organization_id into new.organization_id
    from public.host_campaigns c where c.id = new.campaign_id;
  end if;
  return new;
end;
$$;

revoke all on function private.inherit_campaign_organization() from public;

drop trigger if exists host_campaign_tasks_inherit_organization on public.host_campaign_tasks;
create trigger host_campaign_tasks_inherit_organization before insert or update of campaign_id, organization_id on public.host_campaign_tasks for each row execute function private.inherit_campaign_organization();
drop trigger if exists host_event_communications_inherit_organization on public.host_event_communications;
create trigger host_event_communications_inherit_organization before insert or update of campaign_id, organization_id on public.host_event_communications for each row execute function private.inherit_campaign_organization();
drop trigger if exists host_event_finance_entries_inherit_organization on public.host_event_finance_entries;
create trigger host_event_finance_entries_inherit_organization before insert or update of campaign_id, organization_id on public.host_event_finance_entries for each row execute function private.inherit_campaign_organization();
drop trigger if exists host_event_analytics_events_inherit_organization on public.host_event_analytics_events;
create trigger host_event_analytics_events_inherit_organization before insert or update of campaign_id, organization_id on public.host_event_analytics_events for each row execute function private.inherit_campaign_organization();
drop trigger if exists host_event_vendors_inherit_organization on public.host_event_vendors;
create trigger host_event_vendors_inherit_organization before insert or update of campaign_id, organization_id on public.host_event_vendors for each row execute function private.inherit_campaign_organization();

-- Organization context for top-level host resources that are not necessarily attached to an event.
alter table public.host_library_items add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_communication_templates add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_opportunities add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_vendor_profiles add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_imports add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists host_library_items_organization_idx on public.host_library_items(organization_id);
create index if not exists host_communication_templates_organization_idx on public.host_communication_templates(organization_id);
create index if not exists host_opportunities_organization_idx on public.host_opportunities(organization_id);
create index if not exists host_vendor_profiles_organization_idx on public.host_vendor_profiles(organization_id);
create index if not exists host_event_imports_organization_idx on public.host_event_imports(organization_id);

update public.host_library_items set organization_id = private.active_organization_for_profile(owner_profile_id) where organization_id is null;
update public.host_communication_templates set organization_id = private.active_organization_for_profile(owner_profile_id) where organization_id is null;
update public.host_opportunities set organization_id = private.active_organization_for_profile(owner_profile_id) where organization_id is null;
update public.host_vendor_profiles set organization_id = private.active_organization_for_profile(owner_profile_id) where organization_id is null;
update public.host_event_imports set organization_id = private.active_organization_for_profile(owner_profile_id) where organization_id is null;

create or replace function private.set_profile_owned_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  v_profile := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if new.organization_id is null and v_profile is not null then
    new.organization_id := private.active_organization_for_profile(v_profile);
  end if;
  return new;
end;
$$;

revoke all on function private.set_profile_owned_organization() from public;

drop trigger if exists host_library_items_set_organization on public.host_library_items;
create trigger host_library_items_set_organization before insert or update of owner_profile_id, organization_id on public.host_library_items for each row execute function private.set_profile_owned_organization('owner_profile_id');
drop trigger if exists host_communication_templates_set_organization on public.host_communication_templates;
create trigger host_communication_templates_set_organization before insert or update of owner_profile_id, organization_id on public.host_communication_templates for each row execute function private.set_profile_owned_organization('owner_profile_id');
drop trigger if exists host_opportunities_set_organization on public.host_opportunities;
create trigger host_opportunities_set_organization before insert or update of owner_profile_id, organization_id on public.host_opportunities for each row execute function private.set_profile_owned_organization('owner_profile_id');
drop trigger if exists host_vendor_profiles_set_organization on public.host_vendor_profiles;
create trigger host_vendor_profiles_set_organization before insert or update of owner_profile_id, organization_id on public.host_vendor_profiles for each row execute function private.set_profile_owned_organization('owner_profile_id');
drop trigger if exists host_event_imports_set_organization on public.host_event_imports;
create trigger host_event_imports_set_organization before insert or update of owner_profile_id, organization_id on public.host_event_imports for each row execute function private.set_profile_owned_organization('owner_profile_id');

-- RLS for the new tenancy and authorization tables.
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
grant select, insert, update, delete on public.organization_member_roles to authenticated;
grant select, insert, update, delete on public.profile_workspace_preferences to authenticated;

drop policy if exists "Organizations are visible to allowed users" on public.organizations;
create policy "Organizations are visible to allowed users"
on public.organizations for select to authenticated
using (
  visibility = 'public'
  or private.is_organization_member(id, (select auth.uid()))
  or private.is_platform_operator((select auth.uid()))
);

drop policy if exists "Authenticated users create their own organizations" on public.organizations;
create policy "Authenticated users create their own organizations"
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
create policy "System roles readable" on public.organization_system_roles
for select to authenticated using (true);

drop policy if exists "Permission catalog readable" on public.organization_permissions;
create policy "Permission catalog readable" on public.organization_permissions
for select to authenticated using (true);

drop policy if exists "Role permission matrix readable" on public.organization_role_permissions;
create policy "Role permission matrix readable" on public.organization_role_permissions
for select to authenticated using (true);

drop policy if exists "Organization members can view membership" on public.organization_memberships;
create policy "Organization members can view membership"
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
    or private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
    or private.is_platform_operator((select auth.uid()))
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
    or private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
    or private.is_platform_operator((select auth.uid()))
  )
);

drop policy if exists "Organization members can view roles" on public.organization_member_roles;
create policy "Organization members can view roles"
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

drop policy if exists "Role managers update roles" on public.organization_member_roles;
create policy "Role managers update roles"
on public.organization_member_roles for update to authenticated
using (private.has_organization_permission(organization_id, 'roles.manage', (select auth.uid())))
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
    or private.has_organization_role(organization_id, array['owner'], (select auth.uid()))
    or private.is_platform_operator((select auth.uid()))
  )
);

drop policy if exists "Members read their workspace preference" on public.profile_workspace_preferences;
create policy "Members read their workspace preference"
on public.profile_workspace_preferences for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "Members create their workspace preference" on public.profile_workspace_preferences;
create policy "Members create their workspace preference"
on public.profile_workspace_preferences for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and private.is_organization_member(active_organization_id, (select auth.uid()))
);

drop policy if exists "Members update their workspace preference" on public.profile_workspace_preferences;
create policy "Members update their workspace preference"
on public.profile_workspace_preferences for update to authenticated
using (profile_id = (select auth.uid()))
with check (
  profile_id = (select auth.uid())
  and private.is_organization_member(active_organization_id, (select auth.uid()))
);

drop policy if exists "Members delete their workspace preference" on public.profile_workspace_preferences;
create policy "Members delete their workspace preference"
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
      (select array_agg(r.role_code order by sr.priority, r.role_code)
       from public.organization_member_roles r
       join public.organization_system_roles sr on sr.code = r.role_code
       where r.organization_id = o.id and r.profile_id = (select auth.uid())),
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
revoke all on function public.organization_has_permission(uuid,text) from public;
grant execute on function public.list_my_organizations() to authenticated;
grant execute on function public.set_active_organization(uuid) to authenticated;
grant execute on function public.organization_has_permission(uuid,text) to authenticated;

notify pgrst, 'reload schema';
