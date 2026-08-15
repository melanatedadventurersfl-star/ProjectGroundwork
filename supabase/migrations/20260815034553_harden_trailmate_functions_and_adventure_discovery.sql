create or replace function public.notify_trailmate_connection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_name text;
  addressee_name text;
begin
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), nullif(trim(first_name), ''), 'A member')
  into requester_name
  from public.profiles
  where id = new.requester_id;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), nullif(trim(first_name), ''), 'A member')
  into addressee_name
  from public.profiles
  where id = new.addressee_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (
      recipient_id, kind, priority, title, body, action_url, dedupe_key
    ) values (
      new.addressee_id,
      'community',
      'normal',
      'New Trailmate request',
      requester_name || ' wants to become a Trailmate.',
      '/community-profile/' || new.requester_id::text,
      'trailmate-request:' || new.id::text
    ) on conflict (recipient_id, dedupe_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'accepted' then
    insert into public.notifications (
      recipient_id, kind, priority, title, body, action_url, dedupe_key
    ) values (
      new.requester_id,
      'community',
      'normal',
      'Trailmate request accepted',
      addressee_name || ' is now your Trailmate.',
      '/community-profile/' || new.addressee_id::text,
      'trailmate-accepted:' || new.id::text
    ) on conflict (recipient_id, dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.notify_trailmate_connection_change() from public, anon, authenticated;

create or replace function public.cleanup_circle_membership_after_connection_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.community_circle_members cm
  using public.community_circles c
  where cm.circle_id = c.id
    and (
      (c.owner_id = old.requester_id and cm.profile_id = old.addressee_id)
      or (c.owner_id = old.addressee_id and cm.profile_id = old.requester_id)
    );
  return old;
end;
$$;

revoke execute on function public.cleanup_circle_membership_after_connection_delete() from public, anon, authenticated;

alter view public.adventure_discovery set (security_invoker = true);
