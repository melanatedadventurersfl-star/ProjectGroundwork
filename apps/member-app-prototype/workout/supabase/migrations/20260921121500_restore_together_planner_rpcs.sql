create or replace function public.build_workout_shared_plan(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
  v_count int;
  v_ready_count int;
  v_host jsonb;
  v_partner jsonb;
  v_host_day jsonb;
  v_partner_day jsonb;
  v_host_readiness jsonb;
  v_partner_readiness jsonb;
  v_minutes int;
  v_slots jsonb;
  v_plan jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.workout_shared_sessions where id=p_session_id for update;
  if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
  if v_session.partner_user_id is null then raise exception 'Waiting for partner'; end if;

  select count(*), count(*) filter (where ps.ready)
  into v_count,v_ready_count
  from public.workout_shared_participant_state ps
  where ps.session_id=p_session_id;
  if v_count<>2 or v_ready_count<>2 then raise exception 'Both check-ins are required'; end if;

  select planning_profile,planned_day,readiness into v_host,v_host_day,v_host_readiness
  from public.workout_shared_private_state where session_id=p_session_id and user_id=v_session.host_user_id;
  select planning_profile,planned_day,readiness into v_partner,v_partner_day,v_partner_readiness
  from public.workout_shared_private_state where session_id=p_session_id and user_id=v_session.partner_user_id;
  if v_host_readiness is null or v_partner_readiness is null then raise exception 'Both check-ins are required'; end if;

  v_minutes := greatest(20, least(
    coalesce((v_host_readiness->>'timeAvailable')::int,(v_host->>'minutes')::int,45),
    coalesce((v_partner_readiness->>'timeAvailable')::int,(v_partner->>'minutes')::int,45)
  ));

  with host_ex as (
    select h.ordinality as host_pos,h.value as ex
    from jsonb_array_elements(coalesce(v_host_day->'exercises','[]'::jsonb)) with ordinality h(value,ordinality)
  ), partner_ex as (
    select p.ordinality as partner_pos,p.value as ex
    from jsonb_array_elements(coalesce(v_partner_day->'exercises','[]'::jsonb)) with ordinality p(value,ordinality)
  ), candidates as (
    select h.host_pos,p.partner_pos,h.ex host_ex,p.ex partner_ex,
      case when h.ex->>'movement'=p.ex->>'movement' then 100 else 0 end +
      case when h.ex->>'id'=p.ex->>'id' then 25 else 0 end as score
    from host_ex h cross join partner_ex p
    where h.ex->>'movement'=p.ex->>'movement'
  ), ranked as (
    select *,row_number() over(partition by host_pos order by score desc,partner_pos) hr,
             row_number() over(partition by partner_pos order by score desc,host_pos) pr
    from candidates
  ), chosen as (
    select * from ranked where hr=1 and pr=1 order by host_pos limit 8
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'movement',host_ex->>'movement',
    'hostExercise',host_ex,
    'partnerExercise',partner_ex
  )),'[]'::jsonb) into v_slots from chosen;

  if jsonb_array_length(v_slots)<2 then
    raise exception 'No compatible shared workout found';
  end if;

  v_plan := jsonb_build_object(
    'name','Together Workout',
    'minutes',v_minutes,
    'generatedAt',now(),
    'slots',v_slots,
    'participants',jsonb_build_object(
      v_session.host_user_id::text,jsonb_build_object('goal',v_host->>'goal','readinessScore',v_host_readiness->>'score'),
      v_session.partner_user_id::text,jsonb_build_object('goal',v_partner->>'goal','readinessScore',v_partner_readiness->>'score')
    )
  );

  update public.workout_shared_sessions
  set shared_plan=v_plan,plan_version=plan_version+1,routine_name='Together Workout',updated_at=now()
  where id=p_session_id;

  return v_plan;
end $$;

revoke all on function public.build_workout_shared_plan(uuid) from public,anon;
grant execute on function public.build_workout_shared_plan(uuid) to authenticated;

create or replace function public.get_workout_shared_plan(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_session public.workout_shared_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.workout_shared_sessions where id=p_session_id;
  if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
  return coalesce(v_session.shared_plan,'{}'::jsonb);
end $$;

revoke all on function public.get_workout_shared_plan(uuid) from public,anon;
grant execute on function public.get_workout_shared_plan(uuid) to authenticated;
