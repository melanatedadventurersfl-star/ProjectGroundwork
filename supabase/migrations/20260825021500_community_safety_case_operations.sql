-- Community Safety 2.0 Phase B: case operations

alter table public.community_reports
  add column if not exists abuse_classification text,
  add column if not exists abuse_classified_by uuid references public.profiles(id) on delete set null,
  add column if not exists abuse_classified_at timestamptz;

alter table public.community_reports
  drop constraint if exists community_reports_abuse_classification_check;

alter table public.community_reports
  add constraint community_reports_abuse_classification_check
  check (abuse_classification is null or abuse_classification in ('none','abusive_report'));

alter table public.community_moderation_appeals
  add column if not exists modified_enforcement_id uuid references public.community_member_enforcements(id) on delete set null;

alter table public.community_moderation_appeals
  drop constraint if exists community_moderation_appeals_status_check;

alter table public.community_moderation_appeals
  add constraint community_moderation_appeals_status_check
  check (status in ('pending','upheld','modified','reversed'));

create or replace function public.classify_report_abuse(
  p_report_id uuid,
  p_abusive boolean,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.community_reports%rowtype;
  v_enforcement_id uuid;
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode='42501';
  end if;

  select * into v_report from public.community_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'Report not found.' using errcode='P0002';
  end if;

  if not p_abusive then
    update public.community_reports
       set abuse_classification = 'none', abuse_classified_by = v_admin, abuse_classified_at = now()
     where id = p_report_id;
    return null;
  end if;

  if nullif(trim(coalesce(p_note,'')), '') is null then
    raise exception 'Add an internal note explaining why this report is considered abusive.' using errcode='22023';
  end if;

  update public.community_reports
     set abuse_classification = 'abusive_report', abuse_classified_by = v_admin, abuse_classified_at = now()
   where id = p_report_id;

  insert into public.community_member_enforcements(
    report_id, member_id, action_type, reason, public_message, internal_note,
    issued_by, starts_at, expires_at, active
  ) values (
    p_report_id,
    v_report.reporter_id,
    'advisory',
    'Misuse of reporting tools',
    'A recent report was reviewed and found to misuse the Community reporting system. Please use reporting tools only for good-faith safety concerns.',
    trim(p_note),
    v_admin,
    now(),
    now(),
    false
  ) returning id into v_enforcement_id;

  insert into public.notifications(recipient_id, kind, priority, title, body, action_url, dedupe_key)
  values (
    v_report.reporter_id,
    'community',
    'normal',
    'Reporting reminder',
    'A recent report was found to misuse the Community reporting system. Open Account Standing for details and future reporting expectations.',
    '/account-status',
    'report-abuse-advisory:' || p_report_id::text
  ) on conflict (recipient_id, dedupe_key) do nothing;

  return v_enforcement_id;
end;
$$;

revoke all on function public.classify_report_abuse(uuid,boolean,text) from public, anon;
grant execute on function public.classify_report_abuse(uuid,boolean,text) to authenticated, service_role;

create or replace function public.decide_moderation_appeal(
  p_appeal_id uuid,
  p_decision text,
  p_note text default null,
  p_modified_action text default null,
  p_modified_duration_hours integer default null
)
returns void
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_appeal public.community_moderation_appeals%rowtype;
  v_original public.community_member_enforcements%rowtype;
  v_modified_id uuid;
  v_expires timestamptz;
  v_message text;
  v_reason text;
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode='42501';
  end if;
  if p_decision not in ('upheld','modified','reversed') then
    raise exception 'Unsupported appeal decision.' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_note,'')), '') is null then
    raise exception 'A decision note is required.' using errcode='22023';
  end if;

  select * into v_appeal from public.community_moderation_appeals where id=p_appeal_id for update;
  if v_appeal.id is null then raise exception 'Appeal not found.' using errcode='P0002'; end if;
  if v_appeal.status <> 'pending' then raise exception 'This appeal has already been decided.' using errcode='22023'; end if;

  select * into v_original from public.community_member_enforcements where id=v_appeal.enforcement_id for update;
  if v_original.id is null then raise exception 'Original enforcement not found.' using errcode='P0002'; end if;

  if p_decision = 'modified' then
    if p_modified_action not in ('warning','posting_restriction','suspension') then
      raise exception 'Choose a valid modified enforcement action.' using errcode='22023';
    end if;

    update public.community_member_enforcements
       set active=false, revoked_at=now(), revoked_by=v_admin
     where id=v_original.id;

    if p_modified_action='warning' then
      v_expires := now() + interval '90 days';
      v_message := 'Your appeal was partially approved. The original enforcement was changed to a formal warning.';
    elsif p_modified_action='posting_restriction' then
      v_expires := now() + make_interval(hours=>greatest(coalesce(p_modified_duration_hours,24),1));
      v_message := 'Your appeal was partially approved. The original enforcement was changed to a temporary posting restriction.';
    else
      v_expires := now() + make_interval(hours=>greatest(coalesce(p_modified_duration_hours,168),1));
      v_message := 'Your appeal was partially approved. The original enforcement was changed to a temporary suspension.';
    end if;

    v_reason := v_original.reason;
    insert into public.community_member_enforcements(
      report_id, member_id, action_type, reason, public_message, internal_note,
      issued_by, starts_at, expires_at, active
    ) values (
      v_original.report_id, v_original.member_id, p_modified_action, v_reason, v_message,
      trim(p_note), v_admin, now(), v_expires, true
    ) returning id into v_modified_id;

    update public.community_moderation_appeals
       set status='modified', decided_by=v_admin, decision_note=trim(p_note), decided_at=now(), modified_enforcement_id=v_modified_id
     where id=p_appeal_id;

    perform public.refresh_member_moderation_status(v_original.member_id);

    insert into public.notifications(recipient_id,kind,priority,title,body,action_url,dedupe_key)
    values(v_original.member_id,'community','high','Moderation decision modified',v_message,'/account-status','moderation-appeal-modified:'||v_appeal.id::text)
    on conflict(recipient_id,dedupe_key) do nothing;
    return;
  end if;

  update public.community_moderation_appeals
     set status=p_decision, decided_by=v_admin, decision_note=trim(p_note), decided_at=now()
   where id=p_appeal_id;

  if p_decision='reversed' then
    update public.community_member_enforcements set active=false,revoked_at=now(),revoked_by=v_admin where id=v_appeal.enforcement_id;
    perform public.refresh_member_moderation_status(v_appeal.member_id);
  end if;

  insert into public.notifications(recipient_id,kind,priority,title,body,action_url,dedupe_key)
  values(
    v_appeal.member_id,'community','high',
    case when p_decision='reversed' then 'Moderation appeal approved' else 'Moderation appeal reviewed' end,
    case when p_decision='reversed' then 'Your appeal was approved and the related enforcement has been reversed.' else 'Your appeal was reviewed and the original moderation decision was upheld.' end,
    '/account-status','moderation-appeal-decision:'||v_appeal.id::text
  ) on conflict(recipient_id,dedupe_key) do nothing;
end;
$$;

revoke all on function public.decide_moderation_appeal(uuid,text,text,text,integer) from public, anon;
grant execute on function public.decide_moderation_appeal(uuid,text,text,text,integer) to authenticated, service_role;
