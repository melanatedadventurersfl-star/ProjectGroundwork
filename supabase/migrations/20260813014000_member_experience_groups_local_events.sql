-- Member experience expansion: groups, local events, saved-adventure hardening,
-- passport memory photos, and automatic post-purchase group membership.

alter table public.profiles
  add column if not exists event_host_level text not null default 'member'
  check (event_host_level in ('member', 'trusted_host', 'community_lead', 'staff'));

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind text not null check (kind in ('adventure', 'interest', 'local')),
  adventure_id uuid unique references public.adventures(id) on delete cascade,
  city text,
  state text,
  image_url text,
  visibility text not null default 'public' check (visibility in ('public', 'members')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_group_members (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'host', 'moderator')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

alter table public.community_posts
  add column if not exists group_id uuid references public.community_groups(id) on delete cascade;

create index if not exists community_posts_group_created_idx
  on public.community_posts (group_id, created_at desc);
create index if not exists community_group_members_profile_idx
  on public.community_group_members (profile_id, joined_at desc);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_group_members gm
    where gm.group_id = target_group_id
      and gm.profile_id = auth.uid()
  );
$$;

create or replace function public.can_create_local_event()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.event_host_level in ('trusted_host', 'community_lead', 'staff')
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.can_create_local_event() to authenticated;

create table if not exists public.local_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text not null,
  category text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  city text not null,
  state text not null,
  venue_name text,
  meeting_details text,
  image_url text,
  capacity integer check (capacity is null or capacity > 0),
  is_free boolean not null default true,
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled', 'completed')),
  group_id uuid references public.community_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_events_valid_schedule check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.local_event_rsvps (
  local_event_id uuid not null references public.local_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'interested', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (local_event_id, profile_id)
);

create index if not exists local_events_discovery_idx on public.local_events (status, starts_at);
create index if not exists local_events_location_idx on public.local_events (state, city);

create table if not exists public.adventure_memory_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  image_url text not null,
  caption text,
  visibility text not null default 'private' check (visibility in ('private', 'group')),
  created_at timestamptz not null default now()
);

create index if not exists adventure_memory_photos_owner_idx
  on public.adventure_memory_photos (profile_id, adventure_id, created_at desc);

alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.local_events enable row level security;
alter table public.local_event_rsvps enable row level security;
alter table public.adventure_memory_photos enable row level security;

create policy "Members can discover public groups"
on public.community_groups for select
using (visibility = 'public' or public.is_group_member(id));

create policy "Members read their group memberships"
on public.community_group_members for select
using (profile_id = auth.uid() or public.is_group_member(group_id));

create policy "Members join public groups"
on public.community_group_members for insert
with check (
  profile_id = auth.uid()
  and exists (select 1 from public.community_groups g where g.id = group_id and g.visibility = 'public')
);

create policy "Members leave their groups"
on public.community_group_members for delete
using (profile_id = auth.uid());

create policy "Published local events are readable"
on public.local_events for select
using (status in ('published', 'completed'));

create policy "Eligible hosts create local events"
on public.local_events for insert
with check (host_id = auth.uid() and public.can_create_local_event());

create policy "Hosts update their local events"
on public.local_events for update
using (host_id = auth.uid() and public.can_create_local_event())
with check (host_id = auth.uid() and public.can_create_local_event());

create policy "Members read local event RSVPs"
on public.local_event_rsvps for select
using (true);

create policy "Members manage their local event RSVP"
on public.local_event_rsvps for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Members read their memory photos"
on public.adventure_memory_photos for select
using (profile_id = auth.uid() or visibility = 'group');

create policy "Members add their memory photos"
on public.adventure_memory_photos for insert
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.orders o
    where o.purchaser_id = auth.uid()
      and o.adventure_id = adventure_id
      and o.status = 'paid'
  )
);

create policy "Members remove their memory photos"
on public.adventure_memory_photos for delete
using (profile_id = auth.uid());

