alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists profile_is_private boolean not null default false;
alter table public.profiles add column if not exists city_visible boolean not null default true;
alter table public.profiles add column if not exists badges_visible boolean not null default true;
alter table public.profiles add column if not exists adventures_visible boolean not null default true;
alter table public.profiles add column if not exists interests_visible boolean not null default true;
alter table public.profiles add column if not exists trail_family_visible boolean not null default false;
alter table public.profiles add column if not exists pronouns text;
alter table public.profiles add column if not exists pronouns_visible boolean not null default false;
alter table public.profiles add column if not exists age_range text;
alter table public.profiles add column if not exists age_range_visible boolean not null default false;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists occupation_visible boolean not null default false;
alter table public.profiles add column if not exists platform_role text not null default 'member';

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

alter table public.household_members add column if not exists trail_family_role text;
update public.household_members
set trail_family_role = case role::text when 'owner' then 'organizer' when 'dependent' then 'dependent' else 'adult_member' end
where trail_family_role is null;
alter table public.household_members alter column trail_family_role set default 'adult_member';

create table if not exists public.trail_family_guardians (
  household_id uuid not null references public.households(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  dependent_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, guardian_profile_id, dependent_profile_id),
  check (guardian_profile_id <> dependent_profile_id)
);
alter table public.trail_family_guardians enable row level security;
drop policy if exists "Trail family guardians are readable by family members" on public.trail_family_guardians;
create policy "Trail family guardians are readable by family members" on public.trail_family_guardians
for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "Trail family organizers manage guardians" on public.trail_family_guardians;
create policy "Trail family organizers manage guardians" on public.trail_family_guardians
for all to authenticated using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

create table if not exists public.member_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists member_connections_pair_unique
  on public.member_connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.member_connections enable row level security;
drop policy if exists "Members read their connections" on public.member_connections;
create policy "Members read their connections" on public.member_connections for select to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists "Members request connections" on public.member_connections;
create policy "Members request connections" on public.member_connections for insert to authenticated
with check (auth.uid() = requester_id and status = 'pending');
drop policy if exists "Members respond to connection requests" on public.member_connections;
create policy "Members respond to connection requests" on public.member_connections for update to authenticated
using (auth.uid() = addressee_id or auth.uid() = requester_id)
with check (auth.uid() = addressee_id or auth.uid() = requester_id);
drop policy if exists "Members remove their connections" on public.member_connections;
create policy "Members remove their connections" on public.member_connections for delete to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  icon_name text,
  category text not null default 'milestone',
  created_at timestamptz not null default now()
);
create table if not exists public.member_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  unique (profile_id, badge_id)
);
alter table public.badges enable row level security;
alter table public.member_badges enable row level security;
drop policy if exists "Badges are readable" on public.badges;
create policy "Badges are readable" on public.badges for select to authenticated using (true);
drop policy if exists "Members read own badges" on public.member_badges;
create policy "Members read own badges" on public.member_badges for select to authenticated using (profile_id = auth.uid());

insert into public.badges(code,title,description,icon_name,category) values
('first-adventure','First Adventure','Completed your first official Melanated Adventurers experience.','trail','milestone'),
('three-adventures','Trail Regular','Completed three official adventures.','boots','milestone'),
('five-adventures','Wayfinder Five','Completed five official adventures.','map','milestone'),
('ten-adventures','Summit Ten','Completed ten official adventures.','summit','milestone'),
('twenty-adventures','Legacy Twenty','Completed twenty official adventures.','pine','milestone')
on conflict (code) do update set title=excluded.title, description=excluded.description, icon_name=excluded.icon_name, category=excluded.category;

create or replace function public.refresh_adventure_milestone_badges(target_profile uuid)
returns void language plpgsql security definer set search_path=public as $$
declare completed_count integer;
begin
  select count(distinct adventure_id) into completed_count
  from public.member_passport_stamps
  where profile_id=target_profile and adventure_id is not null;

  insert into public.member_badges(profile_id,badge_id,evidence)
  select target_profile,b.id,jsonb_build_object('completed_adventures',completed_count)
  from public.badges b
  where (b.code='first-adventure' and completed_count>=1)
     or (b.code='three-adventures' and completed_count>=3)
     or (b.code='five-adventures' and completed_count>=5)
     or (b.code='ten-adventures' and completed_count>=10)
     or (b.code='twenty-adventures' and completed_count>=20)
  on conflict (profile_id,badge_id) do nothing;
end; $$;

create or replace function public.on_member_event_stamp_badges()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_adventure_milestone_badges(new.profile_id);
  return new;
end; $$;
drop trigger if exists member_event_stamp_badges on public.member_passport_stamps;
create trigger member_event_stamp_badges after insert on public.member_passport_stamps
for each row execute function public.on_member_event_stamp_badges();

