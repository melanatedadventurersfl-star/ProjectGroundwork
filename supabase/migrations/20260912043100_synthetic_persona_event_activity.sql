-- Round out fictional pilot personas with upcoming event plans and a sparse friend network.
-- These rows exist only to exercise product surfaces and should never be counted as real demand.

with plans(email, adventure_slug, rsvp_status) as (
  values
    ('maya.brooks@ma-demo.test','jax-hanna-park-paddle-2026','interested'),
    ('maya.brooks@ma-demo.test','jax-huguenot-beach-campout-2026','interested'),
    ('jordan.reed@ma-demo.test','jax-baldwin-trail-ride-2026','going'),
    ('jordan.reed@ma-demo.test','great-melanated-little-camp-of-horrors-2026','interested'),
    ('nia.carter@ma-demo.test','jax-hanna-park-paddle-2026','going'),
    ('nia.carter@ma-demo.test','great-melanated-little-camp-of-horrors-2026','going'),
    ('marcus.ellis@ma-demo.test','jax-huguenot-beach-campout-2026','going'),
    ('marcus.ellis@ma-demo.test','jax-timucuan-history-hike-2026','going'),
    ('avery.king@ma-demo.test','jax-baldwin-trail-ride-2026','interested'),
    ('devon.hill@ma-demo.test','great-melanated-little-camp-of-horrors-2026','going'),
    ('devon.hill@ma-demo.test','jax-timucuan-history-hike-2026','going'),
    ('tasha.green@ma-demo.test','great-melanated-little-camp-of-horrors-2026','interested'),
    ('tasha.green@ma-demo.test','jax-huguenot-beach-campout-2026','going'),
    ('eli.green@ma-demo.test','jax-hanna-park-paddle-2026','interested'),
    ('melanatedadventurersfl+trailtester01@gmail.com','jax-timucuan-history-hike-2026','going'),
    ('melanatedadventurersfl+trailtester02@gmail.com','jax-baldwin-trail-ride-2026','interested'),
    ('melanatedadventurersfl+hosttester01@gmail.com','great-melanated-little-camp-of-horrors-2026','going'),
    ('melanatedadventurersfl+hosttester01@gmail.com','jax-huguenot-beach-campout-2026','going')
)
insert into public.adventure_rsvps (adventure_id, profile_id, status, visibility, created_at, updated_at)
select a.id, p.id, pl.rsvp_status, 'community',
       greatest(a.created_at, now() - interval '21 days'),
       greatest(a.created_at, now() - interval '21 days')
from plans pl
join public.profiles p on lower(p.email) = lower(pl.email) and p.is_synthetic = true
join public.adventures a on a.slug = pl.adventure_slug
on conflict (adventure_id, profile_id) do update
set status = excluded.status,
    visibility = excluded.visibility,
    updated_at = excluded.updated_at;

-- A sparse network gives connection and mutual-community views realistic structure.
with pairs(email_a, email_b) as (
  values
    ('maya.brooks@ma-demo.test','devon.hill@ma-demo.test'),
    ('maya.brooks@ma-demo.test','tasha.green@ma-demo.test'),
    ('jordan.reed@ma-demo.test','marcus.ellis@ma-demo.test'),
    ('jordan.reed@ma-demo.test','melanatedadventurersfl+trailtester02@gmail.com'),
    ('nia.carter@ma-demo.test','melanatedadventurersfl+hosttester01@gmail.com'),
    ('nia.carter@ma-demo.test','avery.king@ma-demo.test'),
    ('marcus.ellis@ma-demo.test','melanatedadventurersfl+hosttester01@gmail.com'),
    ('tasha.green@ma-demo.test','eli.green@ma-demo.test'),
    ('devon.hill@ma-demo.test','melanatedadventurersfl+trailtester01@gmail.com')
), resolved as (
  select a.id as requester_id, b.id as addressee_id
  from pairs x
  join public.profiles a on lower(a.email) = lower(x.email_a) and a.is_synthetic = true
  join public.profiles b on lower(b.email) = lower(x.email_b) and b.is_synthetic = true
)
insert into public.member_connections (requester_id, addressee_id, status)
select r.requester_id, r.addressee_id, 'accepted'
from resolved r
where r.requester_id <> r.addressee_id
  and not exists (
    select 1 from public.member_connections mc
    where least(mc.requester_id, mc.addressee_id) = least(r.requester_id, r.addressee_id)
      and greatest(mc.requester_id, mc.addressee_id) = greatest(r.requester_id, r.addressee_id)
  );
