-- Event Builder UX V2
-- Adds explicit location modes, online links, cover alt text, and an idempotency key.

alter table public.adventures
  add column if not exists location_type text not null default 'physical',
  add column if not exists online_url text,
  add column if not exists hero_alt_text text,
  add column if not exists creation_key text;

alter table public.adventures
  drop constraint if exists adventures_location_type_valid;

alter table public.adventures
  add constraint adventures_location_type_valid
  check (location_type in ('physical', 'online', 'hybrid', 'tbd'));

create unique index if not exists adventures_creation_key_unique_idx
  on public.adventures (creation_key)
  where creation_key is not null;

comment on column public.adventures.location_type is
  'Event location mode: physical, online, hybrid, or tbd.';
comment on column public.adventures.online_url is
  'Online meeting or streaming URL when the event has an online component.';
comment on column public.adventures.hero_alt_text is
  'Accessible text describing the event hero image.';
comment on column public.adventures.creation_key is
  'Client-generated idempotency key used to prevent duplicate draft creation on retries.';

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
  a.timezone,
  a.difficulty_applicable,
  a.event_tags,
  a.location_type,
  a.online_url,
  a.hero_alt_text
from public.adventures a
where a.status in ('published', 'sold_out')
  and a.ends_at >= now();

alter view public.adventure_discovery set (security_invoker = true);
revoke all on public.adventure_discovery from anon;
grant select on public.adventure_discovery to authenticated;

notify pgrst, 'reload schema';
