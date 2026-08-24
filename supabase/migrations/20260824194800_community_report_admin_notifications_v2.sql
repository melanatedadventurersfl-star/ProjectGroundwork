-- Ensure every new community report, whether a top-level post or a reply/comment,
-- creates an admin notification. The existing notifications push webhook then
-- handles native push delivery.

create or replace function public.notify_admins_of_community_report()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_target_label text;
begin
  v_target_label := case when new.comment_id is not null then 'reply' else 'post' end;

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
      when new.priority = 'high' then 'High-priority ' || v_target_label || ' flagged'
      else 'Community ' || v_target_label || ' flagged'
    end,
    'A community ' || v_target_label || ' was reported for "' || new.reason || '". Review the report in Moderation.',
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

revoke all on function public.notify_admins_of_community_report() from public, anon, authenticated;
grant execute on function public.notify_admins_of_community_report() to service_role;

drop trigger if exists community_report_admin_notification on public.community_reports;
create trigger community_report_admin_notification
after insert on public.community_reports
for each row execute function public.notify_admins_of_community_report();

-- Backfill unresolved reports created while the trigger was missing so the
-- moderation queue and admin notification center agree about outstanding work.
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
  case when r.priority = 'high' then 'critical'::public.notification_priority else 'high'::public.notification_priority end,
  case
    when r.priority = 'high' then 'High-priority ' || case when r.comment_id is not null then 'reply' else 'post' end || ' flagged'
    else 'Community ' || case when r.comment_id is not null then 'reply' else 'post' end || ' flagged'
  end,
  'A community ' || case when r.comment_id is not null then 'reply' else 'post' end || ' was reported for "' || r.reason || '". Review the report in Moderation.',
  '/admin/moderation',
  'community-report-admin:' || r.id::text || ':' || admin_profile.id::text
from public.community_reports r
cross join (
  select p.id
  from public.profiles p
  where p.platform_role = 'admin'
    and p.status = 'active'

  union

  select m.profile_id as id
  from app_private.master_account m
  where m.singleton = true
) as admin_profile
where r.status in ('open', 'reviewing')
on conflict (recipient_id, dedupe_key) do nothing;
