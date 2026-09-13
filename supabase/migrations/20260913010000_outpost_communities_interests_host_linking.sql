-- Outpost community model v2
-- Communities represent people and ownership. Activity topics become reusable interests.

alter table public.community_groups
  add column if not exists community_type text not null default 'member_led'
    check (community_type in ('host', 'member_led', 'official', 'private')),
  add column if not exists owner_type text not null default 'member'
    check (owner_type in ('platform', 'host', 'member')),
  add column if not exists host_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists is_topic boolean not null default false;

update public.community_groups
set is_topic = true,
    owner_type = 'platform',
    community_type = 'official'
where kind = 'interest'
  and lower(name) in ('camping', 'hiking', 'water adventures', 'family adventures', 'beginner outdoors');

update public.community_groups g
set owner_type = 'host',
    community_type = 'host',
    host_profile_id = g.created_by
where g.created_by is not null
  and exists (select 1 from public.host_profiles hp where hp.profile_id = g.created_by)
  and not g.is_topic;

update public.community_groups
set owner_type = 'platform',
    community_type = 'official'
where management_type = 'official'
  and not is_topic
  and host_profile_id is null;

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.interests (slug, name)
values
  ('camping', 'Camping'),
  ('hiking', 'Hiking'),
  ('water', 'Water'),
  ('kayaking', 'Kayaking'),
  ('paddleboarding', 'Paddleboarding'),
  ('fishing', 'Fishing'),
  ('family', 'Family'),
  ('travel', 'Travel'),
  ('cycling', 'Cycling'),
  ('rv', 'RV'),
  ('overlanding', 'Overlanding'),
  ('beginner-friendly', 'Beginner Friendly'),
  ('food', 'Food'),
  ('photography', 'Photography'),
  ('beach', 'Beach'),
  ('social', 'Social')
on conflict (slug) do update set name = excluded.name, is_active = true;

create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create table if not exists public.community_interests (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, interest_id)
);

create table if not exists public.community_post_interests (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, interest_id)
);

create table if not exists public.adventure_interests (
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (adventure_id, interest_id)
);

create table if not exists public.host_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

alter table public.host_profiles
  add column if not exists primary_community_id uuid references public.community_groups(id) on delete set null;

-- If an existing host has exactly one community where they already hold the host role,
-- use it as the primary community. Ambiguous hosts are left unchanged for explicit choice.
with candidates as (
  select gm.profile_id, min(gm.group_id) as group_id
  from public.community_group_members gm
  join public.community_groups g on g.id = gm.group_id
  where gm.role = 'host'
    and not coalesce(g.is_topic, false)
  group by gm.profile_id
  having count(*) = 1
)
update public.host_profiles hp
set primary_community_id = c.group_id
from candidates c
where hp.profile_id = c.profile_id
  and hp.primary_community_id is null;

create table if not exists public.community_outings (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  shared_by uuid references public.profiles(id) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, adventure_id)
);

create index if not exists community_outings_adventure_idx on public.community_outings(adventure_id);
create index if not exists community_outings_group_created_idx on public.community_outings(group_id, created_at desc);
create index if not exists adventure_interests_interest_idx on public.adventure_interests(interest_id, adventure_id);
create index if not exists community_interests_interest_idx on public.community_interests(interest_id, group_id);

create or replace function public.set_adventure_interests(p_adventure_id uuid, p_interest_slugs text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.adventures a
    where a.id = p_adventure_id and a.created_by = auth.uid()
  ) then
    raise exception 'Outing not found or not owned by current host';
  end if;

  delete from public.adventure_interests where adventure_id = p_adventure_id;

  insert into public.adventure_interests (adventure_id, interest_id)
  select p_adventure_id, i.id
  from public.interests i
  where i.is_active
    and i.slug = any(coalesce(p_interest_slugs, array[]::text[]))
  on conflict do nothing;
end;
$$;

create or replace function public.set_primary_host_community(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.community_group_members gm
    where gm.group_id = p_group_id
      and gm.profile_id = auth.uid()
      and gm.role in ('host', 'moderator')
  ) and not exists (
    select 1 from public.community_groups g
    where g.id = p_group_id and g.created_by = auth.uid()
  ) then
    raise exception 'You do not manage this community';
  end if;

  update public.community_groups
  set owner_type = 'host', community_type = 'host', host_profile_id = auth.uid()
  where id = p_group_id;

  insert into public.host_profiles (profile_id, primary_community_id)
  values (auth.uid(), p_group_id)
  on conflict (profile_id) do update set primary_community_id = excluded.primary_community_id;
end;
$$;

create or replace function public.sync_host_outing_to_primary_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select hp.primary_community_id into target_group
  from public.host_profiles hp
  where hp.profile_id = new.created_by;

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
after insert or update of status on public.adventures
for each row execute function public.sync_host_outing_to_primary_community();

-- Backfill already-published host outings where the host has explicitly resolved a primary community.
insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
select hp.primary_community_id, a.id, a.created_by, true
from public.adventures a
join public.host_profiles hp on hp.profile_id = a.created_by
where a.status = 'published'
  and hp.primary_community_id is not null
on conflict (group_id, adventure_id) do nothing;

-- Preserve legacy topic content by translating the old starter rooms into interest tags.
insert into public.community_post_interests (post_id, interest_id)
select p.id, i.id
from public.community_posts p
join public.community_groups g on g.id = p.group_id
join public.interests i on i.slug = case lower(g.name)
  when 'camping' then 'camping'
  when 'hiking' then 'hiking'
  when 'water adventures' then 'water'
  when 'family adventures' then 'family'
  when 'beginner outdoors' then 'beginner-friendly'
  else null
end
where g.is_topic
on conflict do nothing;

alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;
alter table public.community_interests enable row level security;
alter table public.community_post_interests enable row level security;
alter table public.adventure_interests enable row level security;
alter table public.host_interests enable row level security;
alter table public.community_outings enable row level security;

create policy "Interests are readable" on public.interests for select using (true);
create policy "Members read profile interests" on public.profile_interests for select using (true);
create policy "Members manage own profile interests" on public.profile_interests for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "Community interests are readable" on public.community_interests for select using (true);
create policy "Post interests are readable" on public.community_post_interests for select using (true);
create policy "Adventure interests are readable" on public.adventure_interests for select using (true);
create policy "Host interests are readable" on public.host_interests for select using (true);
create policy "Community outings are readable" on public.community_outings for select using (
  exists (
    select 1 from public.community_groups g
    where g.id = group_id
      and (g.visibility = 'public' or public.is_group_member(g.id))
  )
);

revoke all on function public.set_adventure_interests(uuid, text[]) from public, anon;
revoke all on function public.set_primary_host_community(uuid) from public, anon;
grant execute on function public.set_adventure_interests(uuid, text[]) to authenticated;
grant execute on function public.set_primary_host_community(uuid) to authenticated;

grant select on public.interests, public.community_interests, public.community_post_interests, public.adventure_interests, public.host_interests, public.community_outings to authenticated;
grant select, insert, update, delete on public.profile_interests to authenticated;
