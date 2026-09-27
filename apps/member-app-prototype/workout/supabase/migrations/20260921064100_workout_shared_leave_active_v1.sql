create or replace function public.leave_workout_shared_session(
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.workout_shared_sessions
  where id = p_session_id
  for update;

  if not found then
    return false;
  end if;

  if v_session.host_user_id = v_user_id then
    update public.workout_shared_sessions
    set status = 'cancelled',
        updated_at = now()
    where id = p_session_id
      and status in ('lobby', 'active');
  elsif v_session.partner_user_id = v_user_id then
    if v_session.status = 'lobby' then
      update public.workout_shared_sessions
      set partner_user_id = null,
          partner_name = null,
          updated_at = now()
      where id = p_session_id;
    end if;

    delete from public.workout_shared_participant_state
    where session_id = p_session_id
      and user_id = v_user_id;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.leave_workout_shared_session(uuid) from public;
revoke all on function public.leave_workout_shared_session(uuid) from anon;
grant execute on function public.leave_workout_shared_session(uuid) to authenticated;
