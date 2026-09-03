-- Host identity is independent from community membership.
-- Organizations are optional public identities that hosts can represent.
-- Event visibility is separate from registration and community membership.

alter table public.adventures
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','unlisted','private','community')),
  add column if not exists organization_id uuid,
  add column if not exists presented_by_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.host_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  public_title text,
  bio text,
  business_name text,
  website_url text,
  cover_image_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.host_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  city text,
  state text,
  logo_url text,
  cover_image_url text,
  website_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.adventures
  drop constraint if exists adventures_organization_id_fkey;
alter table public.adventures
  add constraint adventures_organization_id_fkey
  foreign key (organization_id) references public.host_organizations(id) on delete set null;

create table if not exists public.host_organization_members (
  organization_id uuid not null references public.host_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'host' check (role in ('owner','admin','host','team')),
  public_label text,
  joined_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table if not exists public.host_follows (
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  host_profile_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.host_organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((host_profile_id is not null)::int + (organization_id is not null)::int = 1),
  unique (follower_profile_id, host_profile_id),
  unique (follower_profile_id, organization_id)
);

create table if not exists public.host_media (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.host_organizations(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.adventure_community_access (
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  group_id uuid not null references public.community_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (adventure_id, group_id)
);

create index if not exists host_org_members_profile_idx on public.host_organization_members(profile_id);
create index if not exists host_follows_host_idx on public.host_follows(host_profile_id);
create index if not exists host_follows_org_idx on public.host_follows(organization_id);
create index if not exists host_media_owner_idx on public.host_media(owner_profile_id, created_at desc);
create index if not exists host_media_adventure_idx on public.host_media(adventure_id, created_at desc);
create index if not exists adventure_visibility_idx on public.adventures(visibility, starts_at);

create trigger host_profiles_set_updated_at
before update on public.host_profiles
for each row execute function public.set_updated_at();

create trigger host_organizations_set_updated_at
before update on public.host_organizations
for each row execute function public.set_updated_at();

alter table public.host_profiles enable row level security;
alter table public.host_organizations enable row level security;
alter table public.host_organization_members enable row level security;
alter table public.host_follows enable row level security;
alter table public.host_media enable row level security;
alter table public.adventure_community_access enable row level security;

create policy "Public host profiles are readable"
on public.host_profiles for select
using (is_public or profile_id = auth.uid());

create policy "Hosts manage their profile"
on public.host_profiles for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Public host organizations are readable"
on public.host_organizations for select
using (is_public or created_by = auth.uid());

create policy "Organization creators manage organizations"
on public.host_organizations for all
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "Organization membership is readable"
on public.host_organization_members for select
using (true);

create policy "Organization creators manage membership"
on public.host_organization_members for all
using (exists (select 1 from public.host_organizations o where o.id = organization_id and o.created_by = auth.uid()))
with check (exists (select 1 from public.host_organizations o where o.id = organization_id and o.created_by = auth.uid()));

create policy "Follows are readable"
on public.host_follows for select
using (true);

create policy "Members manage their follows"
on public.host_follows for all
using (follower_profile_id = auth.uid())
with check (follower_profile_id = auth.uid());

create policy "Public host media is readable"
on public.host_media for select
using (
  owner_profile_id = auth.uid()
  or exists (select 1 from public.host_profiles hp where hp.profile_id = owner_profile_id and hp.is_public)
  or exists (select 1 from public.host_organizations o where o.id = organization_id and o.is_public)
);

create policy "Hosts manage their media"
on public.host_media for all
using (owner_profile_id = auth.uid())
with check (owner_profile_id = auth.uid());

create policy "Community access readable by authenticated members"
on public.adventure_community_access for select
using (auth.uid() is not null);

create policy "Adventure creators manage community access"
on public.adventure_community_access for all
using (exists (select 1 from public.adventures a where a.id = adventure_id and a.created_by = auth.uid()))
with check (exists (select 1 from public.adventures a where a.id = adventure_id and a.created_by = auth.uid()));

grant select, insert, update, delete on public.host_profiles to authenticated;
grant select, insert, update, delete on public.host_organizations to authenticated;
grant select, insert, update, delete on public.host_organization_members to authenticated;
grant select, insert, delete on public.host_follows to authenticated;
grant select, insert, update, delete on public.host_media to authenticated;
grant select, insert, update, delete on public.adventure_community_access to authenticated;
