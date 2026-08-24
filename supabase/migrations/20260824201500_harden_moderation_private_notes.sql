-- Internal moderator and appeal decision notes are admin-only.
-- Member-facing moderation data is exposed only through security-definer RPCs
-- that deliberately omit private notes and reporter information.

drop policy if exists "Members read their moderation enforcement" on public.community_member_enforcements;
drop policy if exists "Members read their moderation appeals" on public.community_moderation_appeals;

create or replace function public.get_my_moderation_history()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'action_type', e.action_type,
      'reason', e.reason,
      'message', e.public_message,
      'starts_at', e.starts_at,
      'expires_at', e.expires_at,
      'active', e.active and (e.expires_at is null or e.expires_at > now()),
      'appeal_status', a.status
    ) order by e.created_at desc
  ), '[]'::jsonb)
  from public.community_member_enforcements e
  left join public.community_moderation_appeals a on a.enforcement_id = e.id
  where e.member_id = auth.uid();
$$;

revoke all on function public.get_my_moderation_history() from public, anon;
grant execute on function public.get_my_moderation_history() to authenticated, service_role;
