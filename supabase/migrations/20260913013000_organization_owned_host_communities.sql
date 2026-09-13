-- Organization-owned host communities
-- Makes the active platform organization, not an individual host profile, the
-- source of truth for a host community and for automatic event -> outing sync.

alter table public.community_groups
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists community_groups_organization_idx
  on public.community_groups(organization_id, created_at desc);

-- Adventure groups inherit the same tenant as their adventure.
update public.community_groups g
set organization_id = a.platform_organization_id
from public.adventures a
where g.organization_id is null
  and g.adventure_id = a.id
  and a.platform_organization_id is not null;

-- When a community name matches an existing public host identity, use that
-- identity's platform organization. This captures the clearest legacy mappings.
update public.community_groups g
set organization_id = h.platform_organization_id,
    owner_type = case when coalesce(g.is_topic, false) then g.owner_type else 'host' end,
    community_type = case when coalesce(g.is_topic, false) then g.community_type else 'host' end
from public.host_organizations h
where g.organization_id is null
  and h.platform_organization_id is not null
  and not coalesce(g.is_topic, false)
  and lower(btrim(g.name)) = lower(btrim(h.name));

-- For remaining host communities, prefer the platform organization represented
-- by the group's host/creator through the legacy host-organization bridge.
with group_profiles as (
  select
    g.id as group_id,
    coalesce(g.host_profile_id, g.created_by) as profile_id,
    g.name
  from public.community_groups g
  where g.organization_id is null
    and g.community_type = 'host'
    and not coalesce(g.is_topic, false)
), ranked_candidates as (
  select
    gp.group_id,
    h.platform_organization_id as organization_id,
    row_number() over (
      partition by gp.group_id
      order by
        case
          when lower(btrim(h.name)) = lower(btrim(gp.name)) then 0
          when h.created_by = gp.profile_id then 1
          else 2
        end,
        h.created_at asc,
        h.id asc
    ) as candidate_rank
  from group_profiles gp
  join public.host_organizations h
    on h.platform_organization_id is not null
   and gp.profile_id is not null
   and (
     h.created_by = gp.profile_id
     or exists (
       select 1
       from public.host_organization_members hm
       where hm.organization_id = h.id
         and hm.profile_id = gp.profile_id
         and hm.role in ('owner', 'admin', 'host')
     )
   )
)
update public.community_groups g
set organization_id = c.organization_id
from ranked_candidates c
where g.id = c.group_id
  and c.candidate_rank = 1
  and g.organization_id is null;

-- A legacy host community without a host-organization bridge follows the
-- creator's active organization when that context still exists.
update public.community_groups g
set organization_id = wp.active_organization_id
from public.profile_workspace_preferences wp
where g.organization_id is null
  and wp.profile_id = coalesce(g.host_profile_id, g.created_by)
  and exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = wp.active_organization_id
      and m.profile_id = wp.profile_id
      and m.status = 'active'
  );

-- Existing member communities predate tenancy and belong to the original Go
-- Melanated experience unless a stronger mapping above resolved them.
update public.community_groups g
set organization_id = o.id
from public.organizations o
where g.organization_id is null
  and o.is_platform_default = true;

alter table public.community_groups
  alter column organization_id set not null;

comment on column public.community_groups.organization_id is
  'Platform organization that owns and scopes this community.';
comment on column public.community_groups.host_profile_id is
  'Legacy host/steward reference. Organization ownership is authoritative for host communities.';

-- New groups inherit tenant ownership automatically. Adventure-backed groups
-- must stay in the same organization as the underlying adventure.
create or replace function private.assign_community_group_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adventure_org uuid;
begin
  if new.adventure_id is not null then
    select a.platform_organization_id
      into v_adventure_org
    from public.adventures a
    where a.id = new.adventure_id;

    if v_adventure_org is null then
      raise exception 'Adventure organization could not be resolved';
    end if;

    if new.organization_id is not null
      and new.organization_id is distinct from v_adventure_org
    then
      raise exception 'Community and adventure must belong to the same organization';
    end if;

    new.organization_id := v_adventure_org;
  elsif new.organization_id is null and new.created_by is not null then
    new.organization_id := private.active_organization_for_profile(new.created_by);
  end if;

  if new.organization_id is null then
    select o.id
      into new.organization_id
    from public.organizations o
    where o.is_platform_default = true
    limit 1;
  end if;

  if new.organization_id is null then
    raise exception 'Community organization could not be resolved';
  end if;

  return new;
