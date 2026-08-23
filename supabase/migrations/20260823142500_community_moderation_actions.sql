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

  select * into v_report from public.community_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if p_action = 'remove_content' then
    if v_report.comment_id is not null then
      update public.community_comments set status = 'removed' where id = v_report.comment_id;
    elsif v_report.post_id is not null then
      update public.community_posts set status = 'removed' where id = v_report.post_id;
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

grant execute on function public.moderate_community_report(uuid, public.community_report_status, text, text) to authenticated;
