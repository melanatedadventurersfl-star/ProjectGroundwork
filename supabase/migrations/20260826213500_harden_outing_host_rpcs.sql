revoke all on function public.is_approved_outing_host(uuid) from public, anon;
revoke all on function public.can_host_paid_outings(uuid) from public, anon;
revoke all on function public.publish_host_outing(uuid) from public, anon;
revoke all on function public.host_check_in_credential(text) from public, anon;

grant execute on function public.is_approved_outing_host(uuid) to authenticated;
grant execute on function public.can_host_paid_outings(uuid) to authenticated;
grant execute on function public.publish_host_outing(uuid) to authenticated;
grant execute on function public.host_check_in_credential(text) to authenticated;