-- Saving uses an upsert in the mobile app. Give the owner an update policy so
-- a repeated save cannot fail on the conflict/update path.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_adventures'
      and policyname = 'Members update their saved adventures'
  ) then
    create policy "Members update their saved adventures"
    on public.saved_adventures for update
    using (profile_id = auth.uid())
    with check (profile_id = auth.uid());
  end if;
end $$;

grant select, insert, update, delete on public.saved_adventures to authenticated;
grant select on public.community_groups, public.community_group_members, public.local_events, public.local_event_rsvps, public.adventure_memory_photos to authenticated;
grant insert, delete on public.community_group_members, public.local_event_rsvps, public.adventure_memory_photos to authenticated;
grant insert, update on public.local_events to authenticated;

-- Existing community posts become group-aware. Global legacy posts stay readable,
-- while group posts honor group visibility/membership.
drop policy if exists "Members read published community posts" on public.community_posts;
create policy "Members read visible community posts"
on public.community_posts for select
using (
  status = 'published'
  and (
    group_id is null
    or exists (
      select 1 from public.community_groups g
      where g.id = group_id
        and (g.visibility = 'public' or public.is_group_member(g.id))
    )
  )
);

drop policy if exists "Members create their own posts" on public.community_posts;
create policy "Members create posts in available groups"
on public.community_posts for insert
with check (
  auth.uid() = author_id
  and (
    group_id is null
    or exists (
      select 1 from public.community_groups g
      where g.id = group_id
        and (g.visibility = 'public' or public.is_group_member(g.id))
    )
  )
);

create or replace function public.ensure_adventure_group(p_adventure_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result uuid;
  a public.adventures;
begin
  select * into a from public.adventures where id = p_adventure_id;
  if a.id is null then return null; end if;

  insert into public.community_groups (
    name, description, kind, adventure_id, city, state, image_url, visibility, created_by
  ) values (
    a.title,
    'Your private group for trip updates, questions, coordination, and shared memories.',
    'adventure',
    a.id,
    a.city,
    a.state,
    a.hero_image_url,
    'members',
    a.created_by
  )
  on conflict (adventure_id) do update set
    name = excluded.name,
    city = excluded.city,
    state = excluded.state,
    image_url = excluded.image_url,
    updated_at = now()
  returning id into result;

  return result;
end;
$$;

create or replace function public.sync_paid_order_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    target_group_id := public.ensure_adventure_group(new.adventure_id);

    insert into public.community_group_members (group_id, profile_id, role)
    values (target_group_id, new.purchaser_id, 'member')
    on conflict (group_id, profile_id) do nothing;

    insert into public.community_group_members (group_id, profile_id, role)
    select target_group_id, oa.profile_id, 'member'
    from public.order_attendees oa
    where oa.order_id = new.id and oa.profile_id is not null
    on conflict (group_id, profile_id) do nothing;

    perform public.issue_order_credentials(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_paid_experience on public.orders;
create trigger orders_sync_paid_experience
after update of status on public.orders
for each row execute function public.sync_paid_order_experience();

-- Seed adventure groups for existing official experiences.
select public.ensure_adventure_group(id)
from public.adventures
where status in ('published', 'sold_out', 'completed');

-- Backfill memberships for any orders that were already paid before this migration.
insert into public.community_group_members (group_id, profile_id, role)
select g.id, o.purchaser_id, 'member'
from public.orders o
join public.community_groups g on g.adventure_id = o.adventure_id
where o.status = 'paid'
on conflict (group_id, profile_id) do nothing;

insert into public.community_group_members (group_id, profile_id, role)
select g.id, oa.profile_id, 'member'
from public.orders o
join public.order_attendees oa on oa.order_id = o.id and oa.profile_id is not null
join public.community_groups g on g.adventure_id = o.adventure_id
where o.status = 'paid'
on conflict (group_id, profile_id) do nothing;