end;
$$;

revoke all on function private.assign_community_group_organization() from public;

drop trigger if exists community_groups_assign_organization on public.community_groups;
create trigger community_groups_assign_organization
before insert or update of adventure_id, organization_id
on public.community_groups
for each row execute function private.assign_community_group_organization();

-- The primary host community belongs to the organization, so every teammate
-- publishing for that organization shares the same destination.
alter table public.organizations
  add column if not exists primary_community_id uuid references public.community_groups(id) on delete set null;

comment on column public.organizations.primary_community_id is
  'Primary host community used for published events owned by this organization.';

-- Preserve any unambiguous primary choice from the profile-scoped V2 model.
with existing_choices as (
  select
    g.organization_id,
    (array_agg(distinct hp.primary_community_id))[1] as group_id
  from public.host_profiles hp
  join public.community_groups g on g.id = hp.primary_community_id
  where hp.primary_community_id is not null
    and not coalesce(g.is_topic, false)
  group by g.organization_id
  having count(distinct hp.primary_community_id) = 1
)
update public.organizations o
set primary_community_id = c.group_id
from existing_choices c
where o.id = c.organization_id
  and o.primary_community_id is null;

-- Prefer a host community whose name matches one of the organization's public
-- host identities when no explicit legacy choice exists.
with named_matches as (
  select
    h.platform_organization_id as organization_id,
    (array_agg(g.id order by g.created_at asc, g.id asc))[1] as group_id
  from public.host_organizations h
  join public.community_groups g
    on g.organization_id = h.platform_organization_id
   and not coalesce(g.is_topic, false)
   and lower(btrim(g.name)) = lower(btrim(h.name))
  where h.platform_organization_id is not null
  group by h.platform_organization_id
)
update public.organizations o
set primary_community_id = m.group_id
from named_matches m
where o.id = m.organization_id
  and o.primary_community_id is null;

-- If an organization has exactly one host community, it is safe to make that
-- community primary without user input.
with single_host_community as (
  select
    g.organization_id,
    (array_agg(g.id order by g.created_at asc, g.id asc))[1] as group_id
  from public.community_groups g
  where g.community_type = 'host'
    and not coalesce(g.is_topic, false)
  group by g.organization_id
  having count(*) = 1
)
update public.organizations o
set primary_community_id = s.group_id
from single_host_community s
where o.id = s.organization_id
  and o.primary_community_id is null;

-- Prevent direct organization updates from pointing at another tenant's group
-- or at a generic topic room.
create or replace function private.validate_organization_primary_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_community_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.community_groups g
    where g.id = new.primary_community_id
      and g.organization_id = new.id
      and g.community_type = 'host'
      and not coalesce(g.is_topic, false)
  ) then
    raise exception 'Primary community must be a host community owned by this organization';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_organization_primary_community() from public;

drop trigger if exists organizations_validate_primary_community on public.organizations;
create trigger organizations_validate_primary_community
before insert or update of primary_community_id
on public.organizations
for each row execute function private.validate_organization_primary_community();

