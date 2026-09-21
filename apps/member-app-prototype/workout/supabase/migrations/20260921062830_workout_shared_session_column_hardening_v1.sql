revoke update on public.workout_shared_sessions from authenticated;
grant update (status, lead_audio_user_id, updated_at, started_at, completed_at)
on public.workout_shared_sessions to authenticated;

revoke update on public.workout_shared_participant_state from authenticated;
grant update (
  display_name, ready, connection_state, exercise_index, set_index, phase, is_paused, updated_at
)
on public.workout_shared_participant_state to authenticated;
