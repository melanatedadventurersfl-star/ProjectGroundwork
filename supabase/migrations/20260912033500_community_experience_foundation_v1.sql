-- Community Experience Foundation V1
-- Turns Go Melanated into the first configured instance of a reusable public experience.

create table if not exists public.experience_blueprints (
  code text primary key,
  name text not null,
  description text not null default '',
  version integer not null default 1 check (version > 0),
  default_modules jsonb not null default '[]'::jsonb,
  default_settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_experiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experience_key text not null default 'primary',
  name text not null,
  public_slug text not null unique,
  blueprint_code text not null references public.experience_blueprints(code) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  branding jsonb not null default '{}'::jsonb,
  navigation jsonb not null default '{}'::jsonb,
  terminology jsonb not null default '{}'::jsonb,
  home_layout jsonb not null default '[]'::jsonb,
  membership_settings jsonb not null default '{}'::jsonb,
  public_settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, experience_key),
  check (experience_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  check (public_slug ~ '^[a-z0-9][a-z0-9-]*$')
);

create index if not exists organization_experiences_org_status_idx
  on public.organization_experiences(organization_id, status);

create table if not exists public.organization_experience_modules (
  experience_id uuid not null references public.organization_experiences(id) on delete cascade,
  module_code text not null,
  label text not null,
  enabled boolean not null default true,
  nav_position integer,
  route_key text,
  icon_key text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (experience_id, module_code),
  check (module_code ~ '^[a-z0-9][a-z0-9_-]*$')
);

create index if not exists organization_experience_modules_enabled_idx
  on public.organization_experience_modules(experience_id, enabled, nav_position);

drop trigger if exists experience_blueprints_set_updated_at on public.experience_blueprints;
create trigger experience_blueprints_set_updated_at
before update on public.experience_blueprints
for each row execute function public.set_updated_at();

drop trigger if exists organization_experiences_set_updated_at on public.organization_experiences;
create trigger organization_experiences_set_updated_at
before update on public.organization_experiences
for each row execute function public.set_updated_at();

drop trigger if exists organization_experience_modules_set_updated_at on public.organization_experience_modules;
create trigger organization_experience_modules_set_updated_at
before update on public.organization_experience_modules
for each row execute function public.set_updated_at();

alter table public.experience_blueprints enable row level security;
alter table public.organization_experiences enable row level security;
alter table public.organization_experience_modules enable row level security;

revoke all on public.experience_blueprints from anon, authenticated;
revoke all on public.organization_experiences from anon, authenticated;
revoke all on public.organization_experience_modules from anon, authenticated;

grant select, insert, update, delete on public.experience_blueprints to authenticated;
grant select, insert, update, delete on public.organization_experiences to authenticated;
grant select, insert, update, delete on public.organization_experience_modules to authenticated;

drop policy if exists "Authenticated read active experience blueprints" on public.experience_blueprints;
create policy "Authenticated read active experience blueprints"
on public.experience_blueprints for select
to authenticated
using (is_active = true or (select private.is_platform_operator()));

drop policy if exists "Platform operators manage experience blueprints" on public.experience_blueprints;
create policy "Platform operators manage experience blueprints"
on public.experience_blueprints for all
to authenticated
using ((select private.is_platform_operator()))
with check ((select private.is_platform_operator()));

drop policy if exists "Organization members read experiences" on public.organization_experiences;
create policy "Organization members read experiences"
on public.organization_experiences for select
to authenticated
using (
  (select private.is_platform_operator())
  or (select private.is_organization_member(organization_id))
);

drop policy if exists "Organization admins create experiences" on public.organization_experiences;
create policy "Organization admins create experiences"
on public.organization_experiences for insert
to authenticated
with check (
  (select private.is_platform_operator())
  or (select private.has_organization_permission(organization_id, 'organization.settings.manage'))
);

drop policy if exists "Organization admins update experiences" on public.organization_experiences;
create policy "Organization admins update experiences"
on public.organization_experiences for update
to authenticated
using (
  (select private.is_platform_operator())
  or (select private.has_organization_permission(organization_id, 'organization.settings.manage'))
)
with check (
  (select private.is_platform_operator())
  or (select private.has_organization_permission(organization_id, 'organization.settings.manage'))
);

drop policy if exists "Organization admins delete experiences" on public.organization_experiences;
create policy "Organization admins delete experiences"
on public.organization_experiences for delete
to authenticated
using (
  (select private.is_platform_operator())
  or (select private.has_organization_permission(organization_id, 'organization.settings.manage'))
);

drop policy if exists "Organization members read experience modules" on public.organization_experience_modules;
create policy "Organization members read experience modules"
on public.organization_experience_modules for select
to authenticated
using (
  exists (
    select 1
    from public.organization_experiences e
    where e.id = organization_experience_modules.experience_id
      and (
        (select private.is_platform_operator())
        or (select private.is_organization_member(e.organization_id))
      )
  )
);

drop policy if exists "Organization admins manage experience modules" on public.organization_experience_modules;
create policy "Organization admins manage experience modules"
on public.organization_experience_modules for all
to authenticated
using (
  exists (
    select 1
    from public.organization_experiences e
    where e.id = organization_experience_modules.experience_id
      and (
        (select private.is_platform_operator())
        or (select private.has_organization_permission(e.organization_id, 'organization.settings.manage'))
      )
  )
)
with check (
  exists (
    select 1
    from public.organization_experiences e
    where e.id = organization_experience_modules.experience_id
      and (
        (select private.is_platform_operator())
        or (select private.has_organization_permission(e.organization_id, 'organization.settings.manage'))
      )
  )
);

