create table if not exists public.host_social_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.host_organizations(id) on delete cascade,
  kind text not null check (kind in ('facebook_group','facebook_page','instagram','custom')),
  display_name text not null,
  handle text,
  url text not null,
  description text,
  image_url text,
  audience_count bigint,
  audience_label text,
  is_primary boolean not null default false,
  is_public boolean not null default true,
  connection_mode text not null default 'manual' check (connection_mode in ('manual','meta')),
  provider_account_id text,
  imported_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists host_social_profiles_one_primary_per_org
  on public.host_social_profiles (organization_id)
  where is_primary;

create index if not exists host_social_profiles_org_idx
  on public.host_social_profiles (organization_id, created_at);

alter table public.host_social_profiles enable row level security;

drop policy if exists "Public organization social profiles are readable" on public.host_social_profiles;
create policy "Public organization social profiles are readable"
on public.host_social_profiles for select
using (
  is_public
  and exists (
    select 1 from public.host_organizations o
    where o.id = organization_id and o.is_public
  )
);

drop policy if exists "Organization team can read social profiles" on public.host_social_profiles;
create policy "Organization team can read social profiles"
on public.host_social_profiles for select to authenticated
using (
  exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_social_profiles.organization_id
      and m.profile_id = auth.uid()
  )
);

drop policy if exists "Organization owners and admins manage social profiles" on public.host_social_profiles;
create policy "Organization owners and admins manage social profiles"
on public.host_social_profiles for all to authenticated
using (
  exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_social_profiles.organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_social_profiles.organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

create or replace function public.set_host_social_primary(p_social_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  select organization_id into target_org
  from public.host_social_profiles
  where id = p_social_id;

  if target_org is null then
    raise exception 'Social profile not found';
  end if;

  if not exists (
    select 1 from public.host_organization_members m
    where m.organization_id = target_org
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  ) then
    raise exception 'Only organization owners and admins can change the primary social profile';
  end if;

  update public.host_social_profiles
  set is_primary = false, updated_at = now()
  where organization_id = target_org and is_primary;

  update public.host_social_profiles
  set is_primary = true, updated_at = now()
  where id = p_social_id;
end;
$$;

grant execute on function public.set_host_social_primary(uuid) to authenticated;

alter table public.host_organizations
  add column if not exists profile_field_sources jsonb not null default '{}'::jsonb;
