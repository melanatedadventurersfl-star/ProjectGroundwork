alter table public.adventures
  add column if not exists hero_focal_x real not null default 0.5,
  add column if not exists hero_focal_y real not null default 0.5,
  add column if not exists hero_zoom real not null default 1.0;

alter table public.adventures drop constraint if exists adventures_hero_focal_x_check;
alter table public.adventures add constraint adventures_hero_focal_x_check check (hero_focal_x between 0 and 1);
alter table public.adventures drop constraint if exists adventures_hero_focal_y_check;
alter table public.adventures add constraint adventures_hero_focal_y_check check (hero_focal_y between 0 and 1);
alter table public.adventures drop constraint if exists adventures_hero_zoom_check;
alter table public.adventures add constraint adventures_hero_zoom_check check (hero_zoom between 1 and 3);

alter table public.host_campaign_tasks
  add column if not exists target_component text,
  add column if not exists target_entity_type text,
  add column if not exists target_entity_id text,
  add column if not exists target_focus text,
  add column if not exists action_type text;

create or replace function private.set_campaign_task_action_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_component is null and new.task_key like 'component-%' then
    new.target_component := split_part(new.task_key, '-', 2);
  end if;

  if new.target_focus is null then
    new.target_focus := case
      when new.task_key = 'component-venue-confirm-venue-contract-and-deposit' then 'booking'
      when new.task_key = 'component-venue-confirm-parking-power-and-access' then 'logistics'
      when new.task_key = 'component-tickets-finalize-ticket-types-and-pricing' then 'ticket-types'
      when new.task_key = 'component-tickets-confirm-ticket-capacity' then 'capacity'
      when new.task_key = 'component-tickets-review-refund-and-transfer-policy' then 'policies'
      when new.task_key = 'component-communications-review-attendee-communication-schedule' then 'schedule'
      when new.task_key = 'component-communications-finalize-day-before-details' then 'event-day-before'
      when new.task_key = 'component-team-assign-event-leads' then 'roles'
      when new.task_key = 'component-team-confirm-team-responsibilities' then 'assignments'
      when new.task_key = 'component-finance-create-event-budget' then 'budget'
      when new.task_key = 'component-finance-review-committed-expenses' then 'expenses'
      when new.task_key = 'component-schedule-draft-event-schedule' then 'schedule'
      when new.task_key = 'component-schedule-finalize-run-of-show' then 'run-of-show'
      when new.task_key = 'component-equipment-build-equipment-list' then 'inventory'
      when new.task_key = 'component-equipment-resolve-equipment-shortages' then 'shortages'
      when new.task_key = 'component-safety-confirm-permits-and-insurance' then 'documents'
      when new.task_key = 'component-safety-finalize-emergency-plan' then 'emergency-plan'
      when new.task_key = 'component-marketing-create-event-marketing-plan' then 'plan'
      when new.task_key = 'component-marketing-prepare-launch-assets' then 'assets'
      when new.task_key = 'component-marketing-schedule-final-ticket-push' then 'schedule'
      when new.task_key = 'component-food-decide-meal-format' then 'format'
      when new.task_key = 'component-food-finalize-event-menu' then 'menu'
      when new.task_key = 'component-food-calculate-food-quantities' then 'quantities'
      when new.task_key = 'component-food-confirm-cooking-and-serving-equipment' then 'equipment'
      when new.task_key = 'component-vendors-open-vendor-registration' then 'registration'
      when new.task_key = 'component-vendors-confirm-vendor-requirements' then 'requirements'
      when new.task_key = 'component-vendors-review-vendor-insurance-and-permits' then 'documents'
      when new.task_key = 'component-lodging-confirm-lodging-inventory' then 'inventory'
      when new.task_key = 'component-lodging-finalize-guest-lodging-assignments' then 'assignments'
      when new.task_key = 'component-transportation-confirm-parking-and-transportation-plan' then 'plan'
      when new.target_component is not null then new.target_component
      else null
    end;
  end if;

  if new.action_type is null and new.target_component is not null then
    new.action_type := 'open';
  end if;

  return new;
end;
$$;

revoke all on function private.set_campaign_task_action_target() from public;

update public.host_campaign_tasks
set
  target_component = coalesce(target_component, case when task_key like 'component-%' then split_part(task_key, '-', 2) end),
  action_type = coalesce(action_type, case when task_key like 'component-%' then 'open' end)
where task_key like 'component-%';

