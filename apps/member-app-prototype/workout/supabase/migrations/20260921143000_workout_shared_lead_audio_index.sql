create index if not exists workout_shared_sessions_lead_audio_idx
  on public.workout_shared_sessions(lead_audio_user_id)
  where lead_audio_user_id is not null;