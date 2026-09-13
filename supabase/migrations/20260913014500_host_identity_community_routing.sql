-- Host identity community routing
-- Tenant ownership stays on platform organizations. Public host identity determines
-- which host community receives an event.

alter table public.community_groups
  add column if not exists host_organization_id uuid references public.host_organizations(id) on delete set null;

alter table public.host_organizations
  add column if not exists primary_community_id uuid references public.community_groups(id) on delete set null;

alter table public.organizations
  add column if not exists primary_host_organization_id uuid references public.host_organizations(id) on delete set null;

create index if not exists community_groups_host_organization_idx
  on public.community_groups(host_organization_id)
  where host_organization_id is not null;

create index if not exists host_organizations_primary_community_idx
  on public.host_organizations(primary_community_id)
  where primary_community_id is not null;

-- Attach existing same-name host communities to their public host identity first.
update public.community_groups g
set host_organization_id = h.id,
    organization_id = h.platform_organization_id,
    community_type = 'host',
    owner_type = 'host',
    host_profile_id = coalesce(g.host_profile_id, h.created_by)
from public.host_organizations h
where h.platform_organization_id is not null
  and not coalesce(g.is_topic, false)
  and lower(btrim(g.name)) = lower(btrim(h.name))
  and (g.host_organization_id is null or g.host_organization_id = h.id);

-- Go Melanated currently has legacy duplicate MA host identities. Prefer the
-- canonical identity already used by published events and by current product language.
update public.organizations o
set primary_host_organization_id = h.id,
    updated_at = now()
from lateral (
  select ho.id
  from public.host_organizations ho
  where ho.platform_organization_id = o.id
    and lower(btrim(ho.name)) = 'melanated adventurers'
  order by ho.created_at asc, ho.id asc
  limit 1
) h
where o.slug = 'go-melanated';

-- Other tenants with exactly one public host identity can resolve safely.
with single_identity as (
  select platform_organization_id,
         (array_agg(id order by created_at asc, id asc))[1] as host_organization_id
  from public.host_organizations
  where platform_organization_id is not null
  group by platform_organization_id
  having count(*) = 1
)
update public.organizations o
set primary_host_organization_id = s.host_organization_id,
    updated_at = now()
from single_identity s
where o.id = s.platform_organization_id
  and o.primary_host_organization_id is null;

-- Create the real Melanated Adventurers host community if the canonical public
-- host identity does not already have one. No topic-room memberships are copied.
insert into public.community_groups (
  name,
  description,
  kind,
  city,
  state,
  image_url,
  cover_image_url,
  visibility,
  created_by,
  management_type,
  community_type,
  owner_type,
  host_profile_id,
  is_topic,
  organization_id,
  host_organization_id
)
select
  h.name,
  nullif(btrim(h.description), ''),
  'local',
  h.city,
  h.state,
  h.logo_url,
  h.cover_image_url,
  'public',
  h.created_by,
  'member_led',
  'host',
  'host',
  h.created_by,
  false,
  h.platform_organization_id,
  h.id
from public.host_organizations h
join public.organizations o on o.primary_host_organization_id = h.id
where o.slug = 'go-melanated'
  and lower(btrim(h.name)) = 'melanated adventurers'
  and not exists (
    select 1
    from public.community_groups g
    where g.host_organization_id = h.id
      and not coalesce(g.is_topic, false)
  );

-- Resolve each host identity's primary community only when the relationship is
-- explicit or there is exactly one host community for that identity.
with candidates as (
  select h.id as host_organization_id,
         (array_agg(g.id order by
           case when lower(btrim(g.name)) = lower(btrim(h.name)) then 0 else 1 end,
           g.created_at asc,
           g.id asc
         ))[1] as group_id,
         count(*) as group_count,
         count(*) filter (where lower(btrim(g.name)) = lower(btrim(h.name))) as name_match_count
  from public.host_organizations h
  join public.community_groups g
    on g.host_organization_id = h.id
   and not coalesce(g.is_topic, false)
  group by h.id
)
update public.host_organizations h
set primary_community_id = c.group_id,
    updated_at = now()
from candidates c
where h.id = c.host_organization_id
  and h.primary_community_id is null
  and (c.name_match_count = 1 or c.group_count = 1);

