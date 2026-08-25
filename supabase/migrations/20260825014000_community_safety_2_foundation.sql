alter table public.community_member_enforcements
  drop constraint if exists community_member_enforcements_action_type_check;

alter table public.community_member_enforcements
  add constraint community_member_enforcements_action_type_check
  check (action_type in ('advisory','warning','posting_restriction','reporting_restriction','suspension','ban'));

create or replace function public.guard_community_warning_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_warnings integer;
begin
  if new.action_type <> 'warning' then return new; end if;
  select count(*) into v_active_warnings
  from public.community_member_enforcements e
  where e.member_id = new.member_id and e.action_type = 'warning'
    and e.active = true and e.expires_at > now();
  if v_active_warnings >= 2 then
    raise exception 'Escalation required. This member already has 2 active formal warnings. Choose a posting restriction, suspension, or permanent ban review instead of another warning.' using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_community_warning_escalation on public.community_member_enforcements;
create trigger guard_community_warning_escalation
before insert on public.community_member_enforcements
for each row execute function public.guard_community_warning_escalation();

create or replace function public.can_member_report_community(p_member_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_member_id is not null and not exists (
    select 1 from public.community_member_enforcements e
    where e.member_id = p_member_id and e.action_type = 'reporting_restriction'
      and e.active = true and (e.expires_at is null or e.expires_at > now())
  );
$$;
revoke all on function public.can_member_report_community(uuid) from public, anon;
grant execute on function public.can_member_report_community(uuid) to authenticated, service_role;

create or replace function public.set_member_reporting_restriction(p_member_id uuid,p_duration_hours integer default 168,p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare v_admin uuid:=auth.uid(); v_id uuid; v_expires timestamptz;
begin
  if v_admin is null or not public.is_platform_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_note,'')), '') is null then raise exception 'Add an internal note explaining why reporting access is being restricted.' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=p_member_id) then raise exception 'Member not found.' using errcode='P0002'; end if;
  if exists(select 1 from app_private.master_account m where m.profile_id=p_member_id)
     or exists(select 1 from public.profiles p where p.id=p_member_id and p.platform_role in ('admin','founder')) then raise exception 'Platform administrators require owner-level review.' using errcode='42501'; end if;
  update public.community_member_enforcements set active=false,revoked_at=now(),revoked_by=v_admin
    where member_id=p_member_id and action_type='reporting_restriction' and active=true;
  v_expires:=now()+make_interval(hours=>greatest(coalesce(p_duration_hours,168),1));
  insert into public.community_member_enforcements(report_id,member_id,action_type,reason,public_message,internal_note,issued_by,starts_at,expires_at,active)
  values(null,p_member_id,'reporting_restriction','Misuse of reporting tools','Your ability to submit community reports has been temporarily restricted because of confirmed misuse of the reporting system.',trim(p_note),v_admin,now(),v_expires,true)
  returning id into v_id;
  insert into public.notifications(recipient_id,kind,priority,title,body,action_url,dedupe_key)
  values(p_member_id,'community','high','Reporting temporarily restricted','Your ability to submit community reports has been temporarily restricted. Open Account Standing for details and appeal options.','/account-status','reporting-restriction:'||v_id::text)
  on conflict(recipient_id,dedupe_key) do nothing;
  return v_id;
end;
$$;
revoke all on function public.set_member_reporting_restriction(uuid,integer,text) from public, anon;
grant execute on function public.set_member_reporting_restriction(uuid,integer,text) to authenticated, service_role;