create or replace function public.award_official_event_stamp(target_adventure uuid)
returns void language plpgsql security definer set search_path=public as $$
declare event_row public.adventures%rowtype; event_stamp uuid;
begin
  select * into event_row from public.adventures where id=target_adventure;
  if event_row.id is null or event_row.status <> 'completed'::public.adventure_status then return; end if;

  insert into public.passport_stamps(code,title,description,icon_name,category)
  values ('official-event-'||event_row.id::text,event_row.title,
          'Official event stamp · '||event_row.city||', '||event_row.state,
          'official-event','official_event')
  on conflict (code) do update set title=excluded.title, description=excluded.description
  returning id into event_stamp;

  insert into public.member_passport_stamps(profile_id,stamp_id,adventure_id,earned_at,evidence)
  select distinct participant.profile_id,event_stamp,event_row.id,coalesce(event_row.ends_at,now()),
         jsonb_build_object('source','official_event_completion')
  from (
    select o.purchaser_id as profile_id from public.orders o
      where o.adventure_id=event_row.id and o.status='paid'::public.order_status
    union
    select oa.profile_id from public.orders o join public.order_attendees oa on oa.order_id=o.id
      where o.adventure_id=event_row.id and o.status='paid'::public.order_status and oa.profile_id is not null
  ) participant
  on conflict (profile_id,stamp_id,adventure_id) do nothing;
end; $$;

create or replace function public.on_adventure_completed_stamp()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed'::public.adventure_status and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform public.award_official_event_stamp(new.id);
  end if;
  return new;
end; $$;
drop trigger if exists adventure_completed_stamp on public.adventures;
create trigger adventure_completed_stamp after insert or update of status on public.adventures
for each row execute function public.on_adventure_completed_stamp();

do $$ declare row_id uuid; begin
  for row_id in select id from public.adventures where status='completed'::public.adventure_status loop
    perform public.award_official_event_stamp(row_id);
  end loop;
end $$;

create or replace function public.is_paid_adventure_attendee(target_adventure uuid, target_profile uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.orders o
    where o.adventure_id=target_adventure and o.status='paid'::public.order_status
      and (o.purchaser_id=target_profile or exists (
        select 1 from public.order_attendees oa where oa.order_id=o.id and oa.profile_id=target_profile
      ))
  );
$$;

drop policy if exists "Members add their memory photos" on public.adventure_memory_photos;
create policy "Members add their memory photos" on public.adventure_memory_photos
for insert to authenticated with check (
  profile_id=auth.uid() and public.is_paid_adventure_attendee(adventure_id,auth.uid())
);

create or replace view public.adventure_discovery as
select id,slug,title,summary,category,difficulty,status,starts_at,ends_at,city,state,venue_name,hero_image_url,
       capacity,spots_remaining,starting_price_cents,is_featured
from public.adventures
where status in ('published'::public.adventure_status,'sold_out'::public.adventure_status,'cancelled'::public.adventure_status)
  and ends_at >= now();
grant select on public.adventure_discovery to authenticated;

create or replace view public.trail_family_member_directory as
select hm.household_id,h.name as household_name,h.invite_code,hm.profile_id,p.display_name,p.avatar_url,
       hm.trail_family_role,hm.can_manage_bookings,hm.can_manage_readiness,hm.joined_at
from public.household_members hm
join public.households h on h.id=hm.household_id
join public.profiles p on p.id=hm.profile_id
where exists (
  select 1 from public.household_members me where me.household_id=hm.household_id and me.profile_id=auth.uid()
);
grant select on public.trail_family_member_directory to authenticated;

create or replace view public.community_profile_directory as
select p.id,p.display_name,p.username,p.avatar_url,
       case when p.city_visible then p.home_city else null end as home_city,
       case when p.city_visible then p.home_state else null end as home_state,
       p.profile_is_private,p.platform_role,p.event_host_level,
       case when p.interests_visible then p.interests else null end as interests,
       case when p.pronouns_visible then p.pronouns else null end as pronouns,
       p.created_at
from public.profiles p;
grant select on public.community_profile_directory to authenticated;

create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare kind_value public.notification_kind; notification_title text; notification_body text;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  if new.status='held'::public.order_status then kind_value='registration'; notification_title='Reservation held'; notification_body='Your adventure reservation is being held while payment is pending.';
  elsif new.status='payment_pending'::public.order_status then kind_value='payment'; notification_title='Payment pending'; notification_body='Your reservation is waiting for payment confirmation.';
  elsif new.status='paid'::public.order_status then kind_value='payment'; notification_title='Payment confirmed'; notification_body='Your adventure is confirmed. Readiness and your adventure group are now available.';
  elsif new.status='refunded'::public.order_status then kind_value='payment'; notification_title='Refund updated'; notification_body='Your reservation has been marked refunded.';
  elsif new.status='cancelled'::public.order_status then kind_value='registration'; notification_title='Reservation cancelled'; notification_body='Your reservation has been cancelled.';
  else return new; end if;

  insert into public.notifications(recipient_id,adventure_id,kind,priority,title,body,action_url,dedupe_key)
  values(new.purchaser_id,new.adventure_id,kind_value,'normal',notification_title,notification_body,
         '/trips', 'order-'||new.id::text||'-'||new.status::text)
  on conflict (recipient_id,dedupe_key) do nothing;
  return new;
end; $$;
drop trigger if exists order_status_notifications on public.orders;
create trigger order_status_notifications after insert or update of status on public.orders
for each row execute function public.notify_order_status_change();