-- Keep the existing RPC name for mobile compatibility, but make the active
-- organization authoritative. An organization manager may keep an existing
-- host community or promote a community they personally manage.
create or replace function public.set_primary_host_community(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_org uuid;
  v_group public.community_groups%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_org := private.active_organization_for_profile(v_actor);
  if v_org is null then
    raise exception 'Active organization could not be resolved';
  end if;

  if not private.has_organization_permission(v_org, 'events.manage', v_actor) then
    raise exception 'Event management permission required' using errcode = '42501';
  end if;

  select * into v_group
  from public.community_groups g
  where g.id = p_group_id
    and g.organization_id = v_org
    and not coalesce(g.is_topic, false);

  if not found then
    raise exception 'Community is not available in the active organization';
  end if;

  if v_group.community_type <> 'host'
    and v_group.created_by is distinct from v_actor
    and not exists (
      select 1
      from public.community_group_members gm
      where gm.group_id = p_group_id
        and gm.profile_id = v_actor
        and gm.role in ('host', 'moderator')
    )
  then
    raise exception 'You do not manage this community';
  end if;

  update public.community_groups
  set owner_type = 'host',
      community_type = 'host',
      updated_at = now()
  where id = p_group_id;

  update public.organizations
  set primary_community_id = p_group_id,
      updated_at = now()
  where id = v_org;

  -- Mirror the selection for the current profile only so older screens remain
  -- compatible. This field is no longer authoritative across teammates.
  update public.host_profiles
  set primary_community_id = p_group_id
  where profile_id = v_actor;

  -- Repoint every published event owned by the organization, regardless of
  -- which teammate created it. Deliberate non-primary shares are preserved.
  delete from public.community_outings co
  using public.adventures a
  where co.adventure_id = a.id
    and a.platform_organization_id = v_org
    and co.is_primary
    and co.group_id <> p_group_id;

  insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
  select p_group_id, a.id, a.created_by, true
  from public.adventures a
  where a.platform_organization_id = v_org
    and a.status = 'published'
  on conflict (group_id, adventure_id)
  do update set
    is_primary = true,
    shared_by = excluded.shared_by;
end;
$$;

create or replace function public.get_active_organization_primary_community()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.primary_community_id
  from public.organizations o
  where o.id = private.active_organization_for_profile(auth.uid())
    and private.is_organization_member(o.id, auth.uid())
  limit 1;
$$;

create or replace function public.list_active_organization_host_communities()
returns table(group_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with active_org as (
    select private.active_organization_for_profile(auth.uid()) as id
  )
  select g.id
  from public.community_groups g
  join active_org o on o.id = g.organization_id
  where auth.uid() is not null
    and not coalesce(g.is_topic, false)
    and private.has_organization_permission(o.id, 'events.manage', auth.uid())
    and (
      g.community_type = 'host'
      or g.created_by = auth.uid()
      or exists (
        select 1
        from public.community_group_members gm
        where gm.group_id = g.id
          and gm.profile_id = auth.uid()
          and gm.role in ('host', 'moderator')
      )
    )
  order by
    case when g.community_type = 'host' then 0 else 1 end,
    g.name asc;
$$;

revoke all on function public.set_primary_host_community(uuid) from public, anon;
revoke all on function public.get_active_organization_primary_community() from public, anon;
revoke all on function public.list_active_organization_host_communities() from public, anon;
grant execute on function public.set_primary_host_community(uuid) to authenticated;
grant execute on function public.get_active_organization_primary_community() to authenticated;
grant execute on function public.list_active_organization_host_communities() to authenticated;

-- Event -> community sync now follows the event's tenant, not its creator.
create or replace function public.sync_host_outing_to_primary_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
begin
  if tg_op = 'UPDATE'
    and old.platform_organization_id is distinct from new.platform_organization_id
  then
    delete from public.community_outings
    where adventure_id = new.id;
  elsif new.status <> 'published' then
    delete from public.community_outings
    where adventure_id = new.id;
    return new;
  else
    delete from public.community_outings
    where adventure_id = new.id
      and is_primary;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  select o.primary_community_id
    into target_group
  from public.organizations o
  where o.id = new.platform_organization_id;

  if target_group is null then
    return new;
  end if;

  insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
  values (target_group, new.id, new.created_by, true)
  on conflict (group_id, adventure_id)
  do update set
    is_primary = true,
    shared_by = excluded.shared_by;

  return new;
end;
$$;

drop trigger if exists adventures_sync_primary_community_outing on public.adventures;
create trigger adventures_sync_primary_community_outing
after insert or update of status, platform_organization_id
on public.adventures
for each row execute function public.sync_host_outing_to_primary_community();

-- Reconcile existing primary links to organization ownership while preserving
-- explicit non-primary shares.
delete from public.community_outings co
using public.adventures a
where co.adventure_id = a.id
  and co.is_primary
  and not exists (
    select 1
    from public.organizations o
    where o.id = a.platform_organization_id
      and o.primary_community_id = co.group_id
  );

insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
select o.primary_community_id, a.id, a.created_by, true
from public.adventures a
join public.organizations o on o.id = a.platform_organization_id
where a.status = 'published'
  and o.primary_community_id is not null
on conflict (group_id, adventure_id)
do update set
  is_primary = true,
  shared_by = excluded.shared_by;
