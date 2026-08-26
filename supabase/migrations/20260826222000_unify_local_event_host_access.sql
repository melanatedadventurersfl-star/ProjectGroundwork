create or replace function public.can_create_local_event()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        p.event_host_level in ('trusted_host', 'community_lead', 'staff')
        or public.is_approved_outing_host(auth.uid())
      )
  );
$$;

grant execute on function public.can_create_local_event() to authenticated;
