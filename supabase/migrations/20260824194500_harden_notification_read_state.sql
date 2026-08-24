-- Make notification read state authoritative, idempotent, and tied to the signed-in recipient.
-- These RPCs are SECURITY DEFINER so member notification updates do not depend on
-- future changes to client-facing UPDATE policies.

create or replace function public.mark_notification_read(notification_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = notification_uuid
    and recipient_id = v_profile_id;

  if not found then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = v_profile_id
    and archived_at is null
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;
