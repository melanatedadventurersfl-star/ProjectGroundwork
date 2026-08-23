-- SECURITY DEFINER functions default to PUBLIC execute. Restrict community safety RPCs explicitly.

revoke all on function public.submit_community_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_community_report(text, uuid, text, text) to authenticated;

revoke all on function public.hide_community_content(text, uuid) from public, anon;
grant execute on function public.hide_community_content(text, uuid) to authenticated;

revoke all on function public.block_community_member(uuid) from public, anon;
grant execute on function public.block_community_member(uuid) to authenticated;

revoke all on function public.moderate_community_report(uuid, public.community_report_status, text, text) from public, anon;
grant execute on function public.moderate_community_report(uuid, public.community_report_status, text, text) to authenticated;
