-- Tenant Event Builder Settings V1
-- Keeps event-builder vocabulary and defaults on the platform organization tenant.

alter table public.organizations
  add column if not exists event_builder_settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.event_builder_settings is
  'Tenant-controlled event builder schema: event types, tags, conditional difficulty, labels, visibility and defaults.';

-- Adventure difficulty remains populated for legacy compatibility, but generic events can explicitly hide it.
alter table public.adventures
  add column if not exists difficulty_applicable boolean not null default true,
  add column if not exists event_tags text[] not null default '{}'::text[];

comment on column public.adventures.difficulty_applicable is
  'Whether adventure difficulty is meaningful and should be shown for this event.';
comment on column public.adventures.event_tags is
  'Tenant-neutral event tags selected by the host. Outdoor interest linking remains available separately.';

create or replace view public.adventure_discovery as
select
  a.id,
  a.slug,
  a.title,
  a.summary,
  a.category,
  a.difficulty,
  a.status,
  a.starts_at,
  a.ends_at,
  a.city,
  a.state,
  a.venue_name,
  a.hero_image_url,
  a.capacity,
  a.spots_remaining,
  a.starting_price_cents,
  a.is_featured,
  a.address,
  a.latitude,
  a.longitude,
  a.timezone,
  a.difficulty_applicable,
  a.event_tags
from public.adventures a
where a.status in ('published', 'sold_out')
  and a.ends_at >= now();

alter view public.adventure_discovery set (security_invoker = true);
revoke all on public.adventure_discovery from anon;
grant select on public.adventure_discovery to authenticated;

-- Tenant event managers need to create the starter admission ticket even when they are not
-- legacy Go Melanated outing hosts. Existing legacy host policies remain in place.
drop policy if exists "Organization event managers manage ticket types" on public.ticket_types;
create policy "Organization event managers manage ticket types"
on public.ticket_types for all to authenticated
using (
  exists (
    select 1
    from public.adventures a
    where a.id = ticket_types.adventure_id
      and a.created_by = (select auth.uid())
      and a.platform_organization_id is not null
      and private.has_organization_permission(
        a.platform_organization_id,
        'events.manage',
        (select auth.uid())
      )
  )
)
with check (
  exists (
    select 1
    from public.adventures a
    where a.id = ticket_types.adventure_id
      and a.created_by = (select auth.uid())
      and a.platform_organization_id is not null
      and private.has_organization_permission(
        a.platform_organization_id,
        'events.manage',
        (select auth.uid())
      )
  )
);

-- Publish through either the legacy host approval path or the platform tenant RBAC path.
create or replace function public.publish_host_outing(p_adventure_id uuid)
returns public.adventures
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.adventures;
  has_ticket boolean;
  has_paid_ticket boolean;
  outing_owner uuid;
  outing_organization uuid;
  legacy_host boolean;
  tenant_publisher boolean;
begin
  select a.created_by, a.platform_organization_id
  into outing_owner, outing_organization
  from public.adventures a
  where a.id = p_adventure_id;

  if outing_owner is distinct from (select auth.uid()) then
    raise exception 'Outing not found';
  end if;

  legacy_host := public.is_approved_outing_host((select auth.uid()));
  tenant_publisher := outing_organization is not null
    and private.has_organization_permission(
      outing_organization,
      'events.publish',
      (select auth.uid())
    );

  if not legacy_host and not tenant_publisher then
    raise exception 'Event publishing permission required';
  end if;

  select
    exists(
      select 1
      from public.ticket_types
      where adventure_id = p_adventure_id and is_active
    ),
    exists(
      select 1
      from public.ticket_types
      where adventure_id = p_adventure_id and is_active and price_cents > 0
    )
  into has_ticket, has_paid_ticket;

  if not has_ticket then
    raise exception 'Add at least one ticket type before publishing';
  end if;

  if has_paid_ticket
    and not tenant_publisher
    and not public.can_host_paid_outings((select auth.uid())) then
    raise exception 'Paid outing approval is required before publishing paid tickets';
  end if;

  update public.adventures
  set status = 'published',
      published_at = coalesce(published_at, now()),
      spots_remaining = coalesce(spots_remaining, capacity)
  where id = p_adventure_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.publish_host_outing(uuid) from public;
grant execute on function public.publish_host_outing(uuid) to authenticated;

-- Adding a returned column changes the function signature, so recreate the RPC.
drop function if exists public.list_my_organizations();

create function public.list_my_organizations()
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
  is_platform_default boolean,
  event_builder_settings jsonb
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
    o.is_platform_default,
    o.event_builder_settings
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  left join public.profile_workspace_preferences wp on wp.profile_id = m.profile_id
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and o.status = 'active'
  order by is_active desc, o.is_platform_default desc, o.name asc;
$$;

revoke all on function public.list_my_organizations() from public;
grant execute on function public.list_my_organizations() to authenticated;

notify pgrst, 'reload schema';
