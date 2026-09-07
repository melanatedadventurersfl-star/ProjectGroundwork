-- Restrict Overwatch to the single private master account.
-- This deliberately ignores the optional profile argument so another account
-- cannot gain or probe Overwatch access through a founder/admin role.

create or replace function public.is_overwatch_owner(check_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select app_private.is_master_account();
$$;

revoke all on function public.is_overwatch_owner(uuid) from public, anon;
grant execute on function public.is_overwatch_owner(uuid) to authenticated, service_role;
