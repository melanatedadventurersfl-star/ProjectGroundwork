create table if not exists public.tester_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('problem','idea','confusing','design','other')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  screen_path text,
  app_version text,
  build_number text,
  platform text,
  device_context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','reviewing','planned','fixed','closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.tester_feedback enable row level security;

drop policy if exists tester_feedback_insert_own on public.tester_feedback;
create policy tester_feedback_insert_own on public.tester_feedback
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists tester_feedback_select_own on public.tester_feedback;
create policy tester_feedback_select_own on public.tester_feedback
for select to authenticated
using ((select auth.uid()) = user_id or public.is_platform_admin((select auth.uid())));

drop policy if exists tester_feedback_admin_update on public.tester_feedback;
create policy tester_feedback_admin_update on public.tester_feedback
for update to authenticated
using (public.is_platform_admin((select auth.uid())))
with check (public.is_platform_admin((select auth.uid())));

create index if not exists tester_feedback_created_at_idx on public.tester_feedback(created_at desc);
create index if not exists tester_feedback_status_idx on public.tester_feedback(status, created_at desc);
create index if not exists tester_feedback_user_idx on public.tester_feedback(user_id, created_at desc);

create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create table if not exists backup.sync_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  sync_attempts integer not null default 0,
  last_error text
);

revoke all on all tables in schema backup from public, anon, authenticated;

create or replace function backup.queue_profile_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, backup, pg_temp
as $$
begin
  insert into backup.sync_outbox(event_type, entity_type, entity_id, payload)
  values (
    case when tg_op = 'INSERT' then 'user.created' else 'user.updated' end,
    'user',
    new.id::text,
    jsonb_build_object(
      'user_id', new.id,
      'email', new.email,
      'display_name', new.display_name,
      'first_name', new.first_name,
      'last_name', new.last_name,
      'username', new.username,
      'home_city', new.home_city,
      'home_state', new.home_state,
      'status', new.status,
      'platform_role', new.platform_role,
      'event_host_level', new.event_host_level,
      'created_at', new.created_at,
      'updated_at', new.updated_at
    )
  );
  return new;
end;
$$;

revoke all on function backup.queue_profile_snapshot() from public;

drop trigger if exists profiles_backup_outbox_trigger on public.profiles;
create trigger profiles_backup_outbox_trigger
after insert or update on public.profiles
for each row execute function backup.queue_profile_snapshot();

create or replace function backup.queue_feedback_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, backup, pg_temp
as $$
begin
  insert into backup.sync_outbox(event_type, entity_type, entity_id, payload)
  values (
    'feedback.created',
    'tester_feedback',
    new.id::text,
    jsonb_build_object(
      'feedback_id', new.id,
      'user_id', new.user_id,
      'category', new.category,
      'message', new.message,
      'screen_path', new.screen_path,
      'app_version', new.app_version,
      'build_number', new.build_number,
      'platform', new.platform,
      'status', new.status,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

revoke all on function backup.queue_feedback_snapshot() from public;

drop trigger if exists tester_feedback_backup_outbox_trigger on public.tester_feedback;
create trigger tester_feedback_backup_outbox_trigger
after insert on public.tester_feedback
for each row execute function backup.queue_feedback_snapshot();

create or replace function public.notify_admins_on_tester_feedback()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (
    recipient_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    p.id,
    'system'::public.notification_kind,
    case when new.category = 'problem' then 'high'::public.notification_priority else 'normal'::public.notification_priority end,
    case when new.category = 'problem' then 'New tester problem report' else 'New tester feedback' end,
    left(new.message, 240),
    '/admin/tester-feedback',
    'tester-feedback:' || new.id::text || ':' || p.id::text
  from public.profiles p
  where p.platform_role in ('admin','founder');

  return new;
end;
$$;

revoke all on function public.notify_admins_on_tester_feedback() from public;
grant execute on function public.notify_admins_on_tester_feedback() to postgres;

drop trigger if exists tester_feedback_notify_admins_trigger on public.tester_feedback;
create trigger tester_feedback_notify_admins_trigger
after insert on public.tester_feedback
for each row execute function public.notify_admins_on_tester_feedback();
