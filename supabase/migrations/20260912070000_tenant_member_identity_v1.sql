-- Tenant member identity V1
-- Separates organization app profiles and saved events from Go Melanated member data.

create table if not exists public.organization_member_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  username text,
  avatar_url text,
  cover_url text,
  bio text,
  home_city text,
  home_state text,
  visibility text not null default 'members' check (visibility in ('private', 'members', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index if not exists organization_member_profiles_profile_idx
  on public.organization_member_profiles(profile_id);

create unique index if not exists organization_member_profiles_username_unique_idx
  on public.organization_member_profiles(organization_id, lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.organization_saved_adventures (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id, adventure_id)
);

create index if not exists organization_saved_adventures_profile_idx
  on public.organization_saved_adventures(profile_id, organization_id, created_at desc);

create index if not exists organization_saved_adventures_adventure_idx
  on public.organization_saved_adventures(adventure_id);

drop trigger if exists organization_member_profiles_set_updated_at on public.organization_member_profiles;
create trigger organization_member_profiles_set_updated_at
before update on public.organization_member_profiles
for each row execute function public.set_updated_at();

alter table public.organization_member_profiles enable row level security;
alter table public.organization_saved_adventures enable row level security;

revoke all on public.organization_member_profiles from anon, authenticated;
revoke all on public.organization_saved_adventures from anon, authenticated;

grant select, insert, update on public.organization_member_profiles to authenticated;
grant select, insert, delete on public.organization_saved_adventures to authenticated;

drop policy if exists "Organization members read tenant profiles" on public.organization_member_profiles;
create policy "Organization members read tenant profiles"
on public.organization_member_profiles for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.has_organization_permission(organization_id, 'members.manage'))
  or (
    visibility in ('members', 'public')
    and (select private.is_organization_member(organization_id))
  )
);

drop policy if exists "Members create own tenant profile" on public.organization_member_profiles;
create policy "Members create own tenant profile"
on public.organization_member_profiles for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and (select private.is_organization_member(organization_id))
);

drop policy if exists "Members update own tenant profile" on public.organization_member_profiles;
create policy "Members update own tenant profile"
on public.organization_member_profiles for update
to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.has_organization_permission(organization_id, 'members.manage'))
)
with check (
  profile_id = (select auth.uid())
  or (select private.has_organization_permission(organization_id, 'members.manage'))
);

drop policy if exists "Members read own tenant saved events" on public.organization_saved_adventures;
create policy "Members read own tenant saved events"
on public.organization_saved_adventures for select
to authenticated
using (
  profile_id = (select auth.uid())
  and (select private.is_organization_member(organization_id))
);

drop policy if exists "Members save tenant events" on public.organization_saved_adventures;
create policy "Members save tenant events"
on public.organization_saved_adventures for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and (select private.is_organization_member(organization_id))
  and exists (
    select 1
    from public.adventures a
    where a.id = organization_saved_adventures.adventure_id
      and a.organization_id = organization_saved_adventures.organization_id
  )
);

drop policy if exists "Members remove tenant saved events" on public.organization_saved_adventures;
create policy "Members remove tenant saved events"
on public.organization_saved_adventures for delete
to authenticated
using (
  profile_id = (select auth.uid())
  and (select private.is_organization_member(organization_id))
);

create or replace function private.ensure_organization_member_profile()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if new.status = 'active' then
    insert into public.organization_member_profiles(organization_id, profile_id)
    values (new.organization_id, new.profile_id)
    on conflict (organization_id, profile_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_organization_member_profile() from public, anon, authenticated;

drop trigger if exists organization_memberships_ensure_tenant_profile on public.organization_memberships;
create trigger organization_memberships_ensure_tenant_profile
after insert or update of status on public.organization_memberships
for each row execute function private.ensure_organization_member_profile();

insert into public.organization_member_profiles(organization_id, profile_id)
select organization_id, profile_id
from public.organization_memberships
where status = 'active'
on conflict (organization_id, profile_id) do nothing;
