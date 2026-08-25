create or replace function public.get_backup_outbox_batch(max_rows integer default 100)
returns table (
  id bigint,
  event_type text,
  entity_type text,
  entity_id text,
  payload jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = backup, public, pg_temp
as $$
  select o.id, o.event_type, o.entity_type, o.entity_id, o.payload, o.created_at
  from backup.sync_outbox o
  where o.synced_at is null
  order by o.id
  limit greatest(1, least(coalesce(max_rows, 100), 500));
$$;

revoke all on function public.get_backup_outbox_batch(integer) from public, anon, authenticated;
grant execute on function public.get_backup_outbox_batch(integer) to service_role;

create or replace function public.mark_backup_outbox_synced(sync_ids bigint[])
returns void
language sql
security definer
set search_path = backup, public, pg_temp
as $$
  update backup.sync_outbox
  set synced_at = now(), sync_attempts = sync_attempts + 1, last_error = null
  where id = any(sync_ids);
$$;

revoke all on function public.mark_backup_outbox_synced(bigint[]) from public, anon, authenticated;
grant execute on function public.mark_backup_outbox_synced(bigint[]) to service_role;

create or replace function public.mark_backup_outbox_failed(sync_ids bigint[], error_message text)
returns void
language sql
security definer
set search_path = backup, public, pg_temp
as $$
  update backup.sync_outbox
  set sync_attempts = sync_attempts + 1, last_error = left(coalesce(error_message, 'Unknown error'), 1000)
  where id = any(sync_ids);
$$;

revoke all on function public.mark_backup_outbox_failed(bigint[], text) from public, anon, authenticated;
grant execute on function public.mark_backup_outbox_failed(bigint[], text) to service_role;