update public.host_campaign_tasks
set target_focus = case
  when task_key = 'component-venue-confirm-venue-contract-and-deposit' then 'booking'
  when task_key = 'component-venue-confirm-parking-power-and-access' then 'logistics'
  when task_key = 'component-tickets-finalize-ticket-types-and-pricing' then 'ticket-types'
  when task_key = 'component-tickets-confirm-ticket-capacity' then 'capacity'
  when task_key = 'component-tickets-review-refund-and-transfer-policy' then 'policies'
  when task_key = 'component-communications-review-attendee-communication-schedule' then 'schedule'
  when task_key = 'component-communications-finalize-day-before-details' then 'event-day-before'
  when task_key = 'component-team-assign-event-leads' then 'roles'
  when task_key = 'component-finance-create-event-budget' then 'budget'
  when task_key = 'component-finance-review-committed-expenses' then 'expenses'
  when task_key = 'component-schedule-finalize-run-of-show' then 'run-of-show'
  when task_key = 'component-equipment-resolve-equipment-shortages' then 'shortages'
  when task_key = 'component-safety-confirm-permits-and-insurance' then 'documents'
  when task_key = 'component-safety-finalize-emergency-plan' then 'emergency-plan'
  else coalesce(target_focus, target_component)
end
where task_key like 'component-%';

drop trigger if exists host_campaign_task_action_target on public.host_campaign_tasks;
create trigger host_campaign_task_action_target
before insert or update of task_key, target_component, target_focus on public.host_campaign_tasks
for each row execute function private.set_campaign_task_action_target();

create index if not exists host_campaign_tasks_target_component_idx
  on public.host_campaign_tasks(campaign_id, target_component, status);

create table if not exists public.event_venues (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null unique references public.adventures(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null default 'manual' check (provider in ('google_places','manual','community_directory','tenant_history')),
  provider_place_id text,
  venue_name text not null,
  address text,
  city text,
  state text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  website_url text,
  photo_url text,
  rating numeric(3,2),
  rating_count integer,
  primary_type text,
  contact_name text,
  contact_email text,
  contact_phone text,
  booking_status text not null default 'researching' check (booking_status in ('researching','contacted','hold','contract_pending','confirmed','cancelled')),
  contract_status text not null default 'not_started' check (contract_status in ('not_started','requested','reviewing','signed','not_required')),
  contract_document_url text,
  deposit_amount_cents integer check (deposit_amount_cents is null or deposit_amount_cents >= 0),
  deposit_due_at timestamptz,
  deposit_paid_at timestamptz,
  balance_amount_cents integer check (balance_amount_cents is null or balance_amount_cents >= 0),
  balance_due_at timestamptz,
  parking_notes text,
  power_notes text,
  accessibility_notes text,
  load_in_notes text,
  restroom_notes text,
  wifi_notes text,
  arrival_notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_venues_org_event_idx on public.event_venues(organization_id, adventure_id);
create index if not exists event_venues_provider_place_idx on public.event_venues(provider, provider_place_id);

alter table public.event_venues enable row level security;
revoke all on table public.event_venues from anon, authenticated;
grant select, insert, update, delete on table public.event_venues to authenticated;

drop policy if exists "Event venue viewers can read" on public.event_venues;
create policy "Event venue viewers can read"
on public.event_venues for select to authenticated
using (
  private.has_organization_permission(organization_id, 'events.view', (select auth.uid()))
);

drop policy if exists "Event venue managers can insert" on public.event_venues;
create policy "Event venue managers can insert"
on public.event_venues for insert to authenticated
with check (
  private.has_organization_permission(organization_id, 'events.manage', (select auth.uid()))
  and exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.platform_organization_id = organization_id
  )
);

drop policy if exists "Event venue managers can update" on public.event_venues;
create policy "Event venue managers can update"
on public.event_venues for update to authenticated
using (private.has_organization_permission(organization_id, 'events.manage', (select auth.uid())))
with check (private.has_organization_permission(organization_id, 'events.manage', (select auth.uid())));

drop policy if exists "Event venue managers can delete" on public.event_venues;
create policy "Event venue managers can delete"
on public.event_venues for delete to authenticated
using (private.has_organization_permission(organization_id, 'events.manage', (select auth.uid())));

insert into public.event_venues (
  adventure_id, organization_id, provider, provider_place_id, venue_name, address, city, state,
  latitude, longitude, google_maps_url, website_url, photo_url, created_by, updated_by
)
select
  a.id,
  a.platform_organization_id,
  case
    when a.venue_source = 'google_places' then 'google_places'
    when a.venue_source = 'community_directory' then 'community_directory'
    when a.venue_source = 'tenant_history' then 'tenant_history'
    else 'manual'
  end,
  a.venue_place_id,
  a.venue_name,
  a.address,
  a.city,
  a.state,
  a.latitude,
  a.longitude,
  null,
  null,
  null,
  a.created_by,
  a.created_by
from public.adventures a
where a.platform_organization_id is not null
  and nullif(trim(a.venue_name), '') is not null
on conflict (adventure_id) do nothing;
