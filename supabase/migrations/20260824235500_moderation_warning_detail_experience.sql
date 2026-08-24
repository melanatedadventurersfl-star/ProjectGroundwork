-- Make formal warnings actionable and specific instead of routing members to the
-- generic Community Guidelines page. Legacy warnings are folded into the new
-- enforcement history so older warnings get the same detail experience.

insert into public.community_member_enforcements (
  report_id, member_id, action_type, reason, public_message, internal_note,
  issued_by, starts_at, expires_at, active, created_at
)
select
  w.report_id,
  w.member_id,
  'warning',
  w.reason,
  w.message,
  null,
  w.issued_by,
  w.created_at,
  w.created_at + interval '90 days',
  (w.created_at + interval '90 days') > now(),
  w.created_at
from public.community_member_warnings w
where not exists (
  select 1 from public.community_member_enforcements e
  where e.report_id = w.report_id and e.action_type = 'warning'
);

create or replace function public.get_my_moderation_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid := auth.uid();
  v_profile_status public.member_status;
  v_enforcement record;
  v_latest_warning record;
  v_warning_count integer;
  v_appeal_status text;
  v_warning_appeal_status text;
begin
  if v_member is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform public.refresh_member_moderation_status(v_member);
  select status into v_profile_status from public.profiles where id = v_member;

  select e.id, e.action_type, e.reason, e.public_message, e.starts_at, e.expires_at
    into v_enforcement
  from public.community_member_enforcements e
  where e.member_id = v_member
    and e.active = true
    and e.action_type in ('posting_restriction','suspension','ban')
    and (e.expires_at is null or e.expires_at > now())
  order by case e.action_type when 'ban' then 3 when 'suspension' then 2 else 1 end desc, e.created_at desc
  limit 1;

  select count(*) into v_warning_count
  from public.community_member_enforcements e
  where e.member_id = v_member
    and e.action_type = 'warning'
    and e.active = true
    and e.expires_at > now();

  select
    e.id, e.reason, e.public_message, e.starts_at, e.expires_at, e.active,
    r.post_id, r.comment_id, r.content_snapshot, r.action_taken
  into v_latest_warning
  from public.community_member_enforcements e
  left join public.community_reports r on r.id = e.report_id
  where e.member_id = v_member and e.action_type = 'warning'
  order by e.starts_at desc
  limit 1;

  if v_enforcement.id is not null then
    select a.status into v_appeal_status
    from public.community_moderation_appeals a
    where a.enforcement_id = v_enforcement.id;
  end if;

  if v_latest_warning.id is not null then
    select a.status into v_warning_appeal_status
    from public.community_moderation_appeals a
    where a.enforcement_id = v_latest_warning.id;
  end if;

  return jsonb_build_object(
    'profile_status', v_profile_status,
    'active_warning_count', v_warning_count,
    'warning_threshold', 3,
    'latest_warning', case when v_latest_warning.id is null then null else jsonb_build_object(
      'id', v_latest_warning.id,
      'reason', v_latest_warning.reason,
      'message', v_latest_warning.public_message,
      'starts_at', v_latest_warning.starts_at,
      'expires_at', v_latest_warning.expires_at,
      'status', case when v_latest_warning.active and v_latest_warning.expires_at > now() then 'active' else 'expired' end,
      'warning_number', greatest(v_warning_count, 1),
      'target_type', case when v_latest_warning.comment_id is not null then 'Reply' else 'Post' end,
      'content_snapshot', v_latest_warning.content_snapshot,
      'content_removed', coalesce(v_latest_warning.action_taken, '') like '%remove_content%',
      'appeal_status', v_warning_appeal_status
    ) end,
    'enforcement', case when v_enforcement.id is null then null else jsonb_build_object(
      'id', v_enforcement.id,
      'action_type', v_enforcement.action_type,
      'reason', v_enforcement.reason,
      'message', v_enforcement.public_message,
      'starts_at', v_enforcement.starts_at,
      'expires_at', v_enforcement.expires_at,
      'appeal_status', v_appeal_status
    ) end
  );
end;
$$;

revoke all on function public.get_my_moderation_status() from public, anon;
grant execute on function public.get_my_moderation_status() to authenticated, service_role;

create or replace function public.enrich_moderation_warning_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enforcement public.community_member_enforcements%rowtype;
  v_report public.community_reports%rowtype;
  v_warning_count integer;
  v_enforcement_id uuid;
  v_report_id uuid;
  v_target text;
  v_snapshot text;
begin
  if new.title <> 'Community Guidelines warning' then return new; end if;

  if new.dedupe_key like 'community-enforcement:%' then
    begin v_enforcement_id := split_part(new.dedupe_key, ':', 2)::uuid; exception when others then v_enforcement_id := null; end;
    if v_enforcement_id is not null then
      select * into v_enforcement from public.community_member_enforcements where id = v_enforcement_id;
      v_report_id := v_enforcement.report_id;
    end if;
  elsif new.dedupe_key like 'moderation-warning:%' then
    begin v_report_id := split_part(new.dedupe_key, ':', 2)::uuid; exception when others then v_report_id := null; end;
    if v_report_id is not null then
      select * into v_enforcement from public.community_member_enforcements
      where report_id = v_report_id and member_id = new.recipient_id and action_type = 'warning'
      order by created_at desc limit 1;
    end if;
  end if;

  if v_report_id is not null then select * into v_report from public.community_reports where id = v_report_id; end if;

  select count(*) into v_warning_count from public.community_member_enforcements e
  where e.member_id = new.recipient_id and e.action_type = 'warning'
    and e.active = true and e.expires_at > now();

  v_target := case when v_report.comment_id is not null then 'Reply' else 'Post' end;
  v_snapshot := nullif(trim(coalesce(v_report.content_snapshot, '')), '');

  new.action_url := '/account-status';
  new.body := 'Formal warning ' || greatest(v_warning_count, 1)::text || ' of 3. Reason: '
    || coalesce(v_enforcement.reason, v_report.reason, 'Community Guidelines violation') || '. '
    || v_target || case when v_snapshot is not null then ': “' || left(v_snapshot, 90) || case when length(v_snapshot) > 90 then '…' else '' end || '”. ' else '. ' end
    || 'Status: active for 90 days.';
  return new;
end;
$$;

drop trigger if exists enrich_moderation_warning_notification_before_insert on public.notifications;
create trigger enrich_moderation_warning_notification_before_insert
before insert on public.notifications
for each row execute function public.enrich_moderation_warning_notification();

update public.notifications n
set action_url = '/account-status',
    body = 'Formal warning ' || greatest((
      select count(*) from public.community_member_enforcements e2
      where e2.member_id = n.recipient_id and e2.action_type = 'warning'
        and e2.active = true and e2.expires_at > now()
    ), 1)::text || ' of 3. Reason: ' || coalesce(e.reason, r.reason, 'Community Guidelines violation') || '. '
      || case when r.comment_id is not null then 'Reply' else 'Post' end
      || case when nullif(trim(coalesce(r.content_snapshot, '')), '') is not null then ': “' || left(r.content_snapshot, 90) || case when length(r.content_snapshot) > 90 then '…' else '' end || '”. ' else '. ' end
      || 'Status: active for 90 days.'
from public.community_member_enforcements e
left join public.community_reports r on r.id = e.report_id
where n.recipient_id = e.member_id
  and e.action_type = 'warning'
  and (
    n.dedupe_key = 'community-enforcement:' || e.id::text
    or n.dedupe_key = 'moderation-warning:' || e.report_id::text
  );
