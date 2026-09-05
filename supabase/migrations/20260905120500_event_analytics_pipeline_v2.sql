-- Event Analytics Pipeline V2
-- Connects Go Melanated member activity, registrations, waitlist and attendance
-- to the shared Host Center analytics model while preserving source attribution.

alter table public.host_event_analytics_events
  add column if not exists actor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists session_key text,
  add column if not exists surface text,
  add column if not exists attribution_code text,
  add column if not exists dedupe_key text,
  add column if not exists is_internal boolean not null default false,
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists ticket_type_id uuid references public.ticket_types(id) on delete set null;

alter table public.host_event_ticket_sources
  add column if not exists refunded_tickets integer not null default 0,
  add column if not exists cancelled_tickets integer not null default 0;

alter table public.orders
  add column if not exists source text not null default 'go_melanated',
  add column if not exists attribution_code text,
  add column if not exists analytics_session_key text;

alter table public.host_event_analytics_events
  drop constraint if exists host_event_analytics_events_event_name_check;

alter table public.host_event_analytics_events
  add constraint host_event_analytics_events_event_name_check check (event_name in (
    'promotion_impression','promotion_reach','promotion_view','promotion_click',
    'event_discovered','event_page_view','event_interested','event_going','event_not_going',
    'event_saved','event_unsaved','event_shared','invite_sent','invite_opened','calendar_added','host_followed',
    'search_impression','search_selected',
    'checkout_started','checkout_abandoned',
    'ticket_ordered','ticket_cancelled','ticket_refunded','attendee_checked_in',
    'waitlist_joined','waitlist_left','waitlist_offered','waitlist_converted',
    'review_submitted','photo_uploaded',
    'message_delivered','message_opened','message_clicked',
    'notification_sent','notification_delivered','notification_opened'
  ));

