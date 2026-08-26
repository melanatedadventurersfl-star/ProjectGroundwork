create or replace function public.transition_host_outing(
  p_adventure_id uuid,
  p_status public.adventure_status
)
returns public.adventures
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.adventures;
  current_status public.adventure_status;
begin
  if not public.is_approved_outing_host(auth.uid()) then
    raise exception 'Approved host access required';
  end if;

  if p_status not in ('cancelled'::public.adventure_status, 'completed'::public.adventure_status) then
    raise exception 'Unsupported outing transition';
  end if;

  select status into current_status
  from public.adventures
  where id = p_adventure_id and created_by = auth.uid();

  if current_status is null then
    raise exception 'Outing not found';
  end if;

  if current_status in ('cancelled'::public.adventure_status, 'completed'::public.adventure_status) then
    raise exception 'Outing is already closed';
  end if;

  if p_status = 'completed'::public.adventure_status
     and current_status not in ('published'::public.adventure_status, 'sold_out'::public.adventure_status) then
    raise exception 'Only published outings can be completed';
  end if;

  update public.adventures
  set status = p_status
  where id = p_adventure_id and created_by = auth.uid()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.transition_host_outing(uuid, public.adventure_status) to authenticated;
