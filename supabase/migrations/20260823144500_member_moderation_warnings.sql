create table if not exists public.community_member_warnings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.community_reports(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  message text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_member_warnings enable row level security;

create policy "Members read their own moderation warnings"
on public.community_member_warnings
for select
using (auth.uid() = member_id);

create policy "Platform admins manage moderation warnings"
on public.community_member_warnings
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create index if not exists community_member_warnings_member_created_idx
  on public.community_member_warnings(member_id, created_at desc);

create or replace function public.moderate_community_report(
  p_report_id uuid,
  p_status public.community_report_status,
  p_action text default 'none',
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_report public.community_reports%rowtype;
  v_target_member uuid;
  v_warning_message text := 'A recent post or comment was found to violate our Community Guidelines. Please review the guidelines before posting again.';
begin
  if v_admin is null or not public.is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Unsupported moderation status.' using errcode = '22023';
  end if;

  if p_action not in ('none', 'warning', 'remove_content') then
    raise exception 'Unsupported moderation action.' using errcode = '22023';
  end if;

  select * into v_report
  from public.community_reports
  where id = p_report_id
  for update;

  if v_report.id is null then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if v_report.comment_id is not null then
    select author_id into v_target_member
    from public.community_comments
    where id = v_report.comment_id;
  elsif v_report.post_id is not null then
    select author_id into v_target_member
    from public.community_posts
    where id = v_report.post_id;
  end if;

  if p_action = 'warning' then
    if p_status <> 'resolved' then
      raise exception 'Warnings must resolve the report.' using errcode = '22023';
    end if;

    if v_target_member is null then
      raise exception 'Unable to identify the member being warned.' using errcode = 'P0002';
    end if;

    insert into public.community_member_warnings (
      report_id,
      member_id,
      issued_by,
      reason,
      message
    ) values (
      v_report.id,
      v_target_member,
      v_admin,
      v_report.reason,
      v_warning_message
    )
    on conflict (report_id) do nothing;

    insert into public.notifications (
      recipient_id,
      kind,
      priority,
      title,
      body,
      action_url,
      dedupe_key
    ) values (
      v_target_member,
      'community',
      'high',
      'Community Guidelines warning',
      v_warning_message,
      '/community-guidelines',
      'moderation-warning:' || v_report.id::text
    )
    on conflict (recipient_id, dedupe_key) do nothing;
  end if;

  if p_action = 'remove_content' then
    if v_report.comment_id is not null then
      update public.community_comments
      set status = 'removed'
      where id = v_report.comment_id;
    elsif v_report.post_id is not null then
      update public.community_posts
      set status = 'removed'
      where id = v_report.post_id;
    end if;
  end if;

  update public.community_reports
  set status = p_status,
      reviewed_by = v_admin,
      reviewed_at = case when p_status in ('resolved', 'dismissed') then now() else reviewed_at end,
      action_taken = nullif(p_action, 'none'),
      resolution_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_report_id;
end;
$$;

revoke all on function public.moderate_community_report(uuid, public.community_report_status, text, text) from public, anon;
grant execute on function public.moderate_community_report(uuid, public.community_report_status, text, text) to authenticated;
