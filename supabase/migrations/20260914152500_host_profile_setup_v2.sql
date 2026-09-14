-- Host Profile Setup V2
-- Expands organization host identities without coupling them to login accounts.
-- Public profile fields stay separate from private organization/account data.

alter table public.host_organizations
  add column if not exists host_type text not null default 'organization'
    check (host_type in ('individual','business','organization','nonprofit','community','venue','creator','other')),
  add column if not exists short_description text,
  add column if not exists service_areas text[] not null default '{}',
  add column if not exists audiences text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists accessibility text,
  add column if not exists founded_year integer check (founded_year is null or founded_year between 1800 and 2200),
  add column if not exists setup_stage text not null default 'profile'
    check (setup_stage in ('profile','about','media','brand','features','preview','complete')),
  add column if not exists setup_completed_at timestamptz,
  add column if not exists profile_section_order text[] not null default array['about','events','photos','history','team','faq','policies','contact']::text[],
  add column if not exists contact_visibility jsonb not null default '{"email":true,"phone":false,"website":true,"socials":true}'::jsonb;

alter table public.host_media
  add column if not exists kind text not null default 'event'
    check (kind in ('event','gallery')),
  add column if not exists alt_text text,
  add column if not exists is_featured boolean not null default false;

update public.host_media
set kind = case when adventure_id is null then 'gallery' else 'event' end
where kind = 'event';

create index if not exists host_media_org_gallery_idx
  on public.host_media(organization_id, sort_order, created_at)
  where adventure_id is null;

create table if not exists public.host_profile_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.host_organizations(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('files','website','pasted_text')),
  source_label text not null default '',
  source_url text,
  extracted_payload jsonb not null default '{}'::jsonb,
  approved_payload jsonb not null default '{}'::jsonb,
  status text not null default 'preview' check (status in ('preview','applied','discarded')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists host_profile_imports_org_idx
  on public.host_profile_imports(organization_id, created_at desc);

alter table public.host_profile_imports enable row level security;

create policy "Organization teams read profile imports"
on public.host_profile_imports for select
using (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_profile_imports.organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin','host')
  )
);

create policy "Organization owners and admins manage profile imports"
on public.host_profile_imports for all
using (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_profile_imports.organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  owner_profile_id = auth.uid()
  or exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_profile_imports.organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

grant select, insert, update, delete on public.host_profile_imports to authenticated;

-- Existing host organization policies only gave the creator write access. Expand writes
-- to owner/admin team members while preserving the creator path for compatibility.
drop policy if exists "Organization creators manage organizations" on public.host_organizations;
create policy "Organization owners and admins manage organizations"
on public.host_organizations for all
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_organizations.id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.host_organization_members m
    where m.organization_id = host_organizations.id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

-- Gallery media belongs to the organization identity. Owners/admins may manage it.
drop policy if exists "Hosts manage their media" on public.host_media;
create policy "Hosts and organization admins manage media"
on public.host_media for all
using (
  owner_profile_id = auth.uid()
  or (
    organization_id is not null
    and exists (
      select 1 from public.host_organization_members m
      where m.organization_id = host_media.organization_id
        and m.profile_id = auth.uid()
        and m.role in ('owner','admin','host')
    )
  )
)
with check (
  owner_profile_id = auth.uid()
  or (
    organization_id is not null
    and exists (
      select 1 from public.host_organization_members m
      where m.organization_id = host_media.organization_id
        and m.profile_id = auth.uid()
        and m.role in ('owner','admin','host')
    )
  )
);
