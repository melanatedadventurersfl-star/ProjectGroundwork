alter table public.adventures
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists timezone text;

alter table public.adventures
  drop constraint if exists adventures_latitude_valid,
  drop constraint if exists adventures_longitude_valid;

alter table public.adventures
  add constraint adventures_latitude_valid check (latitude is null or latitude between -90 and 90),
  add constraint adventures_longitude_valid check (longitude is null or longitude between -180 and 180);

create or replace view public.adventure_discovery as
select
  a.id,
  a.slug,
  a.title,
  a.summary,
  a.category,
  a.difficulty,
  a.status,
  a.starts_at,
  a.ends_at,
  a.city,
  a.state,
  a.venue_name,
  a.hero_image_url,
  a.capacity,
  a.spots_remaining,
  a.starting_price_cents,
  a.is_featured,
  a.address,
  a.latitude,
  a.longitude,
  a.timezone
from public.adventures a
where a.status in ('published', 'sold_out')
  and a.ends_at >= now();

grant select on public.adventure_discovery to authenticated;

comment on column public.adventures.address is 'Canonical public adventure address when appropriate.';
comment on column public.adventures.latitude is 'Precise destination latitude used for weather and mapping.';
comment on column public.adventures.longitude is 'Precise destination longitude used for weather and mapping.';
comment on column public.adventures.timezone is 'IANA timezone for the adventure destination.';
