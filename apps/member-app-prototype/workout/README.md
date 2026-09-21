# Workout

Workout is a standalone training application.

## Product boundary

Workout does not use Go Melanated authentication, profiles, memberships, or application data.

- Authentication: standalone Supabase Auth project
- Database: standalone Supabase project
- Workout profile/history/progression: stored only in the Workout backend
- Shared workouts: coordinated only through Workout Realtime tables/channels
- Go Melanated account linking: none
- Go Melanated membership requirement: none

The current standalone Supabase project is `iftnwzqlofhujzulmofu`.

## Local state

Browser storage is a cache/offline layer for Workout only. After a Workout account signs in, Supabase is the account source of truth.

## Schema

Workout-owned migrations live in `supabase/migrations/` under this app directory. They must not be added to the repository-level Go Melanated Supabase migration folder.


## Authentication behavior

Workout owns its authentication independently.

- New accounts are created through the Workout-only `workout-signup` Edge Function.
- Signup accounts are immediately usable and do not require a confirmation-email step.
- The browser never receives the backend secret key.
- Password recovery uses Supabase Auth reset emails and returns users to the Workout web app to choose a new password.