insert into public.experience_blueprints (
  code,
  name,
  description,
  version,
  default_modules,
  default_settings,
  is_active
)
values (
  'community',
  'Community Experience',
  'Reusable member-facing community experience with events, community, profiles, groups, discovery, memberships and saved content.',
  1,
  '["home","events","community","profiles","groups","directory","calendar","notifications","memberships","search","saved"]'::jsonb,
  '{"supports_branding":true,"supports_custom_navigation":true,"supports_custom_terminology":true,"supports_home_layout":true}'::jsonb,
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  version = excluded.version,
  default_modules = excluded.default_modules,
  default_settings = excluded.default_settings,
  is_active = excluded.is_active;

insert into public.organization_experiences (
  organization_id,
  experience_key,
  name,
  public_slug,
  blueprint_code,
  status,
  branding,
  navigation,
  terminology,
  home_layout,
  membership_settings,
  public_settings,
  created_by
)
select
  o.id,
  'primary',
  'Go Melanated',
  'go-melanated',
  'community',
  'active',
  '{"brand_name":"Go Melanated","primary":"#0B100D","surface":"#151B17","accent":"#D7B45A","text":"#FFF8E8"}'::jsonb,
  '{"style":"community","show_brand_name":true}'::jsonb,
  '{"home":"Trailhead","events":"Explore","community":"Outpost","directory":"Trail Guide","journey":"Passport","member":"Member","host":"Host"}'::jsonb,
  '["hero","upcoming_events","community_activity","recommendations"]'::jsonb,
  '{"mode":"community"}'::jsonb,
  '{"discoverable":true,"allow_public_events":true}'::jsonb,
  o.created_by
from public.organizations o
where o.slug = 'go-melanated'
on conflict (organization_id, experience_key) do nothing;

insert into public.organization_experience_modules (
  experience_id,
  module_code,
  label,
  enabled,
  nav_position,
  route_key,
  icon_key,
  settings
)
select e.id, v.module_code, v.label, v.enabled, v.nav_position, v.route_key, v.icon_key, v.settings
from public.organization_experiences e
join public.organizations o on o.id = e.organization_id
cross join (
  values
    ('home', 'Trailhead', true, 10, '/(tabs)', 'home', '{}'::jsonb),
    ('events', 'Explore', true, 20, '/(tabs)/explore', 'adventure', '{}'::jsonb),
    ('community', 'Outpost', true, 30, '/(tabs)/community', 'community', '{}'::jsonb),
    ('profiles', 'Profiles', true, null, '/member/profile', 'profile', '{}'::jsonb),
    ('groups', 'Groups', true, null, '/groups', 'connections', '{}'::jsonb),
    ('directory', 'Trail Guide', true, null, '/trail-guide', 'directory', '{"pack":"outdoor_adventure"}'::jsonb),
    ('journey', 'Passport', true, null, '/(tabs)/passport', 'passport', '{"pack":"outdoor_adventure"}'::jsonb),
    ('calendar', 'Calendar', true, null, '/calendar', 'calendar', '{}'::jsonb),
    ('notifications', 'Notifications', true, null, '/notifications', 'notifications', '{}'::jsonb),
    ('memberships', 'Go+', true, null, '/member/go-plus', 'membership', '{"pack":"go_melanated"}'::jsonb),
    ('search', 'Search', true, null, null, 'search', '{}'::jsonb),
    ('saved', 'Saved', true, null, null, 'bookmark', '{}'::jsonb),
    ('menu', 'Menu', true, 90, '/(tabs)/menu', 'menu', '{}'::jsonb)
) as v(module_code, label, enabled, nav_position, route_key, icon_key, settings)
where o.slug = 'go-melanated'
  and e.experience_key = 'primary'
on conflict (experience_id, module_code) do nothing;

alter table public.adventures
  add column if not exists public_experience_id uuid references public.organization_experiences(id) on delete set null;

create index if not exists adventures_public_experience_idx
  on public.adventures(public_experience_id, status, starts_at);

create or replace function private.assign_and_validate_adventure_public_experience()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if new.public_experience_id is null and new.platform_organization_id is not null then
    select e.id
    into new.public_experience_id
    from public.organization_experiences e
    where e.organization_id = new.platform_organization_id
      and e.experience_key = 'primary'
      and e.status in ('active', 'draft')
    order by case when e.status = 'active' then 0 else 1 end, e.created_at asc
    limit 1;
  end if;

  if new.public_experience_id is not null then
    select e.organization_id
    into v_organization_id
    from public.organization_experiences e
    where e.id = new.public_experience_id;

    if v_organization_id is null then
      raise exception 'Public experience does not exist';
    end if;

    if new.platform_organization_id is distinct from v_organization_id then
      raise exception 'Event and public experience must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.assign_and_validate_adventure_public_experience() from public;

drop trigger if exists adventures_assign_public_experience on public.adventures;
create trigger adventures_assign_public_experience
before insert or update of platform_organization_id, public_experience_id
on public.adventures
for each row execute function private.assign_and_validate_adventure_public_experience();

update public.adventures a
set public_experience_id = e.id
from public.organization_experiences e
where a.public_experience_id is null
  and e.organization_id = a.platform_organization_id
  and e.experience_key = 'primary'
  and e.status in ('active', 'draft');
