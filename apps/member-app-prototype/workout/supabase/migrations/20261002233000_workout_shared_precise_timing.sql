-- Share only coordination data needed to keep a two-person workout on one clock.
-- Performance data such as weights, reps, notes, readiness, and history remains private.
alter table public.workout_shared_participant_state
  add column if not exists active_side text,
  add column if not exists stage_index integer not null default 0,
  add column if not exists stage_side text,
  add column if not exists next_exercise_index integer,
  add column if not exists next_set_index integer,
  add column if not exists phase_started_at timestamptz,
  add column if not exists phase_ends_at timestamptz,
  add column if not exists timer_duration_seconds integer,
  add column if not exists paused_at timestamptz,
  add column if not exists sync_revision bigint not null default 0,
  add column if not exists step_key text,
  add column if not exists step_complete boolean not null default false;

alter table public.workout_shared_participant_state
  drop constraint if exists workout_shared_participant_stage_index_chk,
  drop constraint if exists workout_shared_participant_next_indexes_chk,
  drop constraint if exists workout_shared_participant_timer_duration_chk;

alter table public.workout_shared_participant_state
  add constraint workout_shared_participant_stage_index_chk
    check (stage_index >= 0),
  add constraint workout_shared_participant_next_indexes_chk
    check (
      (next_exercise_index is null or next_exercise_index >= 0)
      and (next_set_index is null or next_set_index >= 0)
    ),
  add constraint workout_shared_participant_timer_duration_chk
    check (timer_duration_seconds is null or timer_duration_seconds >= 0);

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
  planned_day,
  active_side,
  stage_index,
  stage_side,
  next_exercise_index,
  next_set_index,
  phase_started_at,
  phase_ends_at,
  timer_duration_seconds,
  paused_at,
  sync_revision,
  step_key,
  step_complete
)
on public.workout_shared_participant_state to authenticated;

comment on column public.workout_shared_participant_state.active_side is
  'Share-safe coordination state for unilateral right, left, or switch phases.';
comment on column public.workout_shared_participant_state.phase_started_at is
  'Authoritative phase timer anchor for Stay Together sessions.';
comment on column public.workout_shared_participant_state.phase_ends_at is
  'Authoritative phase timer deadline for Stay Together sessions.';
comment on column public.workout_shared_participant_state.sync_revision is
  'Monotonic client timestamp used to ignore stale realtime coordination updates.';
comment on column public.workout_shared_participant_state.step_key is
  'Share-safe barrier key for the active side, set, calibration, or feedback step.';
comment on column public.workout_shared_participant_state.step_complete is
  'Signals that this participant reached the current Stay Together barrier.';

notify pgrst, 'reload schema';
