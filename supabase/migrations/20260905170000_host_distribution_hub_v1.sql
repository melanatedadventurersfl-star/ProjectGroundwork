-- Host Center distribution hub V1
-- Go Melanated is the native first-party destination. External providers attach through the same event connection model.

create or replace function app_private.ensure_go_melanated_event_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    new.id,
    'go_melanated',
    new.adventure_id::text,
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
    updated_at = now();
  return new;
end;
$$;

revoke all on function app_private.ensure_go_melanated_event_connection() from public, anon, authenticated;

drop trigger if exists host_campaign_native_distribution_connection on public.host_campaigns;
create trigger host_campaign_native_distribution_connection
after insert or update of adventure_id on public.host_campaigns
for each row execute function app_private.ensure_go_melanated_event_connection();

insert into public.host_event_connections(
  campaign_id,
  provider,
  external_event_id,
  display_name,
  status,
  capabilities,
  last_synced_at
)
select
  c.id,
  'go_melanated',
  c.adventure_id::text,
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
  now()
from public.host_campaigns c
where c.adventure_id is not null
on conflict (campaign_id, provider, external_event_id)
do update set
  display_name = excluded.display_name,
  status = 'connected',
  capabilities = excluded.capabilities,
  last_synced_at = now(),
  updated_at = now();

-- Prevent new duplicate active workspaces for the same member-facing event.
-- Existing duplicates are left untouched so no tasks or event history are silently discarded.
create or replace function app_private.prevent_duplicate_active_host_campaign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.host_campaigns c
    where c.adventure_id = new.adventure_id
      and c.status <> 'complete'
  ) then
    raise exception 'An active Host Center workspace already exists for this Go Melanated event.' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_duplicate_active_host_campaign() from public, anon, authenticated;

drop trigger if exists prevent_duplicate_active_host_campaign on public.host_campaigns;
create trigger prevent_duplicate_active_host_campaign
before insert on public.host_campaigns
for each row execute function app_private.prevent_duplicate_active_host_campaign();

-- Transactional first-party publisher. This creates the member-facing Go Melanated post,
-- records the destination promotion and marks the marketing item published as one operation.
create or replace function public.publish_host_marketing_to_go_melanated(p_item_id uuid)
returns table(post_id uuid, promotion_id uuid)
language plpgsql
security invoker
set search_path = public, app_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item public.host_campaign_marketing_items%rowtype;
  v_campaign public.host_campaigns%rowtype;
  v_connection_id uuid;
  v_post_id uuid;
  v_promotion_id uuid;
  v_existing_post_id uuid;
  v_body text;
  v_promotion_key text;
begin
  if v_user is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_item
  from public.host_campaign_marketing_items
  where id = p_item_id;

  if not found then
    raise exception 'Marketing item not found.' using errcode = 'P0002';
  end if;

  select * into v_campaign
  from public.host_campaigns
  where id = v_item.campaign_id;

  if not found or not app_private.can_manage_host_campaign(v_item.campaign_id) then
    raise exception 'You do not have permission to publish this event.' using errcode = '42501';
  end if;

  v_promotion_key := 'marketing:' || p_item_id::text || ':go_melanated';

  select
    p.id,
    nullif(p.metadata->>'community_post_id', '')::uuid
  into v_promotion_id, v_existing_post_id
  from public.host_event_promotions p
  where p.campaign_id = v_campaign.id
    and p.promotion_key = v_promotion_key
  limit 1;

  if v_existing_post_id is not null
     and exists(select 1 from public.community_posts cp where cp.id = v_existing_post_id) then
    update public.host_campaign_marketing_items
       set status = 'published',
           published_at = coalesce(published_at, now()),
           platforms = case
             when 'go_melanated' = any(coalesce(platforms, '{}'::text[])) then platforms
             else array_append(coalesce(platforms, '{}'::text[]), 'go_melanated')
           end,
           updated_by = v_user,
           updated_at = now()
     where id = p_item_id;

    return query select v_existing_post_id, v_promotion_id;
    return;
  end if;

  select id into v_connection_id
  from public.host_event_connections
  where campaign_id = v_campaign.id
    and provider = 'go_melanated'
    and external_event_id = v_campaign.adventure_id::text
  limit 1;

  if v_connection_id is null then
    insert into public.host_event_connections(
      campaign_id, provider, external_event_id, display_name, status, capabilities, last_synced_at
    ) values (
      v_campaign.id,
      'go_melanated',
      v_campaign.adventure_id::text,
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
      now()
    )
    returning id into v_connection_id;
  end if;

  v_body := left(coalesce(nullif(trim(v_item.copy_text), ''), nullif(trim(v_item.title), ''), 'Event update'), 4000);

  insert into public.community_posts(
    author_id,
    body,
    post_type,
    audience,
    adventure_id,
    metadata
  ) values (
    v_user,
    v_body,
    'update',
    'everyone',
    v_campaign.adventure_id,
    jsonb_build_object(
      'source', 'host_center',
      'provider', 'go_melanated',
      'campaign_id', v_campaign.id,
      'marketing_item_id', p_item_id,
      'promotion_key', v_promotion_key
    )
  ) returning id into v_post_id;

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
    v_promotion_key,
    'go_melanated',
    v_item.content_type,
    v_item.title,
    '/adventures/' || v_campaign.adventure_id::text,
    'gm:' || p_item_id::text,
    now(),
    'published',
    jsonb_build_object(
      'community_post_id', v_post_id,
      'adventure_id', v_campaign.adventure_id,
      'marketing_item_id', p_item_id
    )
  )
  on conflict (campaign_id, promotion_key)
  do update set
    connection_id = excluded.connection_id,
    channel = excluded.channel,
    content_type = excluded.content_type,
    title = excluded.title,
    destination_url = excluded.destination_url,
    tracking_code = excluded.tracking_code,
    published_at = excluded.published_at,
    status = 'published',
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_promotion_id;

  update public.host_campaign_marketing_items
     set status = 'published',
         published_at = now(),
         platforms = case
           when 'go_melanated' = any(coalesce(platforms, '{}'::text[])) then platforms
           else array_append(coalesce(platforms, '{}'::text[]), 'go_melanated')
         end,
         updated_by = v_user,
         updated_at = now()
   where id = p_item_id;

  return query select v_post_id, v_promotion_id;
end;
$$;

revoke all on function public.publish_host_marketing_to_go_melanated(uuid) from public, anon;
grant execute on function public.publish_host_marketing_to_go_melanated(uuid) to authenticated, service_role;
