-- Tenant-aware venue discovery and venue provenance for host events.

alter table public.adventures
  add column if not exists venue_place_id text,
  add column if not exists venue_source text;

create index if not exists adventures_platform_org_venue_idx
  on public.adventures(platform_organization_id, venue_name)
  where venue_name is not null;

create table if not exists public.organization_venue_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'google_places',
  provider_place_id text,
  venue_name text not null,
  address text,
  preference text not null check (preference in ('preferred', 'blocked')),
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, provider_place_id),
  unique (organization_id, provider, venue_name)
);

create index if not exists organization_venue_preferences_org_idx
  on public.organization_venue_preferences(organization_id, preference);

create table if not exists public.host_venue_shortlist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_places',
  provider_place_id text,
  venue_name text not null,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  source text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, provider, provider_place_id),
  unique (organization_id, profile_id, provider, venue_name)
);

create index if not exists host_venue_shortlist_profile_idx
  on public.host_venue_shortlist(profile_id, organization_id, updated_at desc);

alter table public.organization_venue_preferences enable row level security;
alter table public.host_venue_shortlist enable row level security;

drop policy if exists "Organization members view venue preferences" on public.organization_venue_preferences;
create policy "Organization members view venue preferences"
on public.organization_venue_preferences for select to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "Event managers manage venue preferences" on public.organization_venue_preferences;
create policy "Event managers manage venue preferences"
on public.organization_venue_preferences for all to authenticated
using (private.has_organization_permission(organization_id, 'events.manage'))
with check (private.has_organization_permission(organization_id, 'events.manage'));

drop policy if exists "Hosts view own venue shortlist" on public.host_venue_shortlist;
create policy "Hosts view own venue shortlist"
on public.host_venue_shortlist for select to authenticated
using (profile_id = auth.uid() and private.is_organization_member(organization_id));

drop policy if exists "Hosts manage own venue shortlist" on public.host_venue_shortlist;
create policy "Hosts manage own venue shortlist"
on public.host_venue_shortlist for all to authenticated
using (profile_id = auth.uid() and private.has_organization_permission(organization_id, 'events.manage'))
with check (profile_id = auth.uid() and private.has_organization_permission(organization_id, 'events.manage'));

grant select, insert, update, delete on public.organization_venue_preferences to authenticated;
grant select, insert, update, delete on public.host_venue_shortlist to authenticated;
