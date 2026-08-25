-- Prevent accidental removal of an active moderation restriction from the admin status editor.
-- Restoring Active now requires an explicit admin note whenever a restriction, suspension,
-- or permanent ban is currently in force.

create or replace function public.set_member_moderation_status(
  p_member_id uuid,
  p_status text,
  p_duration_hours integer default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_enforcement_id uuid;
  v_action text;
  v_reason text;
  v_message text;
  v_title text;
  v_expires timestamptz;
  v_priority public.notification_priority := 'high';
  v_has_active_restriction boolean;
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if p_status not in ('active','restricted','suspended','banned') then
    raise exception 'Unsupported member moderation status.' using errcode = '22023';
  end if;

  if not exists(select 1 from public.profiles where id = p_member_id) then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;

  if exists(select 1 from app_private.master_account m where m.profile_id = p_member_id)
     or exists(select 1 from public.profiles p where p.id = p_member_id and p.platform_role in ('admin','founder')) then
    raise exception 'Platform administrators require owner-level review and cannot be changed here.' using errcode = '42501';
  end if;

  select exists(
    select 1
    from public.community_member_enforcements e
    where e.member_id = p_member_id
      and e.active = true
      and e.action_type in ('posting_restriction','suspension','ban')
      and (e.expires_at is null or e.expires_at > now())
  ) into v_has_active_restriction;

  if p_status = 'active'
     and v_has_active_restriction
     and nullif(trim(coalesce(p_note,'')), '') is null then
    raise exception 'Add an admin note confirming why the active moderation restriction should be lifted.' using errcode = '22023';
  end if;

  if p_status = 'banned' and nullif(trim(coalesce(p_note,'')), '') is null then
    raise exception 'A permanent ban requires an internal moderator note.' using errcode = '22023';
  end if;

  update public.community_member_enforcements
     set active = false,
         revoked_at = now(),
         revoked_by = v_admin
   where member_id = p_member_id
     and active = true
     and action_type in ('posting_restriction','suspension','ban');

  if p_status = 'active' then
    perform public.refresh_member_moderation_status(p_member_id);
    insert into public.notifications(recipient_id, kind, priority, title, body, action_url, dedupe_key)
    values (
      p_member_id,
      'community',
      'normal',
      'Account restriction lifted',
      'An administrator restored your account to active status. Any formal warnings remain in your moderation history until they expire or are reversed.',
      '/account-status',
      'moderation-status-active:' || p_member_id::text || ':' || extract(epoch from now())::bigint::text
    );
    return null;
  end if;

  if p_status = 'restricted' then
    v_action := 'posting_restriction';
    v_reason := 'Administrative status change';
    v_message := 'Your ability to create or edit community posts and comments has been temporarily restricted.';
    v_title := 'Posting temporarily restricted';
    v_expires := now() + make_interval(hours => greatest(coalesce(p_duration_hours,24),1));
  elsif p_status = 'suspended' then
    v_action := 'suspension';
    v_reason := 'Administrative status change';
    v_message := 'Your Go Melanated account has been temporarily suspended. Open Account Status for details and appeal options.';
    v_title := 'Account temporarily suspended';
    v_expires := now() + make_interval(hours => greatest(coalesce(p_duration_hours,168),1));
    v_priority := 'critical';
  else
    v_action := 'ban';
    v_reason := 'Administrative status change';
    v_message := 'Your Go Melanated account has been permanently suspended. Open Account Status for details and appeal options.';
    v_title := 'Account permanently suspended';
    v_expires := null;
    v_priority := 'critical';
  end if;

  insert into public.community_member_enforcements(
    report_id,
    member_id,
    action_type,
    reason,
    public_message,
    internal_note,
    issued_by,
    starts_at,
    expires_at,
    active
  ) values (
    null,
    p_member_id,
    v_action,
    v_reason,
    v_message,
    nullif(trim(coalesce(p_note,'')), ''),
    v_admin,
    now(),
    v_expires,
    true
  ) returning id into v_enforcement_id;

  perform public.refresh_member_moderation_status(p_member_id);

  insert into public.notifications(recipient_id, kind, priority, title, body, action_url, dedupe_key)
  values (
    p_member_id,
    'community',
    v_priority,
    v_title,
    v_message,
    '/account-status',
    'moderation-status:' || v_enforcement_id::text
  ) on conflict (recipient_id, dedupe_key) do nothing;

  return v_enforcement_id;
end;
$$;

revoke all on function public.set_member_moderation_status(uuid,text,integer,text) from public, anon;
grant execute on function public.set_member_moderation_status(uuid,text,integer,text) to authenticated, service_role;
