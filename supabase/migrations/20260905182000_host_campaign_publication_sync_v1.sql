-- Host Center publication synchronization V1
-- Host Center controls event lifecycle while Go Melanated remains a native distribution destination.
-- Publishing is transactional so a campaign cannot report Live while its linked member event is still Draft.

create or replace function public.publish_host_campaign(p_campaign_id uuid)
returns table(
  campaign_status text,
  adventure_status text,
  published_at timestamptz,
  connection_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.host_campaigns%rowtype;
  v_adventure public.adventures%rowtype;
  v_has_ticket boolean;
  v_has_paid_ticket boolean;
  v_connection_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_campaign
  from public.host_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'Host Center event not found.' using errcode = 'P0002';
  end if;

  if not app_private.can_manage_host_campaign(p_campaign_id) then
    raise exception 'You do not have permission to publish this event.' using errcode = '42501';
  end if;

  select * into v_adventure
  from public.adventures
  where id = v_campaign.adventure_id
  for update;

  if not found then
    raise exception 'Linked Go Melanated event not found.' using errcode = 'P0002';
  end if;

  if v_adventure.status in ('cancelled', 'completed') then
    raise exception 'Cancelled and completed events cannot be published.';
  end if;

  select
    exists(
      select 1 from public.ticket_types
      where adventure_id = v_adventure.id and is_active
    ),
    exists(
      select 1 from public.ticket_types
      where adventure_id = v_adventure.id and is_active and price_cents > 0
    )
  into v_has_ticket, v_has_paid_ticket;

  if not v_has_ticket then
    raise exception 'Add at least one active ticket or RSVP type before publishing.';
  end if;

  if v_has_paid_ticket and not public.can_host_paid_outings(v_adventure.created_by) then
    raise exception 'Paid outing approval is required before publishing paid tickets.';
  end if;

  update public.adventures
  set status = case when status = 'sold_out' then status else 'published' end,
      published_at = coalesce(published_at, now()),
      spots_remaining = coalesce(spots_remaining, capacity)
  where id = v_adventure.id
  returning * into v_adventure;

  update public.host_campaigns
  set status = 'live',
      updated_at = now()
  where id = v_campaign.id
  returning * into v_campaign;

  insert into public.host_event_connections(
    campaign_id,
    provider,
    external_event_id,
    display_name,
    status,
    capabilities,
    last_synced_at,
    updated_at
  ) values (
    v_campaign.id,
    'go_melanated',
    v_adventure.id::text,
    'Go Melanated',
    'connected',
    jsonb_build_object(
      'native', true,
      'publish_event', true,
      'publish_post', true,
      'rsvp', true,
      'tickets', true,
      'waitlist', true,
      'analytics', true,
      'member_feed', true
    ),
    now(),
    now()
  )
  on conflict (campaign_id, provider, external_event_id)
  do update set
    display_name = excluded.display_name,
    status = 'connected',
    capabilities = excluded.capabilities,
    last_synced_at = now(),
    updated_at = now()
  returning id into v_connection_id;

  insert into public.host_event_promotions(
    campaign_id,
    connection_id,
    promotion_key,
    channel,
    content_type,
    title,
    destination_url,
    tracking_code,
    published_at,
    status,
    metadata
  ) values (
    v_campaign.id,
    v_connection_id,
    'event-listing:go_melanated',
    'go_melanated',
    'event_listing',
    v_campaign.title,
    '/adventures/' || v_adventure.id::text,
    'gm:event:' || v_campaign.id::text,
    v_adventure.published_at,
    'published',
    jsonb_build_object(
      'source', 'host_center',
      'provider', 'go_melanated',
      'adventure_id', v_adventure.id,
      'campaign_id', v_campaign.id
    )
  )
  on conflict (campaign_id, promotion_key)
  do update set
    connection_id = excluded.connection_id,
    title = excluded.title,
    destination_url = excluded.destination_url,
    tracking_code = excluded.tracking_code,
    published_at = excluded.published_at,
    status = 'published',
    metadata = excluded.metadata,
    updated_at = now();

  return query
  select v_campaign.status, v_adventure.status::text, v_adventure.published_at, v_connection_id;
end;
$$;

revoke all on function public.publish_host_campaign(uuid) from public, anon;
grant execute on function public.publish_host_campaign(uuid) to authenticated, service_role;

-- If an adventure changes state through another first-party host surface, keep Host Center aligned.
create or replace function app_private.sync_host_campaign_from_adventure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('published', 'sold_out') then
    update public.host_campaigns
    set status = 'live', updated_at = now()
    where adventure_id = new.id
      and status in ('planning', 'live');
  elsif new.status in ('cancelled', 'completed') then
    update public.host_campaigns
    set status = 'complete', updated_at = now()
    where adventure_id = new.id
      and status <> 'complete';
  end if;
  return new;
end;
$$;

revoke all on function app_private.sync_host_campaign_from_adventure() from public, anon, authenticated;

drop trigger if exists sync_host_campaign_from_adventure on public.adventures;
create trigger sync_host_campaign_from_adventure
after update of status on public.adventures
for each row
when (old.status is distinct from new.status)
execute function app_private.sync_host_campaign_from_adventure();

-- Block legacy/direct updates that would recreate publication drift.
create or replace function app_private.guard_host_campaign_publication_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adventure_status public.adventure_status;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select status into v_adventure_status
  from public.adventures
  where id = new.adventure_id;

  if new.status = 'live' and v_adventure_status not in ('published', 'sold_out') then
    raise exception 'Publish the event through the Host Center Publish Event action before marking it Live.';
  end if;

  if new.status = 'planning' and v_adventure_status in ('published', 'sold_out') then
    raise exception 'A published Go Melanated event cannot return to Planning without an unpublish workflow.';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_host_campaign_publication_status() from public, anon, authenticated;

drop trigger if exists guard_host_campaign_publication_status on public.host_campaigns;
create trigger guard_host_campaign_publication_status
before update of status on public.host_campaigns
for each row execute function app_private.guard_host_campaign_publication_status();

-- Repair any existing Live/Draft drift that can already pass publication validation.
-- This is intentionally data-driven rather than tied to one event ID.
update public.adventures a
set status = 'published',
    published_at = coalesce(a.published_at, now()),
    spots_remaining = coalesce(a.spots_remaining, a.capacity)
from public.host_campaigns c
where c.adventure_id = a.id
  and c.status = 'live'
  and a.status in ('draft', 'scheduled')
  and exists (
    select 1 from public.ticket_types tt
    where tt.adventure_id = a.id and tt.is_active
  )
  and (
    not exists (
      select 1 from public.ticket_types tt
      where tt.adventure_id = a.id and tt.is_active and tt.price_cents > 0
    )
    or public.can_host_paid_outings(a.created_by)
  );

-- Record the native event listing for already published active campaigns.
insert into public.host_event_promotions(
  campaign_id,
  connection_id,
  promotion_key,
  channel,
  content_type,
  title,
  destination_url,
  tracking_code,
  published_at,
  status,
  metadata
)
select
  c.id,
  conn.id,
  'event-listing:go_melanated',
  'go_melanated',
  'event_listing',
  c.title,
  '/adventures/' || c.adventure_id::text,
  'gm:event:' || c.id::text,
  a.published_at,
  'published',
  jsonb_build_object(
    'source', 'host_center',
    'provider', 'go_melanated',
    'adventure_id', c.adventure_id,
    'campaign_id', c.id,
    'reconciled', true
  )
from public.host_campaigns c
join public.adventures a on a.id = c.adventure_id
left join public.host_event_connections conn
  on conn.campaign_id = c.id
 and conn.provider = 'go_melanated'
 and conn.external_event_id = c.adventure_id::text
where c.status = 'live'
  and a.status in ('published', 'sold_out')
on conflict (campaign_id, promotion_key)
do update set
  connection_id = excluded.connection_id,
  title = excluded.title,
  destination_url = excluded.destination_url,
  tracking_code = excluded.tracking_code,
  published_at = excluded.published_at,
  status = 'published',
  metadata = excluded.metadata,
  updated_at = now();