create unique index if not exists host_event_analytics_dedupe_idx
  on public.host_event_analytics_events(campaign_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists host_event_analytics_actor_idx
  on public.host_event_analytics_events(campaign_id, actor_profile_id, event_name)
  where actor_profile_id is not null;

create index if not exists host_event_analytics_session_idx
  on public.host_event_analytics_events(campaign_id, session_key, event_name)
  where session_key is not null;

create unique index if not exists host_event_ticket_sources_source_class_idx
  on public.host_event_ticket_sources(campaign_id, source, external_ticket_class_id)
  where external_ticket_class_id is not null;

create or replace function app_private.ensure_go_melanated_connection(target_campaign uuid, target_adventure uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result uuid;
begin
  insert into public.host_event_connections (
    campaign_id, provider, external_event_id, display_name, status, capabilities, last_synced_at
  ) values (
    target_campaign,
    'go_melanated',
    target_adventure::text,
    'Go Melanated',
    'connected',
    '{"first_party":true,"event_analytics":true,"ticketing":true,"rsvp":true,"waitlist":true,"checkin":true}'::jsonb,
    now()
  )
  on conflict (campaign_id, provider, external_event_id)
  do update set
    status = 'connected',
    last_synced_at = excluded.last_synced_at,
    capabilities = public.host_event_connections.capabilities || excluded.capabilities,
    updated_at = now()
  returning id into result;

  return result;
end;
$$;

revoke all on function app_private.ensure_go_melanated_connection(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.ensure_go_melanated_connection(uuid, uuid) to service_role;

create or replace function public.record_go_melanated_event(
  p_adventure_id uuid,
  p_event_name text,
  p_session_key text default null,
  p_surface text default 'unknown',
  p_attribution_code text default null,
  p_dedupe_key text default null,
  p_quantity integer default 1,
  p_value_cents integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_order_id uuid default null,
  p_ticket_type_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_actor uuid := auth.uid();
  v_internal boolean := false;
  v_id bigint;
begin
  if p_event_name not in (
    'event_discovered','event_page_view','event_shared','invite_sent','invite_opened','calendar_added','host_followed',
    'search_impression','search_selected','checkout_started','review_submitted','photo_uploaded',
    'notification_opened','message_opened','message_clicked'
  ) then
    raise exception 'Unsupported first-party analytics event';
  end if;

  if p_quantity < 1 or p_quantity > 10000 then
    raise exception 'Invalid analytics quantity';
  end if;

  if p_value_cents < 0 then
    raise exception 'Invalid analytics value';
  end if;

  select c.id into v_campaign_id
  from public.host_campaigns c
  where c.adventure_id = p_adventure_id
  limit 1;

  -- Adventures without a Host Center campaign should remain fully usable.
  if v_campaign_id is null then
    return null;
  end if;

  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, p_adventure_id);
  if v_actor is not null then
    v_internal := coalesce(app_private.can_access_host_campaign(v_campaign_id), false);
  end if;

  insert into public.host_event_analytics_events (
    campaign_id,
    connection_id,
    event_name,
    source,
    quantity,
    value_cents,
    actor_profile_id,
    session_key,
    surface,
    attribution_code,
    dedupe_key,
    is_internal,
    order_id,
    ticket_type_id,
    metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    p_event_name,
    'go_melanated',
    p_quantity,
    p_value_cents,
    v_actor,
    nullif(left(coalesce(p_session_key, ''), 120), ''),
    nullif(left(coalesce(p_surface, ''), 80), ''),
    nullif(left(coalesce(p_attribution_code, ''), 160), ''),
    nullif(left(coalesce(p_dedupe_key, ''), 240), ''),
    v_internal,
    p_order_id,
    p_ticket_type_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('first_party', true)
  )
  on conflict (campaign_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_go_melanated_event(uuid,text,text,text,text,text,integer,integer,jsonb,uuid,uuid) from public;
grant execute on function public.record_go_melanated_event(uuid,text,text,text,text,text,integer,integer,jsonb,uuid,uuid) to anon, authenticated, service_role;

create or replace function app_private.record_rsvp_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_event_name text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select c.id into v_campaign_id from public.host_campaigns c where c.adventure_id = new.adventure_id limit 1;
  if v_campaign_id is null then return new; end if;
  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, new.adventure_id);

  v_event_name := case new.status
    when 'interested' then 'event_interested'
    when 'going' then 'event_going'
    else 'event_not_going'
  end;

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface, dedupe_key, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    v_event_name,
    'go_melanated',
    new.profile_id,
    'event_detail',
    format('rsvp:%s:%s:%s', new.adventure_id, new.profile_id, v_event_name),
    jsonb_build_object('visibility', new.visibility, 'previous_status', case when tg_op = 'UPDATE' then old.status else null end)
  ) on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function app_private.record_rsvp_analytics() from public, anon, authenticated;

drop trigger if exists adventure_rsvp_analytics on public.adventure_rsvps;
create trigger adventure_rsvp_analytics
after insert or update of status on public.adventure_rsvps
for each row execute function app_private.record_rsvp_analytics();

create or replace function app_private.record_saved_adventure_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adventure_id uuid;
  v_profile_id uuid;
  v_campaign_id uuid;
  v_connection_id uuid;
  v_event_name text;
begin
  v_adventure_id := case when tg_op = 'DELETE' then old.adventure_id else new.adventure_id end;
  v_profile_id := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;
  v_event_name := case when tg_op = 'DELETE' then 'event_unsaved' else 'event_saved' end;

  select c.id into v_campaign_id from public.host_campaigns c where c.adventure_id = v_adventure_id limit 1;
  if v_campaign_id is null then return coalesce(new, old); end if;
  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, v_adventure_id);

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface, metadata
  ) values (
    v_campaign_id, v_connection_id, v_event_name, 'go_melanated', v_profile_id, 'event_detail', '{"first_party":true}'::jsonb
  );

  return coalesce(new, old);
end;
$$;

revoke all on function app_private.record_saved_adventure_analytics() from public, anon, authenticated;

drop trigger if exists saved_adventure_analytics on public.saved_adventures;
create trigger saved_adventure_analytics
after insert or delete on public.saved_adventures
for each row execute function app_private.record_saved_adventure_analytics();

