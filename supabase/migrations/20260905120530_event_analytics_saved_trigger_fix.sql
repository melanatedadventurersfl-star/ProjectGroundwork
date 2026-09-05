-- Keep saved-adventure analytics trigger return paths explicit for INSERT and DELETE.

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

  select c.id into v_campaign_id
  from public.host_campaigns c
  where c.adventure_id = v_adventure_id
  limit 1;

  if v_campaign_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_connection_id := app_private.ensure_go_melanated_connection(v_campaign_id, v_adventure_id);

  insert into public.host_event_analytics_events (
    campaign_id, connection_id, event_name, source, actor_profile_id, surface, metadata
  ) values (
    v_campaign_id,
    v_connection_id,
    v_event_name,
    'go_melanated',
    v_profile_id,
    'event_detail',
    '{"first_party":true}'::jsonb
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function app_private.record_saved_adventure_analytics() from public, anon, authenticated;
