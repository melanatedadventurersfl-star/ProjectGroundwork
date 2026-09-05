-- Event Analytics Pipeline V2: first-party backfill
-- Reconciles existing Go Melanated orders and current intent state into the new analytics model.

insert into public.host_event_analytics_events (
  campaign_id,
  connection_id,
  event_name,
  source,
  quantity,
  value_cents,
  actor_profile_id,
  surface,
  dedupe_key,
  order_id,
  occurred_at,
  metadata
)
select
  c.id,
  app_private.ensure_go_melanated_connection(c.id, c.adventure_id),
  'ticket_ordered',
  'go_melanated',
  1,
  o.total_cents,
  o.purchaser_id,
  'checkout',
  'order-paid:' || o.id::text,
  o.id,
  coalesce(o.paid_at, o.created_at),
  jsonb_build_object(
    'ticket_count', (select count(*) from public.order_attendees oa where oa.order_id = o.id),
    'order_status', o.status,
    'backfill', true
  )
from public.orders o
join public.host_campaigns c on c.adventure_id = o.adventure_id
where o.status in ('paid'::public.order_status, 'refunded'::public.order_status)
on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

insert into public.host_event_analytics_events (
  campaign_id,
  connection_id,
  event_name,
  source,
  quantity,
  value_cents,
  actor_profile_id,
  surface,
  dedupe_key,
  order_id,
  occurred_at,
  metadata
)
select
  c.id,
  app_private.ensure_go_melanated_connection(c.id, c.adventure_id),
  'ticket_refunded',
  'go_melanated',
  1,
  o.total_cents,
  o.purchaser_id,
  'checkout',
  'order-refunded:' || o.id::text,
  o.id,
  o.updated_at,
  jsonb_build_object(
    'ticket_count', (select count(*) from public.order_attendees oa where oa.order_id = o.id),
    'order_status', o.status,
    'backfill', true
  )
from public.orders o
join public.host_campaigns c on c.adventure_id = o.adventure_id
where o.status = 'refunded'::public.order_status
on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

with ticket_counts as (
  select
    c.id as campaign_id,
    c.adventure_id,
    oa.ticket_type_id,
    count(*)::integer as sold,
    count(*) filter (where o.status = 'refunded'::public.order_status)::integer as refunded_tickets
  from public.orders o
  join public.host_campaigns c on c.adventure_id = o.adventure_id
  join public.order_attendees oa on oa.order_id = o.id
  where o.status in ('paid'::public.order_status, 'refunded'::public.order_status)
    and oa.ticket_type_id is not null
  group by c.id, c.adventure_id, oa.ticket_type_id
), ticket_revenue as (
  select
    c.id as campaign_id,
    oi.ticket_type_id,
    coalesce(sum(oi.line_total_cents), 0)::integer as gross_revenue_cents,
    coalesce(sum(oi.line_total_cents) filter (where o.status = 'refunded'::public.order_status), 0)::integer as refunded_cents
  from public.orders o
  join public.host_campaigns c on c.adventure_id = o.adventure_id
  join public.order_items oi on oi.order_id = o.id
  where o.status in ('paid'::public.order_status, 'refunded'::public.order_status)
    and oi.ticket_type_id is not null
  group by c.id, oi.ticket_type_id
)
insert into public.host_event_ticket_sources (
  campaign_id,
  connection_id,
  source,
  external_ticket_class_id,
  label,
  capacity,
  sold,
  gross_revenue_cents,
  refunded_cents,
  refunded_tickets,
  cancelled_tickets,
  last_synced_at,
  metadata
)
select
  tc.campaign_id,
  app_private.ensure_go_melanated_connection(tc.campaign_id, tc.adventure_id),
  'go_melanated',
  tt.id::text,
  tt.name,
  tt.capacity,
  tc.sold,
  coalesce(tr.gross_revenue_cents, 0),
  coalesce(tr.refunded_cents, 0),
  tc.refunded_tickets,
  0,
  now(),
  jsonb_build_object('first_party', true, 'ticket_type_id', tt.id, 'backfill', true)
from ticket_counts tc
join public.ticket_types tt on tt.id = tc.ticket_type_id
left join ticket_revenue tr on tr.campaign_id = tc.campaign_id and tr.ticket_type_id = tc.ticket_type_id
on conflict (campaign_id, source, external_ticket_class_id) where external_ticket_class_id is not null
do update set
  connection_id = excluded.connection_id,
  label = excluded.label,
  capacity = excluded.capacity,
  sold = excluded.sold,
  gross_revenue_cents = excluded.gross_revenue_cents,
  refunded_cents = excluded.refunded_cents,
  refunded_tickets = excluded.refunded_tickets,
  last_synced_at = now(),
  metadata = public.host_event_ticket_sources.metadata || excluded.metadata,
  updated_at = now();

insert into public.host_event_analytics_events (
  campaign_id,
  connection_id,
  event_name,
  source,
  actor_profile_id,
  surface,
  dedupe_key,
  occurred_at,
  metadata
)
select
  c.id,
  app_private.ensure_go_melanated_connection(c.id, c.adventure_id),
  case r.status
    when 'interested' then 'event_interested'
    when 'going' then 'event_going'
    else 'event_not_going'
  end,
  'go_melanated',
  r.profile_id,
  'event_detail',
  format('rsvp-backfill:%s:%s:%s', r.adventure_id, r.profile_id, r.status),
  r.updated_at,
  jsonb_build_object('backfill', true, 'visibility', r.visibility)
from public.adventure_rsvps r
join public.host_campaigns c on c.adventure_id = r.adventure_id
on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

insert into public.host_event_analytics_events (
  campaign_id,
  connection_id,
  event_name,
  source,
  actor_profile_id,
  surface,
  dedupe_key,
  occurred_at,
  metadata
)
select
  c.id,
  app_private.ensure_go_melanated_connection(c.id, c.adventure_id),
  'event_saved',
  'go_melanated',
  s.profile_id,
  'event_detail',
  format('save-backfill:%s:%s', s.adventure_id, s.profile_id),
  s.created_at,
  jsonb_build_object('backfill', true)
from public.saved_adventures s
join public.host_campaigns c on c.adventure_id = s.adventure_id
on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;