create or replace function app_private.record_waitlist_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_event_name text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select c.id into v_campaign_id from public.host_campaigns c where c.adventure_id = new.adventure_id limit 1;
  if v_campaign_id is null then return new; end if;
  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, new.adventure_id);

  v_event_name := case new.status
    when 'waiting' then 'waitlist_joined'
    when 'offered' then 'waitlist_offered'
    when 'claimed' then 'waitlist_converted'
    else 'waitlist_left'
  end;

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface, dedupe_key, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    v_event_name,
    'go_melanated',
    new.profile_id,
    'waitlist',
    format('waitlist:%s:%s:%s:%s', new.id, v_event_name, coalesce(new.offered_at::text, ''), coalesce(new.updated_at::text, '')),
    jsonb_build_object('position', new.position, 'status', new.status)
  ) on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function app_private.record_waitlist_analytics() from public, anon, authenticated;

drop trigger if exists adventure_waitlist_analytics on public.adventure_waitlist;
create trigger adventure_waitlist_analytics
after insert or update of status on public.adventure_waitlist
for each row execute function app_private.record_waitlist_analytics();

create or replace function app_private.record_order_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_ticket_count integer := 0;
  v_ticket record;
  v_event_name text;
  v_dedupe text;
begin
  if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
    return new;
  end if;

  select c.id into v_campaign_id from public.host_campaigns c where c.adventure_id = new.adventure_id limit 1;
  if v_campaign_id is null then return new; end if;
  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, new.adventure_id);

  select count(*)::integer into v_ticket_count from public.order_attendees oa where oa.order_id = new.id;

  if new.status = 'paid'::public.order_status then
    v_event_name := 'ticket_ordered';
    v_dedupe := 'order-paid:' || new.id::text;
  elsif new.status = 'refunded'::public.order_status then
    v_event_name := 'ticket_refunded';
    v_dedupe := 'order-refunded:' || new.id::text;
  elsif new.status = 'cancelled'::public.order_status and old.status = 'paid'::public.order_status then
    v_event_name := 'ticket_cancelled';
    v_dedupe := 'order-cancelled:' || new.id::text;
  elsif new.status in ('cancelled'::public.order_status, 'expired'::public.order_status)
    and old.status in ('draft'::public.order_status, 'held'::public.order_status, 'payment_pending'::public.order_status) then
    v_event_name := 'checkout_abandoned';
    v_dedupe := 'checkout-abandoned:' || new.id::text;
  else
    return new;
  end if;

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, quantity, value_cents, actor_profile_id,
    session_key, surface, attribution_code, dedupe_key, order_id, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    v_event_name,
    'go_melanated',
    1,
    new.total_cents,
    new.purchaser_id,
    new.analytics_session_key,
    'checkout',
    new.attribution_code,
    v_dedupe,
    new.id,
    jsonb_build_object('ticket_count', v_ticket_count, 'order_status', new.status)
  ) on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  if new.status in ('paid'::public.order_status, 'refunded'::public.order_status)
     or (new.status = 'cancelled'::public.order_status and old.status = 'paid'::public.order_status) then
    for v_ticket in
      select
        tt.id as ticket_type_id,
        tt.name as ticket_name,
        tt.capacity as ticket_capacity,
        (select count(*)::integer from public.order_attendees oa where oa.order_id = new.id and oa.ticket_type_id = tt.id) as attendee_count,
        (select coalesce(sum(oi.line_total_cents),0)::integer from public.order_items oi where oi.order_id = new.id and oi.ticket_type_id = tt.id) as revenue_cents
      from public.ticket_types tt
      where exists (
        select 1 from public.order_items oi where oi.order_id = new.id and oi.ticket_type_id = tt.id
      )
    loop
      insert into public.host_event_ticket_sources (
        campaign_id, connection_id, source, external_ticket_class_id, label, capacity,
        sold, gross_revenue_cents, refunded_cents, refunded_tickets, cancelled_tickets,
        last_synced_at, metadata
      ) values (
        v_campaign_id,
        v_connection_id,
        'go_melanated',
        v_ticket.ticket_type_id::text,
        v_ticket.ticket_name,
        v_ticket.ticket_capacity,
        case when new.status = 'paid'::public.order_status then v_ticket.attendee_count else 0 end,
        case when new.status = 'paid'::public.order_status then v_ticket.revenue_cents else 0 end,
        case when new.status = 'refunded'::public.order_status then v_ticket.revenue_cents else 0 end,
        case when new.status = 'refunded'::public.order_status then v_ticket.attendee_count else 0 end,
        case when new.status = 'cancelled'::public.order_status then v_ticket.attendee_count else 0 end,
        now(),
        jsonb_build_object('first_party', true, 'ticket_type_id', v_ticket.ticket_type_id)
      )
      on conflict (campaign_id, source, external_ticket_class_id) where external_ticket_class_id is not null
      do update set
        connection_id = excluded.connection_id,
        label = excluded.label,
        capacity = excluded.capacity,
        sold = public.host_event_ticket_sources.sold + excluded.sold,
        gross_revenue_cents = public.host_event_ticket_sources.gross_revenue_cents + excluded.gross_revenue_cents,
        refunded_cents = public.host_event_ticket_sources.refunded_cents + excluded.refunded_cents,
        refunded_tickets = public.host_event_ticket_sources.refunded_tickets + excluded.refunded_tickets,
        cancelled_tickets = public.host_event_ticket_sources.cancelled_tickets + excluded.cancelled_tickets,
        last_synced_at = now(),
        updated_at = now();
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function app_private.record_order_analytics() from public, anon, authenticated;

