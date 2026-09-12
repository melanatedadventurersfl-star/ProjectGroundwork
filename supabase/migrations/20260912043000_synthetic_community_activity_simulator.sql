-- Synthetic pilot personas and controlled community activity for QA/pilot environments.
-- Synthetic profiles are explicitly flagged so product analytics can exclude them.
-- The recurring simulator never targets real-member content unless an operator opts in.

create extension if not exists pg_cron;
create schema if not exists private;

alter table public.profiles
  add column if not exists is_synthetic boolean not null default false;

comment on column public.profiles.is_synthetic is
  'True only for fictional pilot/test personas. Exclude these profiles from real-member growth, revenue, conversion, and engagement analytics.';

create index if not exists profiles_is_synthetic_idx
  on public.profiles (is_synthetic)
  where is_synthetic = true;

create table if not exists private.synthetic_personas (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  persona_key text not null unique,
  activity_weight integer not null default 5 check (activity_weight between 1 and 10),
  max_daily_actions integer not null default 3 check (max_daily_actions between 1 and 12),
  voice_note text not null default '',
  post_templates text[] not null default '{}',
  comment_templates text[] not null default '{}',
  photo_paths text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.synthetic_activity_settings (
  settings_key text primary key default 'default' check (settings_key = 'default'),
  enabled boolean not null default true,
  activity_timezone text not null default 'America/New_York',
  min_daily_actions integer not null default 6 check (min_daily_actions between 0 and 50),
  max_daily_actions integer not null default 15 check (max_daily_actions between 1 and 80),
  quiet_start_hour integer not null default 1 check (quiet_start_hour between 0 and 23),
  quiet_end_hour integer not null default 7 check (quiet_end_hour between 0 and 23),
  target_real_member_content boolean not null default false,
  last_tick_at timestamptz,
  updated_at timestamptz not null default now(),
  check (min_daily_actions <= max_daily_actions)
);

create table if not exists private.synthetic_activity_log (
  id bigserial primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('post', 'comment', 'photo_comment', 'reaction', 'seed')),
  target_kind text not null check (target_kind in ('post', 'comment', 'profile', 'group', 'system')),
  target_id uuid,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists synthetic_activity_log_created_at_idx
  on private.synthetic_activity_log (created_at desc);
create index if not exists synthetic_activity_log_actor_created_idx
  on private.synthetic_activity_log (actor_profile_id, created_at desc);

revoke all on table private.synthetic_personas from public, anon, authenticated;
revoke all on table private.synthetic_activity_settings from public, anon, authenticated;
revoke all on table private.synthetic_activity_log from public, anon, authenticated;

insert into private.synthetic_activity_settings (settings_key)
values ('default')
on conflict (settings_key) do nothing;

-- Turn the existing reusable demo/test accounts into believable fictional pilot personas.
-- Their auth identities remain unchanged. Only profile presentation and test metadata change.
with persona_data(email, display_name, username, first_name, last_name, city, state, experience_level, interests, bio, platform_role, host_level, cover_slug) as (
  values
    ('maya.brooks@ma-demo.test', 'Maya Brooks', 'mayatrails', 'Maya', 'Brooks', 'Orlando', 'FL', 'beginner', array['Hiking','Beginner Outdoors','Camping']::text[], 'Newer to camping, happiest on a shaded trail, and always looking for the next beginner-friendly adventure. Fictional pilot profile.', 'member', 'member', 'great-melanated-beach-escape-2026'),
    ('jordan.reed@ma-demo.test', 'Jordan Reed', 'jordanoutside', 'Jordan', 'Reed', 'Tampa', 'FL', 'experienced', array['Camping','Hiking','Cycling']::text[], 'Weekend camper, trail rider, and camp-coffee loyalist. Fictional pilot profile.', 'member', 'member', 'great-melanated-fire-dragon-conquest-2025'),
    ('nia.carter@ma-demo.test', 'Nia Carter', 'niapaddles', 'Nia', 'Carter', 'St. Petersburg', 'FL', 'intermediate', array['Water Adventures','Camping','Community']::text[], 'Paddling, beach mornings, and helping new people feel comfortable outside. Fictional pilot profile.', 'member', 'community_lead', 'great-melanated-float-out-juneteenth-2026'),
    ('marcus.ellis@ma-demo.test', 'Marcus Ellis', 'marcusmoves', 'Marcus', 'Ellis', 'Jacksonville', 'FL', 'experienced', array['Camping','Hiking','Travel']::text[], 'Jacksonville camper who plans around good trails, good food, and an early start. Fictional pilot profile.', 'member', 'trusted_host', 'huguenot-park-camping-trip-2025'),
    ('avery.king@ma-demo.test', 'Avery King', 'averywanders', 'Avery', 'King', 'Miami', 'FL', 'beginner', array['Water Adventures','Cycling','Travel']::text[], 'Learning the outdoors one easy outing at a time, usually with a camera and snacks. Fictional pilot profile.', 'member', 'member', 'splash-after-dark-2026'),
    ('devon.hill@ma-demo.test', 'Devon Hill', 'devonma', 'Devon', 'Hill', 'Orlando', 'FL', 'experienced', array['Camping','Hiking','Community']::text[], 'Experienced camper who likes helping new adventurers get their setup dialed in. Fictional pilot profile.', 'admin', 'staff', 'great-melanated-wet-and-wild-adventure-2025'),
    ('tasha.green@ma-demo.test', 'Tasha Green', 'greenfamilyoutside', 'Tasha', 'Green', 'Lakeland', 'FL', 'intermediate', array['Family Adventures','Camping','Hiking']::text[], 'Family adventures, snacks packed, everybody accounted for. Fictional pilot profile.', 'member', 'member', 'great-melanated-beach-escape-2026'),
    ('eli.green@ma-demo.test', 'Eli Green', 'eligreenoutside', 'Eli', 'Green', 'Lakeland', 'FL', 'beginner', array['Family Adventures','Beginner Outdoors','Water Adventures']::text[], 'Still learning what gear matters and what can stay at home. Fictional pilot profile.', 'member', 'member', 'great-melanated-float-out-2025'),
    ('melanatedadventurersfl+trailtester01@gmail.com', 'Simone Price', 'simoneontrail', 'Simone', 'Price', 'Atlanta', 'GA', 'experienced', array['Hiking','Wellness outdoors','Camping']::text[], 'Long walks, quiet campsites, and getting outside before the group chat gets busy. Fictional pilot profile.', 'admin', 'staff', 'black-and-breezy-summer-cool-down-2025'),
    ('melanatedadventurersfl+trailtester02@gmail.com', 'Andre Walker', 'andreoutside', 'Andre', 'Walker', 'Tallahassee', 'FL', 'intermediate', array['Hiking','Cycling','Camping']::text[], 'Trail miles, bike rides, and learning a better camp setup every trip. Fictional pilot profile.', 'member', 'member', 'great-melanated-fire-dragon-conquest-2025'),
    ('melanatedadventurersfl+hosttester01@gmail.com', 'Rochelle Davis', 'rochellehosts', 'Rochelle', 'Davis', 'Jacksonville', 'FL', 'experienced', array['Camping','Community','Water Adventures']::text[], 'Community host focused on low-pressure outings that make it easy to show up. Fictional pilot profile.', 'host', 'trusted_host', 'great-melanated-float-out-juneteenth-2026')
), updated as (
  update public.profiles p
  set display_name = d.display_name,
      username = d.username,
      first_name = d.first_name,
      last_name = d.last_name,
      home_city = d.city,
      home_state = d.state,
      experience_level = d.experience_level,
      interests = d.interests,
      bio = d.bio,
      platform_role = d.platform_role,
      event_host_level = d.host_level,
      status = 'active'::public.member_status,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      profile_is_private = false,
      city_visible = true,
      badges_visible = true,
      adventures_visible = true,
      interests_visible = true,
      is_searchable = true,
      is_synthetic = true,
      updated_at = now()
  from persona_data d
  where lower(p.email) = lower(d.email)
  returning p.id, p.email
)
update public.profiles p
set cover_url = coalesce(a.hero_image_url, p.cover_url)
from persona_data d
join public.adventures a on a.slug = d.cover_slug
where lower(p.email) = lower(d.email);

-- Clear the old Trail Tester photo before attaching a fictional name to that account.
update public.profiles
set avatar_url = null, updated_at = now()
where lower(email) in (
  'melanatedadventurersfl+trailtester01@gmail.com',
  'melanatedadventurersfl+trailtester02@gmail.com',
  'melanatedadventurersfl+hosttester01@gmail.com'
);

-- Mark any older content from these accounts as synthetic too.
update public.community_posts cp
set metadata = coalesce(cp.metadata, '{}'::jsonb) || jsonb_build_object('synthetic_activity', true, 'synthetic_legacy', true)
where exists (
  select 1 from public.profiles p
  where p.id = cp.author_id and p.is_synthetic = true
);

with persona_config(email, persona_key, weight, max_daily, voice_note, post_templates, comment_templates) as (
  values
    ('maya.brooks@ma-demo.test', 'maya_brooks', 6, 3, 'Warm beginner voice. Curious, specific, and willing to ask basic questions.', array['What is one piece of camping gear you bought too early and one you wish you had bought sooner?','Trying to pick a beginner-friendly trail for this weekend. Shade and a good view are both high on the list.','I finally stopped trying to pack for every possible emergency. My camp setup is getting lighter every trip.']::text[], array['Adding this to my beginner list.','That is the kind of detail I need before I commit to a trail.','I have been wondering the same thing.','This makes it feel a lot less intimidating.']::text[]),
    ('jordan.reed@ma-demo.test', 'jordan_reed', 5, 3, 'Experienced and concise. Talks gear, trails, bikes, and camp routines.', array['Camp coffee tastes better when you had to earn it with a sunrise setup.','What is everybody using for a quick camp breakfast that does not create a sink full of dishes?','A good trail day for me is enough miles to feel it, but not so many that dinner turns into an emergency.']::text[], array['That setup makes sense.','I would add an early start if parking gets tight.','That is a solid weekend plan.','I have had better luck keeping it simple too.']::text[]),
    ('nia.carter@ma-demo.test', 'nia_carter', 7, 4, 'Friendly water-adventure regular. Encouraging without sounding like an instructor.', array['Paddle mornings are becoming my favorite kind of reset. Calm water, no rush, done before the heat gets disrespectful.','For newer paddlers, what helped you feel comfortable your first few times on the water?','I need more outings where the plan is outside first and food immediately after.']::text[], array['This sounds like my kind of morning.','I would be into this if the water stays calm.','That is a good tip for somebody still getting comfortable.','Saving this one for the next paddle day.']::text[]),
    ('marcus.ellis@ma-demo.test', 'marcus_ellis', 7, 4, 'Jacksonville outdoor regular. Practical, local, and lightly humorous.', array['Jacksonville has enough different outdoor spots that I keep finding places I should have visited years ago.','My camping rule now is simple: if setup takes longer than dinner, I packed too much.','Anybody else keep a permanent camp bin packed so leaving on Friday does not become a full household project?']::text[], array['Jacksonville showing out again.','I would definitely keep this one on the list.','That is exactly why I keep a camp bin ready.','Good call. The parking detail matters more than people think.']::text[]),
    ('avery.king@ma-demo.test', 'avery_king', 4, 2, 'Beginner traveler. Short, visual, curious comments.', array['I am learning that an easy outing can still be the best part of the weekend.','Beach morning plus a bike ride might be my ideal low-effort outdoor day.','What is everybody taking photos with outside, phone only or are you carrying a real camera?']::text[], array['This view is worth the trip.','Okay, this one got saved.','That looks beginner-friendly enough for me.','I need this kind of easy plan.']::text[]),
    ('devon.hill@ma-demo.test', 'devon_hill', 3, 2, 'Experienced community helper. Gives short practical advice.', array['One thing that makes group camping easier: decide where shared gear lives before everybody starts unpacking.','The best beginner gear advice is still to borrow before buying whenever you can.','A clear meeting point fixes half the problems before an outing starts.']::text[], array['That is a useful detail to call out.','I would check conditions the morning of too.','Borrowing first saves a lot of money here.','That is the kind of planning that keeps the day moving.']::text[]),
    ('tasha.green@ma-demo.test', 'tasha_green', 6, 3, 'Family-focused, organized, warm. Mentions snacks and kid logistics naturally.', array['Family outing success starts with snacks before anybody admits they are hungry.','I keep learning that kids need less planned activity outside than adults think they do.','What is your one family-camping item that earns its space every single trip?']::text[], array['This would work well for a family day.','The snack plan is part of the itinerary at my house.','I like that there is room to keep the day flexible.','That is a good one for families who are still figuring out camping.']::text[]),
    ('eli.green@ma-demo.test', 'eli_green', 5, 3, 'Beginner, straightforward, sometimes asks follow-up questions.', array['Every camping trip teaches me one thing I packed for no reason.','Still figuring out the difference between gear I need and gear the internet convinced me I need.','What is a good first water outing for somebody who does not want the first trip to feel like a survival test?']::text[], array['I was about to ask the same thing.','That explanation helps.','This feels doable for a first try.','I am putting this on my beginner list.']::text[]),
    ('melanatedadventurersfl+trailtester01@gmail.com', 'simone_price', 4, 2, 'Wellness-oriented experienced hiker. Calm, brief, reflective.', array['A quiet trail before breakfast does more for me than another hour of sleep sometimes.','I am trying to build more outdoor time into normal weeks instead of waiting for a full trip.','Best part of an early hike is getting back while the rest of the day is still available.']::text[], array['This is exactly the pace I like.','Early is the move for this one.','Adding this to my reset-day list.','I like an outing that leaves some day left afterward.']::text[]),
    ('melanatedadventurersfl+trailtester02@gmail.com', 'andre_walker', 5, 3, 'Intermediate hiker and cyclist. Casual and practical.', array['I finally got my bike setup comfortable enough that longer rides sound fun instead of suspicious.','Trying to do more local trail days before planning another big trip.','My current goal is a camp setup that fits in the car without playing luggage Tetris.']::text[], array['That route sounds solid.','I would ride this one.','Local days are underrated.','The simpler setup wins every time.']::text[]),
    ('melanatedadventurersfl+hosttester01@gmail.com', 'rochelle_davis', 5, 3, 'Community host voice. Welcoming, specific, logistics-aware.', array['My favorite outings are the ones where a new person can understand the whole plan in thirty seconds.','A clear arrival window is one of the easiest ways to make a group outing feel less stressful.','Hosts: what is one detail you now include every time because you learned the hard way?']::text[], array['That is exactly the kind of detail I would put in the event notes.','Clear directions make such a difference for first-timers.','This would make a good low-pressure group outing.','I like that the plan is easy to understand.']::text[])
)
insert into private.synthetic_personas (
  profile_id, persona_key, activity_weight, max_daily_actions, voice_note, post_templates, comment_templates
)
select p.id, c.persona_key, c.weight, c.max_daily, c.voice_note, c.post_templates, c.comment_templates
from persona_config c
join public.profiles p on lower(p.email) = lower(c.email)
on conflict (profile_id) do update set
  persona_key = excluded.persona_key,
  activity_weight = excluded.activity_weight,
  max_daily_actions = excluded.max_daily_actions,
  voice_note = excluded.voice_note,
  post_templates = excluded.post_templates,
  comment_templates = excluded.comment_templates,
  enabled = true,
  updated_at = now();

-- Give each persona communities that fit the profile rather than joining everybody to everything.
with memberships(email, group_name, role) as (
  values
    ('maya.brooks@ma-demo.test','Beginner Outdoors','member'),
    ('maya.brooks@ma-demo.test','Hiking','member'),
    ('maya.brooks@ma-demo.test','Orlando Beginner Trail Crew','member'),
    ('jordan.reed@ma-demo.test','Camping','member'),
    ('jordan.reed@ma-demo.test','Hiking','member'),
    ('jordan.reed@ma-demo.test','Tampa Bay Paddle Circle','member'),
    ('nia.carter@ma-demo.test','Water Adventures','member'),
    ('nia.carter@ma-demo.test','Camping','member'),
    ('nia.carter@ma-demo.test','St. Pete Pier Walk & Social','host'),
    ('marcus.ellis@ma-demo.test','Camping','member'),
    ('marcus.ellis@ma-demo.test','Hiking','member'),
    ('marcus.ellis@ma-demo.test','Jacksonville Outside Social','host'),
    ('avery.king@ma-demo.test','Water Adventures','member'),
    ('avery.king@ma-demo.test','Miami Bayfront Ride','member'),
    ('devon.hill@ma-demo.test','Camping','moderator'),
    ('devon.hill@ma-demo.test','Hiking','moderator'),
    ('devon.hill@ma-demo.test','Orlando Lake Loop Walk','member'),
    ('tasha.green@ma-demo.test','Family Adventures','member'),
    ('tasha.green@ma-demo.test','Camping','member'),
    ('eli.green@ma-demo.test','Family Adventures','member'),
    ('eli.green@ma-demo.test','Beginner Outdoors','member'),
    ('melanatedadventurersfl+trailtester01@gmail.com','Hiking','member'),
    ('melanatedadventurersfl+trailtester01@gmail.com','Camping','member'),
    ('melanatedadventurersfl+trailtester02@gmail.com','Hiking','member'),
    ('melanatedadventurersfl+trailtester02@gmail.com','Tallahassee Trail Social','member'),
    ('melanatedadventurersfl+hosttester01@gmail.com','Camping','host'),
    ('melanatedadventurersfl+hosttester01@gmail.com','Water Adventures','host'),
    ('melanatedadventurersfl+hosttester01@gmail.com','Jacksonville Outside Social','host')
)
insert into public.community_group_members (group_id, profile_id, role)
select g.id, p.id, m.role
from memberships m
join public.profiles p on lower(p.email) = lower(m.email)
join public.community_groups g on g.name = m.group_name
on conflict (group_id, profile_id) do update set role = excluded.role;

-- Connect every synthetic persona to the founder account so Trail Crew and recommendation logic can be exercised.
with founder as (
  select id from public.profiles
  where platform_role = 'founder' and lower(coalesce(display_name,'')) = 'jonathan'
  order by created_at
  limit 1
), personas as (
  select profile_id from private.synthetic_personas where enabled = true
)
insert into public.member_connections (requester_id, addressee_id, status)
select sp.profile_id, f.id, 'accepted'
from personas sp cross join founder f
where sp.profile_id <> f.id
  and not exists (
    select 1 from public.member_connections mc
    where least(mc.requester_id, mc.addressee_id) = least(sp.profile_id, f.id)
      and greatest(mc.requester_id, mc.addressee_id) = greatest(sp.profile_id, f.id)
  );

-- Seed different event histories so public profiles naturally land at different rank levels.
-- Adventure count comes from member_journey, which includes official event stamps.
with desired(email, desired_count) as (
  values
    ('avery.king@ma-demo.test',0),
    ('eli.green@ma-demo.test',1),
    ('maya.brooks@ma-demo.test',1),
    ('tasha.green@ma-demo.test',3),
    ('nia.carter@ma-demo.test',3),
    ('melanatedadventurersfl+trailtester02@gmail.com',3),
    ('jordan.reed@ma-demo.test',5),
    ('melanatedadventurersfl+hosttester01@gmail.com',5),
    ('marcus.ellis@ma-demo.test',6),
    ('melanatedadventurersfl+trailtester01@gmail.com',8),
    ('devon.hill@ma-demo.test',10)
), completed as (
  select a.id as adventure_id, a.starts_at, a.ends_at, ps.id as stamp_id,
         row_number() over (order by a.starts_at desc) as rn
  from public.adventures a
  join public.passport_stamps ps on ps.code = 'official-event-' || a.id::text
  where a.status = 'completed'
), grants as (
  select p.id as profile_id, c.adventure_id, c.stamp_id,
         coalesce(c.ends_at, c.starts_at) + interval '2 hours' as earned_at
  from desired d
  join public.profiles p on lower(p.email) = lower(d.email)
  join completed c on c.rn <= d.desired_count
)
insert into public.member_passport_stamps (profile_id, stamp_id, adventure_id, earned_at, evidence)
select g.profile_id, g.stamp_id, g.adventure_id, g.earned_at,
       jsonb_build_object('source','synthetic-pilot-seed')
from grants g
on conflict (profile_id, stamp_id, adventure_id) do nothing;

-- Seed one recent conversation starter per persona. Existing legacy tester posts are retained.
with seed_posts(email, seed_key, group_name, body, age_hours, image_slug) as (
  values
    ('maya.brooks@ma-demo.test','maya-first-camp-question','Beginner Outdoors','What is one piece of camping gear you bought too early and one you wish you had bought sooner?',72,null),
    ('jordan.reed@ma-demo.test','jordan-camp-breakfast','Camping','What is everybody using for a quick camp breakfast that does not create a sink full of dishes?',54,null),
    ('nia.carter@ma-demo.test','nia-paddle-morning','Water Adventures','Paddle mornings are becoming my favorite kind of reset. Calm water, no rush, done before the heat gets disrespectful.',31,'great-melanated-float-out-juneteenth-2026'),
    ('marcus.ellis@ma-demo.test','marcus-jax-outside','Jacksonville Outside Social','Jacksonville has enough different outdoor spots that I keep finding places I should have visited years ago.',26,'huguenot-park-camping-trip-2025'),
    ('avery.king@ma-demo.test','avery-easy-outing','Miami Bayfront Ride','I am learning that an easy outing can still be the best part of the weekend.',21,null),
    ('devon.hill@ma-demo.test','devon-borrow-first','Camping','The best beginner gear advice is still to borrow before buying whenever you can.',18,null),
    ('tasha.green@ma-demo.test','tasha-family-snacks','Family Adventures','Family outing success starts with snacks before anybody admits they are hungry.',15,null),
    ('eli.green@ma-demo.test','eli-gear-question','Beginner Outdoors','Still figuring out the difference between gear I need and gear the internet convinced me I need.',12,null),
    ('melanatedadventurersfl+trailtester01@gmail.com','simone-quiet-trail','Hiking','A quiet trail before breakfast does more for me than another hour of sleep sometimes.',9,'black-and-breezy-summer-cool-down-2025'),
    ('melanatedadventurersfl+trailtester02@gmail.com','andre-local-trails','Tallahassee Trail Social','Trying to do more local trail days before planning another big trip.',6,null),
    ('melanatedadventurersfl+hosttester01@gmail.com','rochelle-clear-plan','Jacksonville Outside Social','My favorite outings are the ones where a new person can understand the whole plan in thirty seconds.',3,null)
)
insert into public.community_posts (
  author_id, group_id, audience, post_type, body, image_url, metadata, status, created_at, updated_at
)
select p.id, g.id, 'group', case when position('?' in s.body) > 0 then 'ask' else 'update' end,
       s.body, a.hero_image_url,
       jsonb_build_object('synthetic_activity', true, 'synthetic_seed_key', s.seed_key, 'persona_key', sp.persona_key),
       'published', now() - make_interval(hours => s.age_hours), now() - make_interval(hours => s.age_hours)
from seed_posts s
join public.profiles p on lower(p.email) = lower(s.email)
join private.synthetic_personas sp on sp.profile_id = p.id
join public.community_groups g on g.name = s.group_name
left join public.adventures a on a.slug = s.image_slug
where not exists (
  select 1 from public.community_posts existing
  where existing.metadata ->> 'synthetic_seed_key' = s.seed_key
);

-- Seed replies across the synthetic conversation set. A few use existing adventure imagery
-- as an HTTP photo attachment, which the reply renderer already supports without storage signing.
with seed_comments(author_email, target_seed_key, body, age_hours, photo_slug) as (
  values
    ('marcus.ellis@ma-demo.test','maya-first-camp-question','Borrow a few things first if you can. My first expensive mistake was buying a giant cook kit for two people.',64,null),
    ('tasha.green@ma-demo.test','maya-first-camp-question','A comfortable sleep setup earned its space immediately for us.',61,null),
    ('maya.brooks@ma-demo.test','jordan-camp-breakfast','Breakfast burritos wrapped before the trip have been saving me from doing dishes at 8 a.m.',45,null),
    ('devon.hill@ma-demo.test','jordan-camp-breakfast','Prepped food wins. One pan should be the upper limit before coffee.',42,null),
    ('avery.king@ma-demo.test','nia-paddle-morning','This view is worth an early alarm.',24,'great-melanated-float-out-juneteenth-2026'),
    ('eli.green@ma-demo.test','nia-paddle-morning','This feels like a good first water day if the conditions stay calm.',22,null),
    ('rochellehosts@example.invalid','unused','',20,null),
    ('jordan.reed@ma-demo.test','marcus-jax-outside','Local days are underrated. You can be outside and still sleep in your own bed.',19,null),
    ('melanatedadventurersfl+hosttester01@gmail.com','marcus-jax-outside','Good local meetup spots make hosting so much easier.',17,null),
    ('nia.carter@ma-demo.test','avery-easy-outing','Easy does not mean boring. Some of my favorite days are the simple ones.',13,null),
    ('maya.brooks@ma-demo.test','devon-borrow-first','I needed this reminder before buying another thing from my saved cart.',11,null),
    ('melanatedadventurersfl+trailtester01@gmail.com','tasha-family-snacks','The snack plan is part of the itinerary. No notes.',8,'great-melanated-beach-escape-2026'),
    ('tasha.green@ma-demo.test','eli-gear-question','Start with sleep, shade, and food. Everything else can grow from there.',7,null),
    ('melanatedadventurersfl+trailtester02@gmail.com','simone-quiet-trail','Early is the move. I like getting the trail before the day gets loud.',5,null),
    ('marcus.ellis@ma-demo.test','rochelle-clear-plan','Clear parking notes and an arrival window solve a surprising number of problems.',1,null)
), resolved as (
  select author.id as author_id, target.id as post_id, sc.body, sc.age_hours, photo.hero_image_url
  from seed_comments sc
  join public.profiles author on lower(author.email) = lower(sc.author_email)
  join public.community_posts target on target.metadata ->> 'synthetic_seed_key' = sc.target_seed_key
  left join public.adventures photo on photo.slug = sc.photo_slug
  where btrim(sc.body) <> ''
)
insert into public.community_comments (post_id, author_id, body, image_paths, status, created_at, updated_at)
select r.post_id, r.author_id, r.body,
       case when r.hero_image_url is not null then array[r.hero_image_url]::text[] else '{}'::text[] end,
       'published', now() - make_interval(hours => r.age_hours), now() - make_interval(hours => r.age_hours)
from resolved r
where not exists (
  select 1 from public.community_comments c
  where c.post_id = r.post_id and c.author_id = r.author_id and c.body = r.body
);

-- One-time replies on the founder's recent public/connection-visible posts make the connected test crew useful immediately.
with founder as (
  select id from public.profiles
  where platform_role = 'founder' and lower(coalesce(display_name,'')) = 'jonathan'
  order by created_at limit 1
), founder_posts as (
  select cp.id, row_number() over (order by cp.created_at desc) as rn
  from public.community_posts cp
  join founder f on f.id = cp.author_id
  where cp.status = 'published' and cp.audience in ('everyone','connections')
  order by cp.created_at desc
  limit 3
), founder_replies(email, rn, body) as (
  values
    ('maya.brooks@ma-demo.test',1,'I like this. It gives me enough detail to know what I would be walking into.'),
    ('marcus.ellis@ma-demo.test',2,'This one belongs on the Jacksonville list.'),
    ('melanatedadventurersfl+hosttester01@gmail.com',3,'The plan is clear enough that a first-timer could follow it without guessing.')
)
insert into public.community_comments (post_id, author_id, body, status, created_at, updated_at)
select fp.id, p.id, fr.body, 'published', now() - make_interval(hours => (fr.rn * 2)), now() - make_interval(hours => (fr.rn * 2))
from founder_replies fr
join founder_posts fp on fp.rn = fr.rn
join public.profiles p on lower(p.email) = lower(fr.email)
where not exists (
  select 1 from public.community_comments c
  where c.post_id = fp.id and c.author_id = p.id and c.body = fr.body
);

-- Seed light reactions so the first view is not a wall of zero-count cards.
insert into public.community_reactions (post_id, profile_id, reaction, created_at)
select cp.id, actor.profile_id,
       case (abs(hashtext(cp.id::text || actor.profile_id::text)) % 4)
         when 0 then 'like' when 1 then 'love' when 2 then 'celebrate' else 'support' end,
       greatest(cp.created_at, now() - interval '18 hours')
from public.community_posts cp
join private.synthetic_personas author_sp on author_sp.profile_id = cp.author_id
cross join lateral (
  select sp.profile_id
  from private.synthetic_personas sp
  where sp.profile_id <> cp.author_id and sp.enabled = true
  order by md5(cp.id::text || sp.profile_id::text)
  limit 2
) actor
where cp.status = 'published'
on conflict (post_id, profile_id) do nothing;

-- Do not create real-member notifications from synthetic comments. Synthetic-to-synthetic
-- notifications remain intact so notification screens still get realistic QA coverage.
create or replace function private.notify_community_post_author_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author_id uuid;
  post_adventure_id uuid;
  commenter_name text;
  comment_preview text;
  commenter_is_synthetic boolean := false;
  author_is_synthetic boolean := false;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select p.author_id, p.adventure_id
  into post_author_id, post_adventure_id
  from public.community_posts p
  where p.id = new.post_id;

  if post_author_id is null or post_author_id = new.author_id then
    return new;
  end if;

  select coalesce(is_synthetic, false) into commenter_is_synthetic
  from public.profiles where id = new.author_id;
  select coalesce(is_synthetic, false) into author_is_synthetic
  from public.profiles where id = post_author_id;

  if commenter_is_synthetic and not author_is_synthetic then
    return new;
  end if;

  select coalesce(
    nullif(trim(pr.display_name), ''),
    nullif(trim(pr.username), ''),
    nullif(trim(pr.first_name), ''),
    'A member'
  )
  into commenter_name
  from public.profiles pr
  where pr.id = new.author_id;

  commenter_name := coalesce(commenter_name, 'A member');
  comment_preview := left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 180);

  insert into public.notifications (
    recipient_id, adventure_id, kind, priority, title, body, action_url, dedupe_key
  ) values (
    post_author_id, post_adventure_id, 'community', 'normal',
    commenter_name || ' commented on your post', comment_preview,
    '/community/' || new.post_id::text,
    'community-comment:' || new.id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function private.notify_community_post_author_on_comment() from public, anon, authenticated;

-- Add the synthetic marker to public profile JSON so the app can disclose pilot personas.
create or replace function public.get_public_member_profile(target_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  p public.profiles%rowtype;
  connected boolean := false;
  can_view boolean := false;
  adventure_total integer := 0;
  stamp_total integer := 0;
  badge_total integer := 0;
  post_total integer := 0;
  featured_badges jsonb := '[]'::jsonb;
  featured_stamps jsonb := '[]'::jsonb;
  photo_albums jsonb := '[]'::jsonb;
begin
  if viewer is null then raise exception 'Sign in required.'; end if;

  select * into p from public.profiles where id = target_profile;
  if not found then return null; end if;

  if viewer <> target_profile then
    select exists (
      select 1 from public.member_connections mc
      where mc.status::text = 'accepted'
        and ((mc.requester_id = viewer and mc.addressee_id = target_profile)
          or (mc.requester_id = target_profile and mc.addressee_id = viewer))
    ) into connected;
  end if;

  can_view := viewer = target_profile or not coalesce(p.profile_is_private, false) or connected;

  if can_view and coalesce(p.adventures_visible, true) then
    select count(*)::integer into adventure_total
    from public.member_journey mj where mj.profile_id = target_profile;
  end if;
  if can_view then
    select count(*)::integer into stamp_total
    from public.member_passport_stamps mps where mps.profile_id = target_profile;
  end if;
  if can_view and coalesce(p.badges_visible, true) then
    select count(*)::integer into badge_total
    from public.member_badges mb where mb.profile_id = target_profile;
  end if;
  if can_view then
    select count(*)::integer into post_total
    from public.community_posts cp
    where cp.author_id = target_profile and cp.status::text = 'published';
  end if;

  if can_view and coalesce(p.badges_visible, true) then
    select coalesce(jsonb_agg(row_data order by earned_at desc), '[]'::jsonb)
    into featured_badges
    from (
      select jsonb_build_object(
        'badge_id', mb.badge_id, 'title', b.title, 'description', b.description,
        'icon_name', b.icon_name, 'category', b.category, 'earned_at', mb.earned_at
      ) as row_data, mb.earned_at
      from public.member_badges mb
      join public.badges b on b.id = mb.badge_id
      where mb.profile_id = target_profile
      order by mb.earned_at desc limit 6
    ) badges;
  end if;

  if can_view then
    select coalesce(jsonb_agg(row_data order by earned_at desc), '[]'::jsonb)
    into featured_stamps
    from (
      select jsonb_build_object(
        'stamp_id', mps.stamp_id, 'code', ps.code, 'title', ps.title,
        'description', ps.description, 'icon_name', ps.icon_name,
        'earned_at', mps.earned_at, 'adventure_id', mps.adventure_id
      ) as row_data, mps.earned_at
      from public.member_passport_stamps mps
      join public.passport_stamps ps on ps.id = mps.stamp_id
      where mps.profile_id = target_profile
      order by mps.earned_at desc limit 6
    ) stamps;
  end if;

  if can_view then
    select coalesce(jsonb_agg(album order by latest_at desc), '[]'::jsonb)
    into photo_albums
    from (
      select jsonb_build_object(
        'adventure_id', amp.adventure_id,
        'title', coalesce(a.title, 'Adventure photos'),
        'photo_count', count(*)::integer,
        'cover_url', (array_agg(amp.image_url order by amp.created_at desc))[1]
      ) as album, max(amp.created_at) as latest_at
      from public.adventure_memory_photos amp
      left join public.adventures a on a.id = amp.adventure_id
      where amp.profile_id = target_profile
        and amp.moderation_status::text = 'approved'
        and amp.visibility::text in ('group', 'public')
      group by amp.adventure_id, a.title
    ) albums;
  end if;

  return jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'cover_url', case when can_view then p.cover_url else null end,
    'bio', case when can_view then p.bio else null end,
    'home_city', case when can_view and coalesce(p.city_visible, true) then p.home_city else null end,
    'home_state', case when can_view and coalesce(p.city_visible, true) then p.home_state else null end,
    'profile_is_private', coalesce(p.profile_is_private, false),
    'platform_role', coalesce(p.platform_role, 'member'),
    'event_host_level', coalesce(p.event_host_level, 'member'),
    'interests', case when can_view and coalesce(p.interests_visible, true) then to_jsonb(p.interests) else 'null'::jsonb end,
    'pronouns', case when can_view and coalesce(p.pronouns_visible, true) then p.pronouns else null end,
    'created_at', p.created_at,
    'can_see_full_profile', can_view,
    'adventures_visible', coalesce(p.adventures_visible, true),
    'badges_visible', coalesce(p.badges_visible, true),
    'interests_visible', coalesce(p.interests_visible, true),
    'trail_family_visible', coalesce(p.trail_family_visible, true),
    'is_synthetic', coalesce(p.is_synthetic, false),
    'adventure_count', adventure_total,
    'stamp_count', stamp_total,
    'badge_count', badge_total,
    'post_count', post_total,
    'featured_badges', featured_badges,
    'featured_stamps', featured_stamps,
    'photo_albums', photo_albums
  );
end;
$$;

revoke all on function public.get_public_member_profile(uuid) from public;
grant execute on function public.get_public_member_profile(uuid) to authenticated;

-- Activity engine. It runs against synthetic posts only by default. Operators can flip
-- target_real_member_content later, but production defaults stay isolated from real members.
create or replace function private.run_synthetic_activity_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg private.synthetic_activity_settings%rowtype;
  actor private.synthetic_personas%rowtype;
  local_now timestamp;
  local_hour integer;
  actions_today integer := 0;
  actor_actions_today integer := 0;
  action_roll double precision;
  should_act boolean := false;
  selected_body text;
  selected_photo text;
  selected_group uuid;
  target_post uuid;
  target_author uuid;
  reaction_value text;
  inserted_id uuid;
  result jsonb := '{}'::jsonb;
begin
  select * into cfg from private.synthetic_activity_settings where settings_key = 'default';
  if not found or not cfg.enabled then
    return jsonb_build_object('status','disabled');
  end if;

  local_now := timezone(cfg.activity_timezone, now());
  local_hour := extract(hour from local_now)::integer;

  update private.synthetic_activity_settings
  set last_tick_at = now(), updated_at = now()
  where settings_key = 'default';

  if cfg.quiet_start_hour < cfg.quiet_end_hour then
    if local_hour >= cfg.quiet_start_hour and local_hour < cfg.quiet_end_hour then
      return jsonb_build_object('status','quiet_hours','hour',local_hour);
    end if;
  elsif local_hour >= cfg.quiet_start_hour or local_hour < cfg.quiet_end_hour then
    return jsonb_build_object('status','quiet_hours','hour',local_hour);
  end if;

  select count(*)::integer into actions_today
  from private.synthetic_activity_log l
  where timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
    and l.action_type <> 'seed';

  if actions_today >= cfg.max_daily_actions then
    return jsonb_build_object('status','daily_cap','actions_today',actions_today);
  end if;

  should_act := random() < case
    when local_hour >= 20 and actions_today < cfg.min_daily_actions then 0.82
    when actions_today < cfg.min_daily_actions then 0.46
    else 0.30
  end;

  if not should_act then
    return jsonb_build_object('status','idle','actions_today',actions_today);
  end if;

  select sp.* into actor
  from private.synthetic_personas sp
  where sp.enabled = true
    and (
      select count(*)
      from private.synthetic_activity_log l
      where l.actor_profile_id = sp.profile_id
        and timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
        and l.action_type <> 'seed'
    ) < sp.max_daily_actions
  order by random() / greatest(sp.activity_weight, 1)
  limit 1;

  if not found then
    return jsonb_build_object('status','persona_caps','actions_today',actions_today);
  end if;

  select count(*)::integer into actor_actions_today
  from private.synthetic_activity_log l
  where l.actor_profile_id = actor.profile_id
    and timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
    and l.action_type <> 'seed';

  action_roll := random();

  -- Around 16% of activity creates a new conversation starter.
  if action_roll < 0.16 then
    select template into selected_body
    from unnest(actor.post_templates) template
    where not exists (
      select 1 from public.community_posts cp
      where cp.author_id = actor.profile_id
        and cp.body = template
        and cp.created_at > now() - interval '30 days'
    )
    order by random()
    limit 1;

    if selected_body is null then
      selected_body := actor.post_templates[1];
    end if;

    select cgm.group_id into selected_group
    from public.community_group_members cgm
    where cgm.profile_id = actor.profile_id
    order by random()
    limit 1;

    if selected_body is not null and btrim(selected_body) <> '' then
      insert into public.community_posts (
        author_id, group_id, audience, post_type, body, metadata, status
      ) values (
        actor.profile_id,
        selected_group,
        case when selected_group is null then 'everyone' else 'group' end,
        case when position('?' in selected_body) > 0 then 'ask' else 'update' end,
        selected_body,
        jsonb_build_object('synthetic_activity', true, 'persona_key', actor.persona_key),
        'published'
      ) returning id into inserted_id;

      insert into private.synthetic_activity_log (actor_profile_id, action_type, target_kind, target_id, context)
      values (actor.profile_id, 'post', 'post', inserted_id, jsonb_build_object('group_id', selected_group));

      return jsonb_build_object('status','created','action','post','actor',actor.persona_key,'target_id',inserted_id);
    end if;
  end if;

  -- Find a recent post the actor has not already replied to. Real-member posts are excluded by default.
  select cp.id, cp.author_id into target_post, target_author
  from public.community_posts cp
  join public.profiles author on author.id = cp.author_id
  where cp.status = 'published'
    and cp.author_id <> actor.profile_id
    and cp.created_at > now() - interval '21 days'
    and (cfg.target_real_member_content or author.is_synthetic = true)
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = actor.profile_id and b.blocked_id = cp.author_id)
         or (b.blocker_id = cp.author_id and b.blocked_id = actor.profile_id)
    )
  order by
    case when exists (
      select 1 from public.community_group_members mine
      where mine.profile_id = actor.profile_id and mine.group_id = cp.group_id
    ) then 0 else 1 end,
    cp.created_at desc,
    random()
  limit 1;

  if target_post is null then
    -- No viable target. Force a post instead of touching real content.
    selected_body := actor.post_templates[1];
    select cgm.group_id into selected_group
    from public.community_group_members cgm
    where cgm.profile_id = actor.profile_id
    order by random() limit 1;

    if selected_body is not null then
      insert into public.community_posts (author_id, group_id, audience, post_type, body, metadata, status)
      values (
        actor.profile_id, selected_group,
        case when selected_group is null then 'everyone' else 'group' end,
        case when position('?' in selected_body) > 0 then 'ask' else 'update' end,
        selected_body,
        jsonb_build_object('synthetic_activity', true, 'persona_key', actor.persona_key),
        'published'
      ) returning id into inserted_id;

      insert into private.synthetic_activity_log (actor_profile_id, action_type, target_kind, target_id, context)
      values (actor.profile_id, 'post', 'post', inserted_id, jsonb_build_object('fallback', true));

      return jsonb_build_object('status','created','action','post','actor',actor.persona_key,'target_id',inserted_id);
    end if;
  end if;

  -- Roughly one third of non-post activity is a reaction.
  if action_roll >= 0.62 then
    if not exists (
      select 1 from public.community_reactions r
      where r.post_id = target_post and r.profile_id = actor.profile_id
    ) then
      reaction_value := (array['like','love','celebrate','support'])[1 + floor(random() * 4)::integer];
      insert into public.community_reactions (post_id, profile_id, reaction)
      values (target_post, actor.profile_id, reaction_value)
      on conflict (post_id, profile_id) do nothing;

      insert into private.synthetic_activity_log (actor_profile_id, action_type, target_kind, target_id, context)
      values (actor.profile_id, 'reaction', 'post', target_post, jsonb_build_object('reaction', reaction_value));

      return jsonb_build_object('status','created','action','reaction','actor',actor.persona_key,'target_id',target_post);
    end if;
  end if;

  select template into selected_body
  from unnest(actor.comment_templates) template
  where not exists (
    select 1 from public.community_comments c
    where c.post_id = target_post and c.author_id = actor.profile_id and c.body = template
  )
  order by random()
  limit 1;

  if selected_body is null then
    selected_body := actor.comment_templates[1];
  end if;

  if selected_body is null or btrim(selected_body) = '' then
    return jsonb_build_object('status','idle','reason','no_comment_template');
  end if;

  selected_photo := null;
  if cardinality(actor.photo_paths) > 0 and random() < 0.18 then
    selected_photo := actor.photo_paths[1 + floor(random() * cardinality(actor.photo_paths))::integer];
  end if;

  insert into public.community_comments (post_id, author_id, body, image_paths, status)
  values (
    target_post, actor.profile_id, selected_body,
    case when selected_photo is null then '{}'::text[] else array[selected_photo]::text[] end,
    'published'
  ) returning id into inserted_id;

  insert into private.synthetic_activity_log (actor_profile_id, action_type, target_kind, target_id, context)
  values (
    actor.profile_id,
    case when selected_photo is null then 'comment' else 'photo_comment' end,
    'comment', inserted_id,
    jsonb_build_object('post_id', target_post)
  );

  result := jsonb_build_object(
    'status','created',
    'action',case when selected_photo is null then 'comment' else 'photo_comment' end,
    'actor',actor.persona_key,
    'target_id',target_post,
    'actions_today',actions_today + 1,
    'actor_actions_today',actor_actions_today + 1
  );
  return result;
end;
$$;

revoke all on function private.run_synthetic_activity_tick() from public, anon, authenticated;
grant execute on function private.run_synthetic_activity_tick() to service_role;

-- Give two personas safe reusable HTTP image references for occasional photo replies.
-- These are existing adventure hero assets, not member-owned uploads.
update private.synthetic_personas sp
set photo_paths = x.paths, updated_at = now()
from (
  select 'nia_carter' as persona_key,
         array_remove(array[
           (select hero_image_url from public.adventures where slug = 'great-melanated-float-out-juneteenth-2026'),
           (select hero_image_url from public.adventures where slug = 'great-melanated-beach-escape-2026')
         ]::text[], null) as paths
  union all
  select 'simone_price',
         array_remove(array[
           (select hero_image_url from public.adventures where slug = 'black-and-breezy-summer-cool-down-2025'),
           (select hero_image_url from public.adventures where slug = 'huguenot-park-camping-trip-2025')
         ]::text[], null)
) x
where sp.persona_key = x.persona_key;

-- Replace any previous copy of the job so the migration is idempotent.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'synthetic-community-activity' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'synthetic-community-activity',
    '*/30 * * * *',
    'select private.run_synthetic_activity_tick();'
  );
end;
$$;
