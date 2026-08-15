revoke all on function public.dispatch_notification_push() from public, anon, authenticated;
revoke all on function public.register_device_push_token(text, text) from public, anon;
grant execute on function public.register_device_push_token(text, text) to authenticated;
