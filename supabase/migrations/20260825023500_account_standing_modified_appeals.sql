create or replace function public.get_my_account_standing()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid := auth.uid();
  v_profile_status text;
  v_active_warning_count integer;
  v_twelve_month_violations integer;
  v_reporting_allowed boolean;
  v_primary record;
  v_decisions jsonb;
  v_appeals jsonb;
begin
  if v_member is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  perform public.refresh_member_moderation_status(v_member);
  select status::text into v_profile_status from public.profiles where id=v_member;

  select count(*) into v_active_warning_count from public.community_member_enforcements e
  where e.member_id=v_member and e.action_type='warning' and e.active=true and e.expires_at>now();

  select count(*) into v_twelve_month_violations from public.community_member_enforcements e
  where e.member_id=v_member
    and e.action_type in ('warning','posting_restriction','reporting_restriction','suspension','ban')
    and e.starts_at >= now()-interval '12 months'
    and not exists (
      select 1 from public.community_moderation_appeals a
      where a.enforcement_id=e.id and a.status='reversed'
    );

  v_reporting_allowed := public.can_member_report_community(v_member);

  select e.id,e.action_type,e.reason,e.public_message,e.starts_at,e.expires_at
  into v_primary
  from public.community_member_enforcements e
  where e.member_id=v_member and e.active=true
    and e.action_type in ('posting_restriction','suspension','ban')
    and (e.expires_at is null or e.expires_at>now())
  order by case e.action_type when 'ban' then 3 when 'suspension' then 2 else 1 end desc,e.starts_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,
    'case_ref','CS-'||upper(substr(replace(e.id::text,'-',''),1,8)),
    'action_type',e.action_type,
    'reason',e.reason,
    'message',e.public_message,
    'starts_at',e.starts_at,
    'expires_at',e.expires_at,
    'active',e.active and (e.expires_at is null or e.expires_at>now()),
    'status',case
      when a.status='modified' then 'modified'
      when a.status='reversed' then 'reversed'
      when e.active and (e.expires_at is null or e.expires_at>now()) then 'active'
      else 'completed'
    end,
    'target_type',case when r.comment_id is not null then 'Reply' when r.post_id is not null then 'Post' else null end,
    'content_summary',case when r.content_snapshot is null then null when length(r.content_snapshot)>180 then left(r.content_snapshot,177)||'...' else r.content_snapshot end,
    'content_removed',coalesce(r.action_taken,'') like '%remove_content%',
    'appeal_status',a.status,
    'appeal_id',a.id
  ) order by e.starts_at desc),'[]'::jsonb)
  into v_decisions
  from public.community_member_enforcements e
  left join public.community_reports r on r.id=e.report_id
  left join public.community_moderation_appeals a on a.enforcement_id=e.id
  where e.member_id=v_member and e.action_type<>'advisory';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,
    'case_ref','AP-'||upper(substr(replace(a.id::text,'-',''),1,8)),
    'enforcement_id',a.enforcement_id,
    'action_type',e.action_type,
    'reason',e.reason,
    'appeal_reason',a.reason,
    'status',a.status,
    'submitted_at',a.created_at,
    'decided_at',a.decided_at,
    'modified_enforcement_id',a.modified_enforcement_id,
    'decision_summary',case
      when a.status='reversed' then 'This decision was reversed and no longer counts toward your active standing.'
      when a.status='modified' then 'The original decision was changed after review. Your Account Standing reflects the replacement action.'
      when a.status='upheld' then 'The original moderation decision was upheld.'
      else null end
  ) order by a.created_at desc),'[]'::jsonb)
  into v_appeals
  from public.community_moderation_appeals a
  join public.community_member_enforcements e on e.id=a.enforcement_id
  where a.member_id=v_member;

  return jsonb_build_object(
    'profile_status',v_profile_status,
    'active_warning_count',v_active_warning_count,
    'warning_threshold',3,
    'twelve_month_violation_count',v_twelve_month_violations,
    'reporting_allowed',v_reporting_allowed,
    'primary_enforcement',case when v_primary.id is null then null else jsonb_build_object(
      'id',v_primary.id,'case_ref','CS-'||upper(substr(replace(v_primary.id::text,'-',''),1,8)),
      'action_type',v_primary.action_type,'reason',v_primary.reason,'message',v_primary.public_message,
      'starts_at',v_primary.starts_at,'expires_at',v_primary.expires_at
    ) end,
    'decisions',v_decisions,
    'appeals',v_appeals,
    'next_escalation',case
      when v_active_warning_count>=2 then 'Next confirmed ordinary violation requires restriction or suspension review.'
      when v_twelve_month_violations>=4 then 'Recent confirmed moderation history may result in stronger enforcement for another violation.'
      else 'No escalation threshold is currently active.' end
  );
end;
$$;

revoke all on function public.get_my_account_standing() from public, anon;
grant execute on function public.get_my_account_standing() to authenticated, service_role;
