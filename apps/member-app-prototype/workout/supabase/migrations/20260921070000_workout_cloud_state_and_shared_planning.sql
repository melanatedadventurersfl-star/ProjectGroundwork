create table if not exists public.workout_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb, plan jsonb, calibration jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb, progression_log jsonb not null default '[]'::jsonb,
  exercise_preferences jsonb not null default '{"excluded":[],"swapHistory":[]}'::jsonb,
  training_program jsonb not null default '{"scheduleOverrides":{},"weekReviews":{}}'::jsonb,
  cue_settings jsonb not null default '{"sound":true,"voice":true,"haptics":true,"flash":true}'::jsonb,
  history jsonb not null default '[]'::jsonb, active_workout jsonb, last_summary_id text,
  onboarding_complete boolean not null default false, onboarding_step text not null default 'account',
  updated_at timestamptz not null default now()
);
alter table public.workout_user_state enable row level security;
grant select,insert,update on public.workout_user_state to authenticated;
drop policy if exists "workout state select own" on public.workout_user_state;
create policy "workout state select own" on public.workout_user_state for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "workout state insert own" on public.workout_user_state;
create policy "workout state insert own" on public.workout_user_state for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "workout state update own" on public.workout_user_state;
create policy "workout state update own" on public.workout_user_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter table public.workout_shared_participant_state add column if not exists planning_profile jsonb, add column if not exists readiness jsonb, add column if not exists planned_day jsonb;
revoke update on public.workout_shared_participant_state from authenticated;
grant update(display_name,ready,connection_state,exercise_index,set_index,phase,is_paused,updated_at,planning_profile,readiness,planned_day) on public.workout_shared_participant_state to authenticated;