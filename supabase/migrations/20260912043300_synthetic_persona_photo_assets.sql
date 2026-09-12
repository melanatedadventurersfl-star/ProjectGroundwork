-- Reuse existing app adventure imagery as fictional pilot cover art and photo-reply media.
-- These are public adventure/location images, never member-owned uploads from the renamed tester accounts.

with covers(email, adventure_slug) as (
  values
    ('maya.brooks@ma-demo.test','jax-timucuan-history-hike-2026'),
    ('jordan.reed@ma-demo.test','jax-baldwin-trail-ride-2026'),
    ('nia.carter@ma-demo.test','jax-hanna-park-paddle-2026'),
    ('marcus.ellis@ma-demo.test','jax-huguenot-beach-campout-2026'),
    ('avery.king@ma-demo.test','the-great-melanated-beach-escape-2027-mtj4l1y0'),
    ('devon.hill@ma-demo.test','jax-timucuan-history-hike-2026'),
    ('tasha.green@ma-demo.test','jax-huguenot-beach-campout-2026'),
    ('eli.green@ma-demo.test','jax-hanna-park-paddle-2026'),
    ('melanatedadventurersfl+trailtester01@gmail.com','jax-riverside-sunset-walk-2026'),
    ('melanatedadventurersfl+trailtester02@gmail.com','jax-baldwin-trail-ride-2026'),
    ('melanatedadventurersfl+hosttester01@gmail.com','great-melanated-little-camp-of-horrors-2026')
)
update public.profiles p
set cover_url = a.hero_image_url,
    updated_at = now()
from covers c
join public.adventures a on a.slug = c.adventure_slug
where lower(p.email) = lower(c.email)
  and p.is_synthetic = true
  and a.hero_image_url is not null
  and btrim(a.hero_image_url) <> '';

with persona_photos(persona_key, slug_one, slug_two) as (
  values
    ('nia_carter','jax-hanna-park-paddle-2026','jax-huguenot-beach-campout-2026'),
    ('simone_price','jax-riverside-sunset-walk-2026','jax-timucuan-history-hike-2026'),
    ('marcus_ellis','jax-huguenot-beach-campout-2026','jax-fishing-social-2026'),
    ('avery_king','the-great-melanated-beach-escape-2027-mtj4l1y0','jax-baldwin-trail-ride-2026')
), resolved as (
  select pp.persona_key,
         array_remove(array[a1.hero_image_url, a2.hero_image_url]::text[], null) as paths
  from persona_photos pp
  left join public.adventures a1 on a1.slug = pp.slug_one
  left join public.adventures a2 on a2.slug = pp.slug_two
)
update private.synthetic_personas sp
set photo_paths = r.paths,
    updated_at = now()
from resolved r
where sp.persona_key = r.persona_key
  and cardinality(r.paths) > 0;

with photo_replies(author_email, target_seed_key, body, adventure_slug, age_minutes) as (
  values
    ('nia.carter@ma-demo.test','maya-first-camp-question','This is the kind of setup that makes me want to keep the first trip simple.','jax-hanna-park-paddle-2026',170),
    ('marcus.ellis@ma-demo.test','jordan-camp-breakfast','This is why I keep saying the campsite matters as much as the gear.','jax-huguenot-beach-campout-2026',145),
    ('avery.king@ma-demo.test','nia-paddle-morning','This is exactly the kind of water morning I mean.','the-great-melanated-beach-escape-2027-mtj4l1y0',110),
    ('melanatedadventurersfl+trailtester01@gmail.com','rochelle-clear-plan','A clear plan plus a view like this is enough for me.','jax-riverside-sunset-walk-2026',75)
), resolved as (
  select author.id as author_id,
         target.id as post_id,
         pr.body,
         a.hero_image_url,
         pr.age_minutes
  from photo_replies pr
  join public.profiles author on lower(author.email) = lower(pr.author_email) and author.is_synthetic = true
  join public.community_posts target on target.metadata ->> 'synthetic_seed_key' = pr.target_seed_key
  join public.adventures a on a.slug = pr.adventure_slug
  where a.hero_image_url is not null and btrim(a.hero_image_url) <> ''
)
insert into public.community_comments (post_id, author_id, body, image_paths, status, created_at, updated_at)
select r.post_id, r.author_id, r.body, array[r.hero_image_url]::text[], 'published',
       now() - make_interval(mins => r.age_minutes),
       now() - make_interval(mins => r.age_minutes)
from resolved r
where not exists (
  select 1
  from public.community_comments c
  where c.post_id = r.post_id
    and c.author_id = r.author_id
    and c.body = r.body
);
