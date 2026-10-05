create or replace function public.create_workout_shared_session_for_partner(
  p_join_code text,
  p_partner_user_id uuid,
  p_partner_name text,
  p_host_name text,
  p_routine_name text,
  p_scheduled_date date,
  p_plan_day_id text,
  p_plan_snapshot jsonb,
  p_mode text,
  p_pace text,
  p_set_flow text
)
returns public.workout_shared_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
  v_partner_name text := left(coalesce(nullif(btrim(p_partner_name), ''), 'Workout partner'), 80);
  v_host_name text := left(coalesce(nullif(btrim(p_host_name), ''), 'Workout partner'), 80);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_partner_user_id is null or p_partner_user_id = v_user_id then
    raise exception 'Choose a valid saved workout partner';
  end if;

  if upper(btrim(p_join_code)) !~ '^[A-Z2-9]{6}$' then
    raise exception 'Invalid join code';
  end if;

  if not exists (
    select 1
    from public.workout_shared_sessions s
    where s.partner_user_id is not null
      and (
        (s.host_user_id = v_user_id and s.partner_user_id = p_partner_user_id)
        or
        (s.host_user_id = p_partner_user_id and s.partner_user_id = v_user_id)
      )
  ) then
    raise exception 'Connect with this partner by code once before using direct invites';
  end if;

  insert into public.workout_shared_sessions (
    join_code,
    host_user_id,
    partner_user_id,
    host_name,
    partner_name,
    routine_name,
    scheduled_date,
    plan_day_id,
    plan_snapshot,
    mode,
    pace,
    set_flow,
    lead_audio_user_id,
    status
  )
  values (
    upper(btrim(p_join_code)),
    v_user_id,
    p_partner_user_id,
    v_host_name,
    v_partner_name,
    coalesce(nullif(btrim(p_routine_name), ''), 'Shared workout'),
    p_scheduled_date,
    p_plan_day_id,
    coalesce(p_plan_snapshot, '{}'::jsonb),
    p_mode,
    p_pace,
    p_set_flow,
    v_user_id,
    'lobby'
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) from public;
revoke all on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) from anon;
grant execute on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) to authenticated;

comment on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) is
  'Creates a direct shared-workout invite for a previously connected workout partner. First-time partners still connect through the one-time join-code flow.';

notify pgrst, 'reload schema';
