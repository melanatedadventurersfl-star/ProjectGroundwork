create table if not exists public.community_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  address text,
  city text not null,
  state text not null,
  website_url text,
  latitude double precision,
  longitude double precision,
  ownership_tags text[] not null default '{}',
  ownership_verification_status text not null default 'unverified'
    check (ownership_verification_status in ('unverified','submitted','verified','rejected','expired')),
  verification_source_url text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  community_endorsement_count integer not null default 0 check (community_endorsement_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_places_location_idx
  on public.community_places (state, city, is_active);
create index if not exists community_places_verified_idx
  on public.community_places (ownership_verification_status, is_active);
create index if not exists community_places_ownership_tags_gin
  on public.community_places using gin (ownership_tags);

alter table public.community_places enable row level security;

drop policy if exists "Members read active community places" on public.community_places;
create policy "Members read active community places"
on public.community_places for select
to authenticated
using (is_active = true);

drop policy if exists "Admins manage community places" on public.community_places;
create policy "Admins manage community places"
on public.community_places for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select on public.community_places to authenticated;
grant insert, update, delete on public.community_places to authenticated;

comment on table public.community_places is
  'Curated local places for Go Melanated recommendations. Ownership claims are only surfaced when ownership_verification_status=verified.';
comment on column public.community_places.ownership_tags is
  'Explicit ownership labels supplied by verified sources, e.g. black_owned, latino_owned, indigenous_owned, asian_owned, brown_owned. Never inferred by AI.';
