-- Repair shared-workout planning columns for environments where the
-- original cloud-state migration was not applied before the Together UI.
alter table public.workout_shared_participant_state
  add column if not exists planning_profile jsonb,
  add column if not exists readiness jsonb,
  add column if not exists planned_day jsonb;

revoke update on public.workout_shared_participant_state from authenticated;

grant update (
  display_name,
  ready,
  connection_state,
  exercise_index,
  set_index,
  phase,
  is_paused,
  updated_at,
  planning_profile,
  readiness,
  planned_day
)
on public.workout_shared_participant_state to authenticated;

-- Ask PostgREST to refresh its schema after this migration so newly added
-- planning columns are immediately available to the client API.
notify pgrst, 'reload schema';
