alter table public.host_organizations
  add column if not exists tagline text,
  add column if not exists public_email text,
  add column if not exists phone text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists specialties text[] not null default '{}',
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists policies jsonb not null default '[]'::jsonb;

create or replace function public.get_host_organization_team(p_organization_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  role text,
  public_label text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, m.role, m.public_label
  from public.host_organization_members m
  join public.profiles p on p.id = m.profile_id
  join public.host_organizations o on o.id = m.organization_id
  where m.organization_id = p_organization_id
    and (
      o.is_public
      or o.created_by = auth.uid()
      or exists (
        select 1 from public.host_organization_members mine
        where mine.organization_id = p_organization_id and mine.profile_id = auth.uid()
      )
    )
  order by case m.role when 'owner' then 1 when 'admin' then 2 when 'host' then 3 else 4 end, p.display_name;
$$;

create or replace function public.get_host_organization_followers(p_organization_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  followed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, f.created_at
  from public.host_follows f
  join public.profiles p on p.id = f.follower_profile_id
  join public.host_organizations o on o.id = f.organization_id
  where f.organization_id = p_organization_id
    and (
      o.is_public
      or o.created_by = auth.uid()
      or exists (
        select 1 from public.host_organization_members mine
        where mine.organization_id = p_organization_id and mine.profile_id = auth.uid()
      )
    )
  order by f.created_at desc;
$$;

create or replace function public.add_host_organization_member(
  p_organization_id uuid,
  p_username text,
  p_role text default 'host'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
begin
  if p_role not in ('admin','host','team') then
    raise exception 'Invalid organization role';
  end if;

  if not exists (
    select 1 from public.host_organizations o
    where o.id = p_organization_id and o.created_by = auth.uid()
  ) then
    raise exception 'Only the organization owner can add team members';
  end if;

  select p.id into target_profile_id
  from public.profiles p
  where lower(trim(coalesce(p.username, ''))) = lower(trim(p_username))
  limit 1;

  if target_profile_id is null then
    raise exception 'No member found with that username';
  end if;

  insert into public.host_organization_members (organization_id, profile_id, role)
  values (p_organization_id, target_profile_id, p_role)
  on conflict (organization_id, profile_id)
  do update set role = excluded.role;

  return target_profile_id;
end;
$$;

create or replace function public.remove_host_organization_member(
  p_organization_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.host_organizations o
    where o.id = p_organization_id and o.created_by = auth.uid()
  ) then
    raise exception 'Only the organization owner can remove team members';
  end if;

  if exists (
    select 1 from public.host_organizations o
    where o.id = p_organization_id and o.created_by = p_profile_id
  ) then
    raise exception 'The organization owner cannot be removed';
  end if;

  delete from public.host_organization_members
  where organization_id = p_organization_id and profile_id = p_profile_id;
end;
$$;

grant execute on function public.get_host_organization_team(uuid) to authenticated;
grant execute on function public.get_host_organization_followers(uuid) to authenticated;
grant execute on function public.add_host_organization_member(uuid,text,text) to authenticated;
grant execute on function public.remove_host_organization_member(uuid,uuid) to authenticated;
