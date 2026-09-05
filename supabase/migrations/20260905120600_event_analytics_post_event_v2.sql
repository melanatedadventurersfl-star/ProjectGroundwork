-- Event Analytics Pipeline V2: post-event engagement

create or replace function app_private.record_event_memory_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_internal boolean := false;
begin
  if new.adventure_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.rating is not distinct from new.rating then return new; end if;
  if new.rating is null then return new; end if;

  select c.id into v_campaign_id
  from public.host_campaigns c
  where c.adventure_id = new.adventure_id
  limit 1;
  if v_campaign_id is null then return new; end if;

  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, new.adventure_id);
  v_internal := coalesce(app_private.can_access_host_campaign(v_campaign_id), false);

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface,
    dedupe_key, is_internal, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    'review_submitted',
    'go_melanated',
    new.profile_id,
    'post_event',
    'review:' || new.id::text,
    v_internal,
    jsonb_build_object('rating', new.rating, 'memory_id', new.id)
  )
  on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function app_private.record_event_memory_analytics() from public, anon, authenticated;

drop trigger if exists adventure_memory_event_analytics on public.adventure_memories;
create trigger adventure_memory_event_analytics
after insert or update of rating on public.adventure_memories
for each row execute function app_private.record_event_memory_analytics();

create or replace function app_private.record_event_photo_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_connection_id uuid;
  v_internal boolean := false;
begin
  if new.adventure_id is null then return new; end if;

  select c.id into v_campaign_id
  from public.host_campaigns c
  where c.adventure_id = new.adventure_id
  limit 1;
  if v_campaign_id is null then return new; end if;

  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, new.adventure_id);
  if new.profile_id is not null then
    v_internal := coalesce(app_private.can_access_host_campaign(v_campaign_id), false);
  end if;

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface,
    dedupe_key, is_internal, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    'photo_uploaded',
    'go_melanated',
    new.profile_id,
    'post_event',
    'photo:' || new.id::text,
    v_internal,
    jsonb_build_object('photo_id', new.id, 'visibility', new.visibility, 'media_type', new.media_type)
  )
  on conflict (campaign_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function app_private.record_event_photo_analytics() from public, anon, authenticated;

drop trigger if exists adventure_photo_event_analytics on public.adventure_memory_photos;
create trigger adventure_photo_event_analytics
after insert on public.adventure_memory_photos
for each row execute function app_private.record_event_photo_analytics();
