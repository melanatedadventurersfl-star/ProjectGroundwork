-- Event Builder UX V2
-- Adds explicit location modes, online links, cover alt text, idempotent creation,
-- and tenant-safe cover-image uploads.

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

-- event-media is already the public image bucket used by local events. Tenant event
-- managers may upload only inside their own profile folder and only for an event they own.
drop policy if exists "Organization event managers upload event covers" on storage.objects;
create policy "Organization event managers upload event covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'event-covers'
  and exists (
    select 1
    from public.adventures a
    where a.id = ((storage.foldername(name))[3])::uuid
      and a.created_by = (select auth.uid())
      and a.platform_organization_id is not null
      and private.has_organization_permission(
        a.platform_organization_id,
        'events.manage',
        (select auth.uid())
      )
  )
);

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
