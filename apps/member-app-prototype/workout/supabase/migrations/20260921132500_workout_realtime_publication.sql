do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='workout_shared_sessions'
  ) then
    alter publication supabase_realtime add table public.workout_shared_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='workout_shared_participant_state'
  ) then
    alter publication supabase_realtime add table public.workout_shared_participant_state;
  end if;
end $$;