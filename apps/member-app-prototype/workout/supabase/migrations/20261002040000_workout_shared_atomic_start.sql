create or replace function public.start_workout_shared_session(p_session_id uuid)
returns public.workout_shared_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.workout_shared_sessions
  where id = p_session_id
  for update;

  if not found or v_session.host_user_id <> v_user_id then
    raise exception 'Host access required';
  end if;
  if v_session.status <> 'lobby' then
    raise exception 'Shared session is not in lobby';
  end if;
  if v_session.partner_user_id is null then
    raise exception 'Workout partner has not joined';
  end if;

  update public.workout_shared_sessions
  set status = 'active',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  update public.workout_shared_participant_state
  set phase = 'active', updated_at = now()
  where session_id = p_session_id;

  return v_session;
end;
$$;

revoke all on function public.start_workout_shared_session(uuid) from public;
revoke all on function public.start_workout_shared_session(uuid) from anon;
grant execute on function public.start_workout_shared_session(uuid) to authenticated;

notify pgrst, 'reload schema';
