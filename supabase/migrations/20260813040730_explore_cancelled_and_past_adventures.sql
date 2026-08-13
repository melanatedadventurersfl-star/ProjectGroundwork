create or replace view public.adventure_discovery as
select id, slug, title, summary, category, difficulty, status, starts_at, ends_at,
       city, state, venue_name, hero_image_url, capacity, spots_remaining,
       starting_price_cents, is_featured
from public.adventures
where status in ('published'::adventure_status, 'sold_out'::adventure_status, 'cancelled'::adventure_status)
  and ends_at >= now();

grant select on public.adventure_discovery to authenticated;

create or replace view public.past_adventure_discovery as
select id, slug, title, summary, category, difficulty, status, starts_at, ends_at,
       city, state, venue_name, hero_image_url, capacity, spots_remaining,
       starting_price_cents, is_featured
from public.adventures
where status = 'completed'::adventure_status
   or ends_at < now();

grant select on public.past_adventure_discovery to authenticated;
