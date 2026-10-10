create table if not exists public.workout_health_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('samsung_health','health_connect')),
  enabled boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.workout_health_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('samsung_health','health_connect')),
  external_record_id text not null,
  source_package text,
  history_id text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_record_id)
);

alter table public.workout_health_connections enable row level security;
alter table public.workout_health_imports enable row level security;

grant select, insert, update, delete on public.workout_health_connections to authenticated;
grant select, insert, update, delete on public.workout_health_imports to authenticated;

drop policy if exists "workout health connections own rows" on public.workout_health_connections;
create policy "workout health connections own rows"
on public.workout_health_connections
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "workout health imports own rows" on public.workout_health_imports;
create policy "workout health imports own rows"
on public.workout_health_imports
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists workout_health_imports_user_completed_idx
on public.workout_health_imports (user_id, completed_at desc);