create or replace function public.submit_community_report(p_target_kind text,p_target_id uuid,p_reason text,p_details text default null)
returns table(report_id uuid,report_status public.community_report_status,created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_reporter uuid:=auth.uid(); v_author uuid; v_body text; v_created_at timestamptz; v_thread_post_id uuid; v_existing public.community_reports%rowtype; v_inserted public.community_reports%rowtype;
begin
  if v_reporter is null then raise exception 'You must be signed in to report content.' using errcode='42501'; end if;
  if not public.can_member_report_community(v_reporter) then raise exception 'Reporting is temporarily restricted on your account. Open Account Standing for details or appeal options.' using errcode='42501'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Choose a reason for this report.' using errcode='22023'; end if;
  if p_target_kind='post' then select p.author_id,p.body,p.created_at,p.id into v_author,v_body,v_created_at,v_thread_post_id from public.community_posts p where p.id=p_target_id;
  elsif p_target_kind='comment' then select c.author_id,c.body,c.created_at,c.post_id into v_author,v_body,v_created_at,v_thread_post_id from public.community_comments c where c.id=p_target_id;
  else raise exception 'Unsupported report target.' using errcode='22023'; end if;
  if v_author is null then raise exception 'This content is no longer available.' using errcode='P0002'; end if;
  if v_author=v_reporter then raise exception 'You cannot report your own content.' using errcode='22023'; end if;
  select r.* into v_existing from public.community_reports r where r.reporter_id=v_reporter and r.status in ('open','reviewing') and ((p_target_kind='post' and r.post_id=p_target_id) or (p_target_kind='comment' and r.comment_id=p_target_id)) order by r.created_at desc limit 1;
  if v_existing.id is not null then return query select v_existing.id,v_existing.status,false; return; end if;
  begin
    insert into public.community_reports(reporter_id,post_id,comment_id,reason,details,reported_author_id,thread_post_id,content_snapshot,content_created_at,priority)
    values(v_reporter,case when p_target_kind='post' then p_target_id else null end,case when p_target_kind='comment' then p_target_id else null end,trim(p_reason),nullif(trim(coalesce(p_details,'')),''),v_author,v_thread_post_id,v_body,v_created_at,case when lower(p_reason) similar to '%(threat|violence|hate|dangerous|harmful)%' then 'high' else 'normal' end)
    returning * into v_inserted;
  exception when unique_violation then
    select r.* into v_inserted from public.community_reports r where r.reporter_id=v_reporter and r.status in ('open','reviewing') and ((p_target_kind='post' and r.post_id=p_target_id) or (p_target_kind='comment' and r.comment_id=p_target_id)) order by r.created_at desc limit 1;
    return query select v_inserted.id,v_inserted.status,false; return;
  end;
  return query select v_inserted.id,v_inserted.status,true;
end;
$$;

create or replace function public.get_my_account_standing()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_member uuid:=auth.uid(); v_profile_status text; v_active_warning_count integer; v_twelve_month_violations integer; v_reporting_allowed boolean; v_primary record; v_decisions jsonb; v_appeals jsonb;
begin
  if v_member is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  perform public.refresh_member_moderation_status(v_member);
  select status::text into v_profile_status from public.profiles where id=v_member;
  select count(*) into v_active_warning_count from public.community_member_enforcements e where e.member_id=v_member and e.action_type='warning' and e.active=true and e.expires_at>now();
  select count(*) into v_twelve_month_violations from public.community_member_enforcements e where e.member_id=v_member and e.action_type in ('warning','posting_restriction','reporting_restriction','suspension','ban') and e.starts_at>=now()-interval '12 months' and e.revoked_at is null;
  v_reporting_allowed:=public.can_member_report_community(v_member);
  select e.id,e.action_type,e.reason,e.public_message,e.starts_at,e.expires_at into v_primary from public.community_member_enforcements e where e.member_id=v_member and e.active=true and e.action_type in ('posting_restriction','suspension','ban') and (e.expires_at is null or e.expires_at>now()) order by case e.action_type when 'ban' then 3 when 'suspension' then 2 else 1 end desc,e.starts_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'case_ref','CS-'||upper(substr(replace(e.id::text,'-',''),1,8)),'action_type',e.action_type,'reason',e.reason,'message',e.public_message,'starts_at',e.starts_at,'expires_at',e.expires_at,'active',e.active and (e.expires_at is null or e.expires_at>now()),'status',case when e.revoked_at is not null then 'reversed' when e.active and (e.expires_at is null or e.expires_at>now()) then 'active' else 'completed' end,'target_type',case when r.comment_id is not null then 'Reply' when r.post_id is not null then 'Post' else null end,'content_summary',case when r.content_snapshot is null then null when length(r.content_snapshot)>180 then left(r.content_snapshot,177)||'...' else r.content_snapshot end,'content_removed',coalesce(r.action_taken,'') like '%remove_content%','appeal_status',a.status,'appeal_id',a.id) order by e.starts_at desc),'[]'::jsonb) into v_decisions from public.community_member_enforcements e left join public.community_reports r on r.id=e.report_id left join public.community_moderation_appeals a on a.enforcement_id=e.id where e.member_id=v_member and e.action_type<>'advisory';
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'case_ref','AP-'||upper(substr(replace(a.id::text,'-',''),1,8)),'enforcement_id',a.enforcement_id,'action_type',e.action_type,'reason',e.reason,'appeal_reason',a.reason,'status',a.status,'submitted_at',a.created_at,'decided_at',a.decided_at,'decision_summary',case when a.status='reversed' then 'This decision was reversed and no longer counts toward your active standing.' when a.status='upheld' then 'The original moderation decision was upheld.' else null end) order by a.created_at desc),'[]'::jsonb) into v_appeals from public.community_moderation_appeals a join public.community_member_enforcements e on e.id=a.enforcement_id where a.member_id=v_member;
  return jsonb_build_object('profile_status',v_profile_status,'active_warning_count',v_active_warning_count,'warning_threshold',3,'twelve_month_violation_count',v_twelve_month_violations,'reporting_allowed',v_reporting_allowed,'primary_enforcement',case when v_primary.id is null then null else jsonb_build_object('id',v_primary.id,'case_ref','CS-'||upper(substr(replace(v_primary.id::text,'-',''),1,8)),'action_type',v_primary.action_type,'reason',v_primary.reason,'message',v_primary.public_message,'starts_at',v_primary.starts_at,'expires_at',v_primary.expires_at) end,'decisions',v_decisions,'appeals',v_appeals,'next_escalation',case when v_active_warning_count>=2 then 'Next confirmed ordinary violation requires restriction or suspension review.' when v_twelve_month_violations>=4 then 'Recent confirmed moderation history may result in stronger enforcement for another violation.' else 'No escalation threshold is currently active.' end);
end;
$$;
revoke all on function public.get_my_account_standing() from public, anon;
grant execute on function public.get_my_account_standing() to authenticated, service_role;

create or replace function public.get_admin_community_safety_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
  select jsonb_build_object('open_reports',(select count(*) from public.community_reports where status in ('open','reviewing')),'high_priority',(select count(*) from public.community_reports where status in ('open','reviewing') and priority='high'),'pending_appeals',(select count(*) from public.community_moderation_appeals where status='pending'),'restricted',(select count(distinct member_id) from public.community_member_enforcements where active=true and action_type='posting_restriction' and expires_at>now()),'reporting_restricted',(select count(distinct member_id) from public.community_member_enforcements where active=true and action_type='reporting_restriction' and expires_at>now()),'suspended',(select count(distinct member_id) from public.community_member_enforcements where active=true and action_type='suspension' and expires_at>now()),'banned',(select count(distinct member_id) from public.community_member_enforcements where active=true and action_type='ban'),'escalation_required',(select count(*) from (select member_id from public.community_member_enforcements where action_type='warning' and active=true and expires_at>now() group by member_id having count(*)>=2) x)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_admin_community_safety_dashboard() from public, anon;
grant execute on function public.get_admin_community_safety_dashboard() to authenticated, service_role;
