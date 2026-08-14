create table if not exists public.profile_directory (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  username text,
  avatar_url text,
  home_city text,
  home_state text,
  profile_is_private boolean not null default false,
  platform_role text not null default 'member',
  event_host_level text not null default 'member',
  interests text[],
  pronouns text,
  status public.member_status not null default 'pending',
  created_at timestamptz not null
);

alter table public.profile_directory enable row level security;
revoke all on public.profile_directory from public, anon;
revoke insert, update, delete on public.profile_directory from authenticated;
grant select on public.profile_directory to authenticated, service_role;

drop policy if exists "Authenticated members read safe profile directory" on public.profile_directory;
create policy "Authenticated members read safe profile directory"
on public.profile_directory for select to authenticated
using (status <> 'suspended'::public.member_status or app_private.is_master_account());

drop policy if exists "Master account full access" on public.profile_directory;
create policy "Master account full access"
on public.profile_directory for all to authenticated
using (app_private.is_master_account())
with check (app_private.is_master_account());

create or replace function app_private.sync_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  insert into public.profile_directory (
    id, display_name, username, avatar_url, home_city, home_state,
    profile_is_private, platform_role, event_host_level, interests,
    pronouns, status, created_at
  ) values (
    new.id,
    coalesce(nullif(trim(new.display_name), ''), nullif(trim(concat_ws(' ', new.first_name, new.last_name)), ''), 'Member'),
    new.username,
    new.avatar_url,
    case when new.city_visible then new.home_city else null end,
    case when new.city_visible then new.home_state else null end,
    new.profile_is_private,
    new.platform_role,
    new.event_host_level,
    case when new.interests_visible then new.interests else null end,
    case when new.pronouns_visible then new.pronouns else null end,
    new.status,
    new.created_at
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    home_city = excluded.home_city,
    home_state = excluded.home_state,
    profile_is_private = excluded.profile_is_private,
    platform_role = excluded.platform_role,
    event_host_level = excluded.event_host_level,
    interests = excluded.interests,
    pronouns = excluded.pronouns,
    status = excluded.status,
    created_at = excluded.created_at;
  return new;
end;
$$;
revoke all on function app_private.sync_profile_directory() from public, anon, authenticated;

drop trigger if exists profiles_sync_directory on public.profiles;
create trigger profiles_sync_directory
after insert or update on public.profiles
for each row execute function app_private.sync_profile_directory();

insert into public.profile_directory (
  id, display_name, username, avatar_url, home_city, home_state,
  profile_is_private, platform_role, event_host_level, interests,
  pronouns, status, created_at
)
select
  p.id,
  coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Member'),
  p.username,
  p.avatar_url,
  case when p.city_visible then p.home_city else null end,
  case when p.city_visible then p.home_state else null end,
  p.profile_is_private,
  p.platform_role,
  p.event_host_level,
  case when p.interests_visible then p.interests else null end,
  case when p.pronouns_visible then p.pronouns else null end,
  p.status,
  p.created_at
from public.profiles p
on conflict (id) do update set
  display_name = excluded.display_name,
  username = excluded.username,
  avatar_url = excluded.avatar_url,
  home_city = excluded.home_city,
  home_state = excluded.home_state,
  profile_is_private = excluded.profile_is_private,
  platform_role = excluded.platform_role,
  event_host_level = excluded.event_host_level,
  interests = excluded.interests,
  pronouns = excluded.pronouns,
  status = excluded.status,
  created_at = excluded.created_at;

create or replace view public.community_profile_directory
with (security_invoker = true)
as
select id, display_name, username, avatar_url, home_city, home_state,
       profile_is_private, platform_role, event_host_level, interests, pronouns, created_at
from public.profile_directory;
revoke all on public.community_profile_directory from anon;
grant select on public.community_profile_directory to authenticated, service_role;

create or replace view public.local_event_discovery
with (security_invoker = true)
as
select e.id, e.host_id, coalesce(p.display_name, 'Member host') as host_name,
       e.title, e.description, e.category, e.starts_at, e.ends_at, e.city, e.state,
       e.venue_name, e.meeting_details, e.image_url, e.capacity, e.is_free,
       e.status, e.group_id,
       count(r.profile_id) filter (where r.status <> 'cancelled')::integer as rsvp_count
from public.local_events e
left join public.profile_directory p on p.id = e.host_id
left join public.local_event_rsvps r on r.local_event_id = e.id
group by e.id, p.display_name;
revoke all on public.local_event_discovery from anon;
grant select on public.local_event_discovery to authenticated, service_role;

create or replace view public.trail_family_member_directory
with (security_invoker = true)
as
select hm.household_id, h.name as household_name, h.invite_code, hm.profile_id,
       coalesce(p.display_name, 'Member') as display_name, p.avatar_url,
       hm.trail_family_role, hm.can_manage_bookings, hm.can_manage_readiness, hm.joined_at
from public.household_members hm
join public.households h on h.id = hm.household_id
left join public.profile_directory p on p.id = hm.profile_id
where exists (
  select 1 from public.household_members me
  where me.household_id = hm.household_id and me.profile_id = auth.uid()
);
revoke all on public.trail_family_member_directory from anon;
grant select on public.trail_family_member_directory to authenticated, service_role;

alter view public.adventure_discovery set (security_invoker = true);
alter view public.past_adventure_discovery set (security_invoker = true);
revoke all on public.adventure_discovery from anon;
revoke all on public.past_adventure_discovery from anon;
grant select on public.adventure_discovery, public.past_adventure_discovery to authenticated, service_role;

create or replace function public.community_author_name(target_profile uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(p.display_name, 'Member')
  from public.profile_directory p
  where p.id = target_profile;
$$;
revoke all on function public.community_author_name(uuid) from public, anon;
grant execute on function public.community_author_name(uuid) to authenticated, service_role;

create or replace function public.get_circle_members(target_circle_id uuid)
returns table(profile_id uuid, display_name text, avatar_url text, home_city text, home_state text, added_at timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, cm.added_at
  from public.community_circle_members cm
  join public.community_circles c on c.id = cm.circle_id
  join public.profile_directory p on p.id = cm.profile_id
  where cm.circle_id = target_circle_id and c.owner_id = auth.uid()
  order by cm.added_at;
$$;
revoke all on function public.get_circle_members(uuid) from public, anon;
grant execute on function public.get_circle_members(uuid) to authenticated, service_role;

create or replace function public.get_my_circles()
returns table(id uuid, name text, member_count integer, member_names text[])
language sql stable set search_path = public as $$
  select c.id, c.name, count(cm.profile_id)::int,
    coalesce(array_agg(coalesce(p.display_name, 'Member') order by cm.added_at) filter (where p.id is not null), '{}'::text[])
  from public.community_circles c
  left join public.community_circle_members cm on cm.circle_id = c.id
  left join public.profile_directory p on p.id = cm.profile_id
  where c.owner_id = auth.uid()
  group by c.id, c.name, c.created_at
  order by c.created_at desc;
$$;
revoke all on function public.get_my_circles() from public, anon;
grant execute on function public.get_my_circles() to authenticated, service_role;

create or replace function public.get_my_connections()
returns table(connection_id uuid, profile_id uuid, display_name text, avatar_url text, home_city text, home_state text, status text, direction text, created_at timestamptz)
language sql stable set search_path = public as $$
  select mc.id, p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, mc.status,
    case when mc.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    mc.created_at
  from public.member_connections mc
  join public.profile_directory p on p.id = case when mc.requester_id = auth.uid() then mc.addressee_id else mc.requester_id end
  where auth.uid() is not null and (mc.requester_id = auth.uid() or mc.addressee_id = auth.uid())
  order by mc.created_at desc;
$$;
revoke all on function public.get_my_connections() from public, anon;
grant execute on function public.get_my_connections() to authenticated, service_role;

create or replace function public.search_community_members(search_text text default '')
returns table(id uuid, display_name text, avatar_url text, home_city text, home_state text, connection_id uuid, connection_status text, connection_direction text)
language sql stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, p.home_city, p.home_state, mc.id, mc.status,
    case when mc.requester_id = auth.uid() then 'outgoing'
         when mc.addressee_id = auth.uid() then 'incoming'
         else null end
  from public.profile_directory p
  left join public.member_connections mc
    on (mc.requester_id = auth.uid() and mc.addressee_id = p.id)
    or (mc.addressee_id = auth.uid() and mc.requester_id = p.id)
  where auth.uid() is not null and p.id <> auth.uid()
    and (nullif(trim(search_text), '') is null
      or coalesce(p.display_name,'') ilike '%'||trim(search_text)||'%'
      or coalesce(p.home_city,'') ilike '%'||trim(search_text)||'%')
  order by 2 limit 40;
$$;
revoke all on function public.search_community_members(text) from public, anon;
grant execute on function public.search_community_members(text) to authenticated, service_role;

create or replace function public.get_community_feed(target_adventure_id uuid default null, target_group_id uuid default null)
returns table(id uuid, group_id uuid, circle_id uuid, audience text, post_type text, metadata jsonb, adventure_id uuid, author_id uuid, author_name text, avatar_url text, body text, image_url text, is_pinned boolean, created_at timestamptz, reaction_count integer, comment_count integer)
language sql stable set search_path = public as $$
  select p.id, p.group_id, p.circle_id, p.audience, p.post_type, p.metadata, p.adventure_id, p.author_id,
    coalesce(pr.display_name, 'Member'), pr.avatar_url, p.body, p.image_url, p.is_pinned, p.created_at,
    count(distinct r.profile_id)::int, count(distinct c.id)::int
  from public.community_posts p
  left join public.profile_directory pr on pr.id = p.author_id
  left join public.community_reactions r on r.post_id = p.id
  left join public.community_comments c on c.post_id = p.id and c.status = 'published'
  where auth.uid() is not null and p.status = 'published'
    and (target_adventure_id is null or p.adventure_id = target_adventure_id)
    and (target_group_id is null or p.group_id = target_group_id)
  group by p.id, pr.display_name, pr.avatar_url
  order by p.is_pinned desc, p.created_at desc;
$$;
revoke all on function public.get_community_feed(uuid,uuid) from public, anon;
grant execute on function public.get_community_feed(uuid,uuid) to authenticated, service_role;

create or replace function public.respond_to_connection_request(connection_id uuid, response text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if response not in ('accepted','declined') then raise exception 'Response must be accepted or declined'; end if;
  update public.member_connections
  set status = response
  where id = connection_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Connection request not found'; end if;
end;
$$;
revoke all on function public.respond_to_connection_request(uuid,text) from public, anon;
grant execute on function public.respond_to_connection_request(uuid,text) to authenticated, service_role;