-- The owner of a host identity is a host in its primary community. This is an
-- ownership relationship, not synthetic member activity.
insert into public.community_group_members (group_id, profile_id, role)
select h.primary_community_id, h.created_by, 'host'
from public.host_organizations h
where h.primary_community_id is not null
  and h.created_by is not null
on conflict (group_id, profile_id)
do update set role = case
  when public.community_group_members.role = 'moderator' then public.community_group_members.role
  else 'host'
end;

-- The tenant-level primary community from the previous migration is no longer
-- authoritative. Keep the column for migration compatibility but clear it.
update public.organizations
set primary_community_id = null
where primary_community_id is not null;

comment on column public.organizations.primary_community_id is
  'Deprecated compatibility field. Public host identity owns primary community routing.';
comment on column public.organizations.primary_host_organization_id is
  'Default public host identity for Host Center inside this tenant.';
comment on column public.host_organizations.primary_community_id is
  'Primary community for events presented by this public host identity.';
comment on column public.community_groups.host_organization_id is
  'Public host identity that owns this host community. organization_id remains the tenant boundary.';

create or replace function private.validate_primary_host_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_host_organization_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.host_organizations h
    where h.id = new.primary_host_organization_id
      and h.platform_organization_id = new.id
  ) then
    raise exception 'Primary host identity must belong to this organization';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_primary_host_identity() from public;

drop trigger if exists organizations_validate_primary_host_identity on public.organizations;
create trigger organizations_validate_primary_host_identity
before insert or update of primary_host_organization_id
on public.organizations
for each row execute function private.validate_primary_host_identity();

create or replace function private.validate_host_identity_primary_community()
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
      and g.organization_id = new.platform_organization_id
      and g.host_organization_id = new.id
      and g.community_type = 'host'
      and not coalesce(g.is_topic, false)
  ) then
    raise exception 'Primary community must belong to this public host identity';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_host_identity_primary_community() from public;

drop trigger if exists host_organizations_validate_primary_community on public.host_organizations;
create trigger host_organizations_validate_primary_community
before insert or update of primary_community_id, platform_organization_id
on public.host_organizations
for each row execute function private.validate_host_identity_primary_community();

create or replace function public.set_host_organization_primary_community(
  p_host_organization_id uuid,
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_platform_org uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select h.platform_organization_id
    into v_platform_org
  from public.host_organizations h
  where h.id = p_host_organization_id;

  if v_platform_org is null then
    raise exception 'Host identity organization could not be resolved';
  end if;

  if not private.has_organization_permission(v_platform_org, 'events.manage', v_actor) then
    raise exception 'Event management permission required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.community_groups g
    where g.id = p_group_id
      and g.organization_id = v_platform_org
      and not coalesce(g.is_topic, false)
      and (g.host_organization_id is null or g.host_organization_id = p_host_organization_id)
      and (
        g.host_organization_id = p_host_organization_id
        or g.created_by = v_actor
        or exists (
          select 1
          from public.community_group_members gm
          where gm.group_id = g.id
            and gm.profile_id = v_actor
            and gm.role in ('host', 'moderator')
        )
      )
  ) then
    raise exception 'Community is not available to this host identity';
  end if;

  update public.community_groups
  set host_organization_id = p_host_organization_id,
      organization_id = v_platform_org,
      owner_type = 'host',
      community_type = 'host',
      updated_at = now()
  where id = p_group_id;

  update public.host_organizations
  set primary_community_id = p_group_id,
      updated_at = now()
  where id = p_host_organization_id;

  delete from public.community_outings co
  using public.adventures a
  where co.adventure_id = a.id
    and a.organization_id = p_host_organization_id
    and co.is_primary
    and co.group_id <> p_group_id;

  insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
  select p_group_id, a.id, a.created_by, true
  from public.adventures a
  where a.organization_id = p_host_organization_id
    and a.status = 'published'
  on conflict (group_id, adventure_id)
  do update set is_primary = true, shared_by = excluded.shared_by;
end;
$$;

