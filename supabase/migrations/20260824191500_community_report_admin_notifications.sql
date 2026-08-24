-- Notify platform admins whenever a new community post report is created.
-- Inserting into public.notifications automatically fans out to native push
-- through the existing notifications_native_push_webhook trigger.

create or replace function public.notify_admins_of_flagged_community_post()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  -- This alert is specifically for flagged posts. Comment reports continue to
  -- flow into the moderation queue without generating this post alert.
  if new.post_id is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    admin_profile.id,
    'community'::public.notification_kind,
    case
      when new.priority = 'high' then 'critical'::public.notification_priority
      else 'high'::public.notification_priority
    end,
    case
      when new.priority = 'high' then 'High-priority post flagged'
      else 'Community post flagged'
    end,
    'A community post was reported for "' || new.reason || '". Review the report in Moderation.',
    '/admin/moderation',
    'community-report-admin:' || new.id::text || ':' || admin_profile.id::text
  from (
    select p.id
    from public.profiles p
    where p.platform_role = 'admin'
      and p.status = 'active'

    union

    select m.profile_id as id
    from app_private.master_account m
    where m.singleton = true
  ) as admin_profile
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_admins_of_flagged_community_post() from public, anon, authenticated;
grant execute on function public.notify_admins_of_flagged_community_post() to service_role;

drop trigger if exists community_report_admin_notification on public.community_reports;
create trigger community_report_admin_notification
after insert on public.community_reports
for each row execute function public.notify_admins_of_flagged_community_post();
