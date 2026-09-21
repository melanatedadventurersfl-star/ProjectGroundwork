begin;
alter table public.workout_shared_participant_state
  drop column if exists planning_profile,
  drop column if exists readiness,
  drop column if exists planned_day;

create or replace function public.build_workout_shared_plan(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_session public.workout_shared_sessions%rowtype; v_count int; v_ready_count int;
v_host_day jsonb; v_partner_day jsonb; v_host_readiness jsonb; v_partner_readiness jsonb;
v_host_minutes int; v_partner_minutes int; v_minutes int; v_slots jsonb; v_plan jsonb;
begin
if v_uid is null then raise exception 'Authentication required'; end if;
select * into v_session from public.workout_shared_sessions where id=p_session_id for update;
if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
if v_session.partner_user_id is null then raise exception 'Waiting for partner'; end if;
select count(*),count(*) filter(where ps.ready) into v_count,v_ready_count from public.workout_shared_participant_state ps where ps.session_id=p_session_id;
if v_count<>2 or v_ready_count<>2 then raise exception 'Both check-ins are required'; end if;
select planned_day,readiness into v_host_day,v_host_readiness from public.workout_shared_private_state where session_id=p_session_id and user_id=v_session.host_user_id;
select planned_day,readiness into v_partner_day,v_partner_readiness from public.workout_shared_private_state where session_id=p_session_id and user_id=v_session.partner_user_id;
if v_host_readiness is null or v_partner_readiness is null then raise exception 'Both check-ins are required'; end if;
v_host_minutes:=greatest(20,coalesce((v_host_readiness->>'timeAvailable')::int,(v_host_day->>'estimatedMinutes')::int,45));
v_partner_minutes:=greatest(20,coalesce((v_partner_readiness->>'timeAvailable')::int,(v_partner_day->>'estimatedMinutes')::int,45));
v_minutes:=least(v_host_minutes,v_partner_minutes);
with host_ex as (
 select h.ordinality host_pos,h.value ex from jsonb_array_elements(coalesce(v_host_day->'exercises','[]'::jsonb)) with ordinality h(value,ordinality)
),partner_ex as (
 select p.ordinality partner_pos,p.value ex from jsonb_array_elements(coalesce(v_partner_day->'exercises','[]'::jsonb)) with ordinality p(value,ordinality)
),candidates as (
 select h.host_pos,p.partner_pos,h.ex host_ex,p.ex partner_ex,100+case when h.ex->>'id'=p.ex->>'id' then 25 else 0 end score
 from host_ex h cross join partner_ex p where coalesce(h.ex->>'movement','')<>'' and h.ex->>'movement'=p.ex->>'movement'
),ranked as (
 select *,row_number() over(partition by host_pos order by score desc,partner_pos) hr,row_number() over(partition by partner_pos order by score desc,host_pos) pr from candidates
),chosen as (select * from ranked where hr=1 and pr=1 order by host_pos limit 8)
select coalesce(jsonb_agg(jsonb_build_object('movement',host_ex->>'movement','hostExerciseId',host_ex->>'id','hostExerciseName',host_ex->>'name','partnerExerciseId',partner_ex->>'id','partnerExerciseName',partner_ex->>'name')),'[]'::jsonb)
into v_slots from chosen;
if jsonb_array_length(v_slots)<2 then raise exception 'No compatible shared workout found'; end if;
v_plan:=jsonb_build_object('name','Together Workout','minutes',v_minutes,'generatedAt',now(),'slots',v_slots);
update public.workout_shared_sessions set shared_plan=v_plan,plan_version=plan_version+1,routine_name='Together Workout',status='review',updated_at=now() where id=p_session_id;
return v_plan;
end $$;
revoke all on function public.build_workout_shared_plan(uuid) from public,anon;
grant execute on function public.build_workout_shared_plan(uuid) to authenticated;

create or replace function public.get_workout_shared_plan(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_session public.workout_shared_sessions%rowtype;
begin
if v_uid is null then raise exception 'Authentication required'; end if;
select * into v_session from public.workout_shared_sessions where id=p_session_id;
if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
return coalesce(v_session.shared_plan,'{}'::jsonb);
end $$;
revoke all on function public.get_workout_shared_plan(uuid) from public,anon;
grant execute on function public.get_workout_shared_plan(uuid) to authenticated;

create or replace function public.get_workout_shared_prescription(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_session public.workout_shared_sessions%rowtype; v_private public.workout_shared_private_state%rowtype; v_side text; v_exercises jsonb;
begin
if v_uid is null then raise exception 'Authentication required'; end if;
select * into v_session from public.workout_shared_sessions where id=p_session_id;
if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
select * into v_private from public.workout_shared_private_state where session_id=p_session_id and user_id=v_uid;
if not found then raise exception 'Private workout state unavailable'; end if;
v_side:=case when v_uid=v_session.host_user_id then 'host' else 'partner' end;
select coalesce(jsonb_agg(ex order by slot_ord),'[]'::jsonb) into v_exercises from (
 select slot_ord,day_ex.value ex
 from jsonb_array_elements(coalesce(v_session.shared_plan->'slots','[]'::jsonb)) with ordinality slot(value,slot_ord)
 join lateral jsonb_array_elements(coalesce(v_private.planned_day->'exercises','[]'::jsonb)) day_ex(value)
 on day_ex.value->>'id'=case when v_side='host' then slot.value->>'hostExerciseId' else slot.value->>'partnerExerciseId' end
) q;
return jsonb_build_object('id','together-'||p_session_id::text,'name','Together Workout','focus','Compatible shared training',
'estimatedMinutes',coalesce((v_session.shared_plan->>'minutes')::int,(v_private.planned_day->>'estimatedMinutes')::int,45),
'warmup',coalesce(v_private.planned_day->'warmup','[]'::jsonb),'cooldown',coalesce(v_private.planned_day->'cooldown','[]'::jsonb),
'exercises',v_exercises,'readiness',coalesce(v_private.readiness,'{}'::jsonb));
end $$;
revoke all on function public.get_workout_shared_prescription(uuid) from public,anon;
grant execute on function public.get_workout_shared_prescription(uuid) to authenticated;
commit;