create or replace function public.get_host_organization_primary_community(p_host_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.primary_community_id
  from public.host_organizations h
  where h.id = p_host_organization_id
    and h.platform_organization_id is not null
    and private.has_organization_permission(h.platform_organization_id, 'events.manage', auth.uid())
  limit 1;
$$;

create or replace function public.list_host_organization_communities(p_host_organization_id uuid)
returns table(group_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.host_organizations h
  join public.community_groups g
    on g.organization_id = h.platform_organization_id
  where h.id = p_host_organization_id
    and h.platform_organization_id is not null
    and private.has_organization_permission(h.platform_organization_id, 'events.manage', auth.uid())
    and not coalesce(g.is_topic, false)
    and (
      g.host_organization_id = h.id
      or (
        g.host_organization_id is null
        and (
          g.created_by = auth.uid()
          or exists (
            select 1
            from public.community_group_members gm
            where gm.group_id = g.id
              and gm.profile_id = auth.uid()
              and gm.role in ('host', 'moderator')
          )
        )
      )
    )
  order by
    case when g.host_organization_id = h.id then 0 else 1 end,
    g.name asc;
$$;

create or replace function public.get_active_host_organization_context()
returns table(host_organization_id uuid, host_name text, primary_community_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with active_org as (
    select private.active_organization_for_profile(auth.uid()) as id
  )
  select h.id, h.name, h.primary_community_id
  from active_org a
  join public.organizations o on o.id = a.id
  join public.host_organizations h on h.id = o.primary_host_organization_id
  where auth.uid() is not null
    and private.has_organization_permission(o.id, 'events.manage', auth.uid())
  limit 1;
$$;

revoke all on function public.set_host_organization_primary_community(uuid, uuid) from public, anon;
revoke all on function public.get_host_organization_primary_community(uuid) from public, anon;
revoke all on function public.list_host_organization_communities(uuid) from public, anon;
revoke all on function public.get_active_host_organization_context() from public, anon;
grant execute on function public.set_host_organization_primary_community(uuid, uuid) to authenticated;
grant execute on function public.get_host_organization_primary_community(uuid) to authenticated;
grant execute on function public.list_host_organization_communities(uuid) to authenticated;
grant execute on function public.get_active_host_organization_context() to authenticated;

-- Supersede the previous tenant-level helper. It now delegates to the active
-- tenant's default public host identity instead of storing a tenant-wide community.
create or replace function public.set_primary_host_community(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_org uuid;
begin
  select host_organization_id into v_host_org
  from public.get_active_host_organization_context()
  limit 1;

  if v_host_org is null then
    raise exception 'No default public host identity is configured';
  end if;

  perform public.set_host_organization_primary_community(v_host_org, p_group_id);
end;
$$;

create or replace function public.get_active_organization_primary_community()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.primary_community_id
  from public.get_active_host_organization_context() c
  limit 1;
$$;

create or replace function public.list_active_organization_host_communities()
returns table(group_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.group_id
  from public.get_active_host_organization_context() h
  cross join lateral public.list_host_organization_communities(h.host_organization_id) c;
$$;

-- Event -> community sync follows the event's public host identity. Tenant
-- ownership is still validated through platform_organization_id.
create or replace function public.sync_host_outing_to_primary_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
  host_platform_org uuid;
begin
  if tg_op = 'UPDATE'
    and (
      old.organization_id is distinct from new.organization_id
      or old.platform_organization_id is distinct from new.platform_organization_id
    )
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

  if new.status <> 'published' or new.organization_id is null then
    return new;
  end if;

  select h.primary_community_id, h.platform_organization_id
    into target_group, host_platform_org
  from public.host_organizations h
  where h.id = new.organization_id;

  if host_platform_org is distinct from new.platform_organization_id then
    raise exception 'Event host identity and tenant organization do not match';
  end if;

  if target_group is null then
    return new;
  end if;

  insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
  values (target_group, new.id, new.created_by, true)
  on conflict (group_id, adventure_id)
  do update set is_primary = true, shared_by = excluded.shared_by;

  return new;
end;
$$;

drop trigger if exists adventures_sync_primary_community_outing on public.adventures;
create trigger adventures_sync_primary_community_outing
after insert or update of status, organization_id, platform_organization_id
on public.adventures
for each row execute function public.sync_host_outing_to_primary_community();

-- Remove primary links produced by the tenant-wide fallback and rebuild only
-- from explicit public host identities. Intentional non-primary shares remain.
delete from public.community_outings
where is_primary;

insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
select h.primary_community_id, a.id, a.created_by, true
from public.adventures a
join public.host_organizations h on h.id = a.organization_id
where a.status = 'published'
  and h.primary_community_id is not null
  and h.platform_organization_id = a.platform_organization_id
on conflict (group_id, adventure_id)
do update set is_primary = true, shared_by = excluded.shared_by;
