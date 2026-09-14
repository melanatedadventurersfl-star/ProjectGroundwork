-- Tenant Event Builder Settings V1
-- Keeps event-builder vocabulary and defaults on the platform organization tenant.

alter table public.organizations
  add column if not exists event_builder_settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.event_builder_settings is
  'Tenant-controlled event builder schema: event types, tags, conditional difficulty, labels, visibility and defaults.';

-- Adventure difficulty remains populated for legacy compatibility, but generic events can explicitly hide it.
alter table public.adventures
  add column if not exists difficulty_applicable boolean not null default true;

comment on column public.adventures.difficulty_applicable is
  'Whether adventure difficulty is meaningful and should be shown for this event.';

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
  a.difficulty_applicable
from public.adventures a
where a.status in ('published', 'sold_out')
  and a.ends_at >= now();

alter view public.adventure_discovery set (security_invoker = true);
revoke all on public.adventure_discovery from anon;
grant select on public.adventure_discovery to authenticated;

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