drop trigger if exists order_event_analytics on public.orders;
create trigger order_event_analytics
after update of status on public.orders
for each row execute function app_private.record_order_analytics();

create or replace function app_private.record_checkin_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adventure_id uuid;
  v_campaign_id uuid;
  v_connection_id uuid;
  v_profile_id uuid;
  v_order_id uuid;
begin
  if old.checked_in_at is not null or new.checked_in_at is null then return new; end if;

  select o.adventure_id, o.id, oa.profile_id
    into v_adventure_id, v_order_id, v_profile_id
  from public.orders o
  join public.order_attendees oa on oa.id = new.attendee_id
  where o.id = new.order_id;

  select c.id into v_campaign_id from public.host_campaigns c where c.adventure_id = v_adventure_id limit 1;
  if v_campaign_id is null then return new; end if;
  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, v_adventure_id);

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface, dedupe_key, order_id, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    'attendee_checked_in',
    'go_melanated',
    v_profile_id,
    'checkin',
    'checkin:' || new.id::text,
    v_order_id,
    jsonb_build_object('credential_id', new.id, 'checked_in_at', new.checked_in_at)
  ) on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function app_private.record_checkin_analytics() from public, anon, authenticated;

drop trigger if exists ticket_checkin_analytics on public.ticket_credentials;
create trigger ticket_checkin_analytics
after update of checked_in_at on public.ticket_credentials
for each row execute function app_private.record_checkin_analytics();

create or replace function public.get_host_event_first_party_state(p_campaign_id uuid)
returns table (
  interested integer,
  going integer,
  saved integer,
  waitlist integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adventure_id uuid;
begin
  if not app_private.can_access_host_campaign(p_campaign_id) then
    raise exception 'Not authorized for this event';
  end if;

  select c.adventure_id into v_adventure_id from public.host_campaigns c where c.id = p_campaign_id;
  if v_adventure_id is null then raise exception 'Event campaign not found'; end if;

  return query select
    (select count(*)::integer from public.adventure_rsvps r where r.adventure_id = v_adventure_id and r.status = 'interested'),
    (select count(*)::integer from public.adventure_rsvps r where r.adventure_id = v_adventure_id and r.status = 'going'),
    (select count(*)::integer from public.saved_adventures s where s.adventure_id = v_adventure_id),
    (select count(*)::integer from public.adventure_waitlist w where w.adventure_id = v_adventure_id and w.status in ('waiting','offered'));
end;
$$;

revoke all on function public.get_host_event_first_party_state(uuid) from public, anon;
grant execute on function public.get_host_event_first_party_state(uuid) to authenticated, service_role;
