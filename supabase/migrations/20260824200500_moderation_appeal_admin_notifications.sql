-- Surface moderation appeals to administrators through the existing notification/push pipeline.

create or replace function public.notify_admins_of_moderation_appeal()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  insert into public.notifications (
    recipient_id, kind, priority, title, body, action_url, dedupe_key
  )
  select
    admin_profile.id,
    'community'::public.notification_kind,
    'high'::public.notification_priority,
    'Moderation appeal submitted',
    'A member appealed a moderation action. Review the appeal in Community Safety.',
    '/admin/moderation-appeals',
    'moderation-appeal-admin:' || new.id::text || ':' || admin_profile.id::text
  from (
    select p.id
    from public.profiles p
    where p.platform_role = 'admin' and p.status = 'active'
    union
    select m.profile_id from app_private.master_account m where m.singleton = true
  ) admin_profile
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_admins_of_moderation_appeal() from public, anon, authenticated;
grant execute on function public.notify_admins_of_moderation_appeal() to service_role;

drop trigger if exists moderation_appeal_admin_notification on public.community_moderation_appeals;
create trigger moderation_appeal_admin_notification
after insert on public.community_moderation_appeals
for each row execute function public.notify_admins_of_moderation_appeal();
