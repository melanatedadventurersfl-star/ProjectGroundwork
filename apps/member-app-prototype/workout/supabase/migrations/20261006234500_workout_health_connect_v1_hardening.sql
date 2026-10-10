revoke all on table public.workout_health_connections from anon, authenticated;
revoke all on table public.workout_health_imports from anon, authenticated;

grant select, insert, update, delete on table public.workout_health_connections to authenticated;
grant select, insert, update, delete on table public.workout_health_imports to authenticated;
