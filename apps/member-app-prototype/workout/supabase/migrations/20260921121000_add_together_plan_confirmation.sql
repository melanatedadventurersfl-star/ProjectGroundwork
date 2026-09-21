alter table public.workout_shared_participant_state
  add column if not exists plan_confirmed boolean not null default false;

grant update(plan_confirmed) on public.workout_shared_participant_state to authenticated;

create or replace function public.confirm_workout_shared_plan(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
  v_participants int;
  v_confirmed int;
  v_status text;
  v_started_at timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.workout_shared_sessions
  where id=p_session_id
  for update;

  if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then
    raise exception 'Shared session unavailable';
  end if;

  if jsonb_array_length(coalesce(v_session.shared_plan->'slots','[]'::jsonb)) < 1 then
    raise exception 'Shared plan is not ready';
  end if;

  update public.workout_shared_participant_state
  set plan_confirmed=true, phase='confirmed', updated_at=now()
  where session_id=p_session_id and user_id=v_uid and ready=true;

  if not found then raise exception 'Complete your check-in first'; end if;

  select count(*), count(*) filter (where plan_confirmed)
  into v_participants,v_confirmed
  from public.workout_shared_participant_state
  where session_id=p_session_id;

  if v_participants=2 and v_confirmed=2 then
    update public.workout_shared_sessions
    set status='active', started_at=coalesce(started_at,now()), updated_at=now()
    where id=p_session_id
    returning status,started_at into v_status,v_started_at;
  else
    v_status:=v_session.status;
    v_started_at:=v_session.started_at;
  end if;

  return jsonb_build_object(
    'confirmed',true,
    'bothConfirmed',(v_participants=2 and v_confirmed=2),
    'status',v_status,
    'startedAt',v_started_at
  );
end $$;

revoke all on function public.confirm_workout_shared_plan(uuid) from public,anon;
grant execute on function public.confirm_workout_shared_plan(uuid) to authenticated;
