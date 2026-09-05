-- Event Analytics Pipeline V2: RPC hardening
-- Keep the broad event writer signed-in only and expose one narrow anonymous page-view writer.

revoke execute on function public.record_go_melanated_event(uuid,text,text,text,text,text,integer,integer,jsonb,uuid,uuid) from anon;
grant execute on function public.record_go_melanated_event(uuid,text,text,text,text,text,integer,integer,jsonb,uuid,uuid) to authenticated, service_role;

create or replace function public.record_go_melanated_page_view(
  p_adventure_id uuid,
  p_session_key text,
  p_surface text default 'event_detail',
  p_attribution_code text default null,
  p_dedupe_key text default null
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
  if p_adventure_id is null then
    raise exception 'Adventure is required';
  end if;

  if nullif(trim(coalesce(p_session_key, '')), '') is null then
    raise exception 'Analytics session is required';
  end if;

  select c.id into v_campaign_id
  from public.host_campaigns c
  join public.adventures a on a.id = c.adventure_id
  where c.adventure_id = p_adventure_id
    and a.status in ('published', 'sold_out', 'cancelled', 'completed')
  limit 1;

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
    metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    'event_page_view',
    'go_melanated',
    1,
    0,
    v_actor,
    left(trim(p_session_key), 120),
    coalesce(nullif(left(trim(coalesce(p_surface, '')), 80), ''), 'event_detail'),
    nullif(left(trim(coalesce(p_attribution_code, '')), 160), ''),
    nullif(left(trim(coalesce(p_dedupe_key, '')), 240), ''),
    v_internal,
    '{"first_party":true,"anonymous_safe":true}'::jsonb
  )
  on conflict (campaign_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_go_melanated_page_view(uuid,text,text,text,text) from public;
grant execute on function public.record_go_melanated_page_view(uuid,text,text,text,text) to anon, authenticated, service_role;
