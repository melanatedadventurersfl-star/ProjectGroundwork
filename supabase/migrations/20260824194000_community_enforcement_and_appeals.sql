-- Policy-driven moderation enforcement: advisories, 90-day warnings,
-- posting restrictions, suspensions, permanent bans, and appeals.

create table if not exists public.community_member_enforcements (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.community_reports(id) on delete set null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('advisory','warning','posting_restriction','suspension','ban')),
  reason text not null,
  public_message text not null,
  internal_note text,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint permanent_ban_has_no_expiry check (action_type <> 'ban' or expires_at is null)
);

create index if not exists community_enforcements_member_created_idx
  on public.community_member_enforcements(member_id, created_at desc);
create index if not exists community_enforcements_member_active_idx
  on public.community_member_enforcements(member_id, active, expires_at);
create unique index if not exists community_enforcement_report_action_once
  on public.community_member_enforcements(report_id, action_type)
  where report_id is not null and active = true;

create table if not exists public.community_moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  enforcement_id uuid not null unique references public.community_member_enforcements(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','upheld','reversed')),
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_member_enforcements enable row level security;
alter table public.community_moderation_appeals enable row level security;

create policy "Members read their moderation enforcement"
on public.community_member_enforcements
for select
using (auth.uid() = member_id);

create policy "Platform admins manage moderation enforcement"
on public.community_member_enforcements
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "Members read their moderation appeals"
on public.community_moderation_appeals
for select
using (auth.uid() = member_id);

create policy "Platform admins manage moderation appeals"
on public.community_moderation_appeals
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.refresh_member_moderation_status(p_member_id uuid default auth.uid())
returns public.member_status
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_member uuid := p_member_id;
  v_status public.member_status;
  v_has_history boolean;
  v_has_ban boolean;
  v_has_suspension boolean;
  v_has_restriction boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_member <> auth.uid() and not public.is_platform_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  update public.community_member_enforcements
     set active = false
   where member_id = v_member
     and active = true
     and expires_at is not null
     and expires_at <= now();

  select exists(select 1 from public.community_member_enforcements where member_id = v_member)
    into v_has_history;

  select exists(
    select 1 from public.community_member_enforcements
    where member_id = v_member and active = true and action_type = 'ban'
  ) into v_has_ban;

  select exists(
    select 1 from public.community_member_enforcements
    where member_id = v_member and active = true and action_type = 'suspension'
      and (expires_at is null or expires_at > now())
  ) into v_has_suspension;

  select exists(
    select 1 from public.community_member_enforcements
    where member_id = v_member and active = true and action_type = 'posting_restriction'
      and (expires_at is null or expires_at > now())
  ) into v_has_restriction;

  if v_has_ban or v_has_suspension then
    update public.profiles set status = 'suspended' where id = v_member and status <> 'suspended';
  elsif v_has_restriction then
    update public.profiles set status = 'restricted' where id = v_member and status <> 'restricted';
  elsif v_has_history then
    update public.profiles set status = 'active' where id = v_member and status in ('restricted','suspended');
  end if;

  select status into v_status from public.profiles where id = v_member;
  return v_status;
end;
$$;

revoke all on function public.refresh_member_moderation_status(uuid) from public, anon;
grant execute on function public.refresh_member_moderation_status(uuid) to authenticated, service_role;

create or replace function public.can_member_post_community(p_member_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_member_id = auth.uid()
     and exists (
       select 1 from public.profiles p
       where p.id = p_member_id and p.status in ('active','restricted')
     )
     and not exists (
       select 1 from public.community_member_enforcements e
       where e.member_id = p_member_id
         and e.active = true
         and e.action_type in ('posting_restriction','suspension','ban')
         and (e.expires_at is null or e.expires_at > now())
     );
$$;

revoke all on function public.can_member_post_community(uuid) from public, anon;
grant execute on function public.can_member_post_community(uuid) to authenticated, service_role;

-- Harden community write policies so a posting restriction is enforced by the database.
drop policy if exists "Members create their own posts" on public.community_posts;
drop policy if exists "Members create permitted community posts" on public.community_posts;
create policy "Members create permitted community posts"
on public.community_posts for insert to authenticated
with check (
  auth.uid() = author_id
  and public.can_member_post_community(auth.uid())
  and (
    audience in ('everyone','connections')
    or (audience = 'circle' and exists (
      select 1 from public.community_circles c
      where c.id = community_posts.circle_id and c.owner_id = auth.uid()
    ))
    or (audience = 'group' and exists (
      select 1 from public.community_group_members gm
      where gm.group_id = community_posts.group_id and gm.profile_id = auth.uid()
    ))
  )
);

drop policy if exists "Authors edit their own posts" on public.community_posts;
create policy "Authors edit their own posts"
on public.community_posts for update to authenticated
using (auth.uid() = author_id and public.can_member_post_community(auth.uid()))
with check (auth.uid() = author_id and public.can_member_post_community(auth.uid()));

drop policy if exists "Members create their own comments" on public.community_comments;
create policy "Members create their own comments"
on public.community_comments for insert to authenticated
with check (auth.uid() = author_id and public.can_member_post_community(auth.uid()));

drop policy if exists "Authors edit their own comments" on public.community_comments;
create policy "Authors edit their own comments"
on public.community_comments for update to authenticated
using (auth.uid() = author_id and public.can_member_post_community(auth.uid()))
with check (auth.uid() = author_id and public.can_member_post_community(auth.uid()));

create or replace function public.enforce_community_report(
  p_report_id uuid,
  p_action text,
  p_duration_hours integer default null,
  p_remove_content boolean default false,
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
  v_member uuid;
  v_enforcement_id uuid;
  v_expires timestamptz;
  v_public_message text;
  v_title text;
  v_priority public.notification_priority := 'high';
  v_active_warning_count integer;
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if p_action not in ('advisory','warning','posting_restriction','suspension','ban') then
    raise exception 'Unsupported enforcement action.' using errcode = '22023';
  end if;

  select * into v_report from public.community_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  v_member := v_report.reported_author_id;
  if v_member is null then
    if v_report.comment_id is not null then
      select author_id into v_member from public.community_comments where id = v_report.comment_id;
    elsif v_report.post_id is not null then
      select author_id into v_member from public.community_posts where id = v_report.post_id;
    end if;
  end if;

  if v_member is null then
    raise exception 'Unable to identify the reported member.' using errcode = 'P0002';
  end if;

  if exists(select 1 from app_private.master_account m where m.profile_id = v_member)
     or exists(select 1 from public.profiles p where p.id = v_member and p.platform_role = 'admin') then
    raise exception 'Platform administrators require owner-level review and cannot be sanctioned from the standard moderation queue.' using errcode = '42501';
  end if;

  if p_action = 'warning' then
    v_expires := now() + interval '90 days';
    v_title := 'Community Guidelines warning';
    v_public_message := 'A recent post or comment was found to violate our Community Guidelines. This formal warning remains active for 90 days.';
  elsif p_action = 'advisory' then
    v_expires := now();
    v_title := 'Community Guidelines reminder';
    v_public_message := 'Please review our Community Guidelines before participating again. This reminder is not a formal warning.';
    v_priority := 'normal';
  elsif p_action = 'posting_restriction' then
    v_expires := now() + make_interval(hours => greatest(coalesce(p_duration_hours, 24), 1));
    v_title := 'Posting temporarily restricted';
    v_public_message := 'Your ability to create or edit community posts and comments has been temporarily restricted.';
  elsif p_action = 'suspension' then
    v_expires := now() + make_interval(hours => greatest(coalesce(p_duration_hours, 168), 1));
    v_title := 'Account temporarily suspended';
    v_public_message := 'Your Go Melanated account has been temporarily suspended. Open Account Status for details and appeal options.';
    v_priority := 'critical';
  else
    if nullif(trim(coalesce(p_note, '')), '') is null then
      raise exception 'A permanent ban requires an internal moderator note.' using errcode = '22023';
    end if;
    v_expires := null;
    v_title := 'Account permanently suspended';
    v_public_message := 'Your Go Melanated account has been permanently suspended for a Community Guidelines violation. Open Account Status for details and appeal options.';
    v_priority := 'critical';
  end if;

  insert into public.community_member_enforcements (
    report_id, member_id, action_type, reason, public_message, internal_note,
    issued_by, starts_at, expires_at, active
  ) values (
    v_report.id, v_member, p_action, v_report.reason, v_public_message,
    nullif(trim(coalesce(p_note, '')), ''), v_admin, now(), v_expires,
    p_action <> 'advisory'
  )
  returning id into v_enforcement_id;

  if p_action = 'posting_restriction' then
    update public.profiles set status = 'restricted' where id = v_member;
  elsif p_action in ('suspension','ban') then
    update public.profiles set status = 'suspended' where id = v_member;
  end if;

  if p_remove_content then
    if v_report.comment_id is not null then
      update public.community_comments set status = 'removed' where id = v_report.comment_id;
    elsif v_report.post_id is not null then
      update public.community_posts set status = 'removed' where id = v_report.post_id;
    end if;
  end if;

  update public.community_reports
     set status = 'resolved',
         reviewed_by = v_admin,
         reviewed_at = now(),
         action_taken = p_action || case when p_remove_content then '+remove_content' else '' end,
         resolution_note = nullif(trim(coalesce(p_note, '')), '')
   where id = v_report.id;

  select count(*) into v_active_warning_count
  from public.community_member_enforcements
  where member_id = v_member and action_type = 'warning' and active = true
    and expires_at > now();

  insert into public.notifications (
    recipient_id, kind, priority, title, body, action_url, dedupe_key
  ) values (
    v_member,
    'community',
    v_priority,
    v_title,
    case when p_action = 'warning'
      then v_public_message || ' Active warnings: ' || v_active_warning_count::text || '.'
      else v_public_message
    end,
    case when p_action in ('posting_restriction','suspension','ban') then '/account-status' else '/community-guidelines' end,
    'community-enforcement:' || v_enforcement_id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return v_enforcement_id;
end;
$$;

revoke all on function public.enforce_community_report(uuid, text, integer, boolean, text) from public, anon;
grant execute on function public.enforce_community_report(uuid, text, integer, boolean, text) to authenticated, service_role;

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
  v_warning_count integer;
  v_appeal_status text;
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
  where e.member_id = v_member and e.action_type = 'warning' and e.active = true and e.expires_at > now();

  if v_enforcement.id is not null then
    select a.status into v_appeal_status
    from public.community_moderation_appeals a
    where a.enforcement_id = v_enforcement.id;
  end if;

  return jsonb_build_object(
    'profile_status', v_profile_status,
    'active_warning_count', v_warning_count,
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

create or replace function public.submit_moderation_appeal(p_enforcement_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid := auth.uid();
  v_appeal_id uuid;
begin
  if v_member is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Tell us why you are appealing this decision.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.community_member_enforcements e
    where e.id = p_enforcement_id and e.member_id = v_member
      and e.action_type in ('warning','posting_restriction','suspension','ban')
  ) then
    raise exception 'This enforcement is not eligible for appeal.' using errcode = '42501';
  end if;

  insert into public.community_moderation_appeals(enforcement_id, member_id, reason)
  values (p_enforcement_id, v_member, trim(p_reason))
  returning id into v_appeal_id;

  return v_appeal_id;
exception when unique_violation then
  raise exception 'An appeal has already been submitted for this action.' using errcode = '23505';
end;
$$;

revoke all on function public.submit_moderation_appeal(uuid, text) from public, anon;
grant execute on function public.submit_moderation_appeal(uuid, text) to authenticated, service_role;

create or replace function public.decide_moderation_appeal(
  p_appeal_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_appeal public.community_moderation_appeals%rowtype;
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if p_decision not in ('upheld','reversed') then
    raise exception 'Unsupported appeal decision.' using errcode = '22023';
  end if;

  select * into v_appeal from public.community_moderation_appeals where id = p_appeal_id for update;
  if v_appeal.id is null then raise exception 'Appeal not found.' using errcode = 'P0002'; end if;
  if v_appeal.status <> 'pending' then raise exception 'This appeal has already been decided.' using errcode = '22023'; end if;

  update public.community_moderation_appeals
     set status = p_decision, decided_by = v_admin, decision_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = now()
   where id = p_appeal_id;

  if p_decision = 'reversed' then
    update public.community_member_enforcements
       set active = false, revoked_at = now(), revoked_by = v_admin
     where id = v_appeal.enforcement_id;
    perform public.refresh_member_moderation_status(v_appeal.member_id);
  end if;

  insert into public.notifications(recipient_id, kind, priority, title, body, action_url, dedupe_key)
  values (
    v_appeal.member_id,
    'community',
    'high',
    case when p_decision = 'reversed' then 'Moderation appeal approved' else 'Moderation appeal reviewed' end,
    case when p_decision = 'reversed'
      then 'Your appeal was approved and the related enforcement has been reversed.'
      else 'Your appeal was reviewed and the original moderation decision was upheld.'
    end,
    '/account-status',
    'moderation-appeal-decision:' || v_appeal.id::text
  ) on conflict (recipient_id, dedupe_key) do nothing;
end;
$$;

revoke all on function public.decide_moderation_appeal(uuid, text, text) from public, anon;
grant execute on function public.decide_moderation_appeal(uuid, text, text) to authenticated, service_role;
