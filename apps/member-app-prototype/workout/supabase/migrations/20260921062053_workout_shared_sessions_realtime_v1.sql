create table public.workout_shared_sessions (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  partner_user_id uuid references auth.users(id) on delete set null,
  host_name text not null,
  partner_name text,
  routine_name text not null,
  scheduled_date date,
  plan_day_id text,
  plan_snapshot jsonb not null default '{}'::jsonb,
  mode text not null default 'same-gym',
  pace text not null default 'stay-together',
  set_flow text not null default 'alternating',
  lead_audio_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'lobby',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint workout_shared_sessions_join_code_chk check (join_code ~ '^[A-Z2-9]{6}$'),
  constraint workout_shared_sessions_mode_chk check (mode in ('same-gym','remote','share-plan')),
  constraint workout_shared_sessions_pace_chk check (pace in ('stay-together','flexible')),
  constraint workout_shared_sessions_set_flow_chk check (set_flow in ('alternating','parallel')),
  constraint workout_shared_sessions_status_chk check (status in ('lobby','active','completed','cancelled')),
  constraint workout_shared_sessions_plan_snapshot_chk check (jsonb_typeof(plan_snapshot) = 'object'),
  constraint workout_shared_sessions_two_people_chk check (partner_user_id is null or partner_user_id <> host_user_id)
);

create index workout_shared_sessions_host_idx
  on public.workout_shared_sessions(host_user_id, created_at desc);
create index workout_shared_sessions_partner_idx
  on public.workout_shared_sessions(partner_user_id, created_at desc)
  where partner_user_id is not null;
create index workout_shared_sessions_status_expiry_idx
  on public.workout_shared_sessions(status, expires_at);

alter table public.workout_shared_sessions enable row level security;

grant select, insert, update on public.workout_shared_sessions to authenticated;
revoke all on public.workout_shared_sessions from anon;

create policy "workout shared members can read session"
on public.workout_shared_sessions
for select
to authenticated
using (
  (select auth.uid()) = host_user_id
  or (select auth.uid()) = partner_user_id
);

create policy "workout shared host can create session"
on public.workout_shared_sessions
for insert
to authenticated
with check (
  (select auth.uid()) = host_user_id
  and partner_user_id is null
);

create policy "workout shared host can update session"
on public.workout_shared_sessions
for update
to authenticated
using ((select auth.uid()) = host_user_id)
with check ((select auth.uid()) = host_user_id);

create table public.workout_shared_participant_state (
  session_id uuid not null references public.workout_shared_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  ready boolean not null default false,
  connection_state text not null default 'online',
  exercise_index integer not null default 0,
  set_index integer not null default 0,
  phase text not null default 'lobby',
  is_paused boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  constraint workout_shared_participant_connection_chk check (connection_state in ('online','offline','left')),
  constraint workout_shared_participant_indexes_chk check (exercise_index >= 0 and set_index >= 0)
);

create index workout_shared_participant_user_idx
  on public.workout_shared_participant_state(user_id, updated_at desc);

alter table public.workout_shared_participant_state enable row level security;

grant select, insert, update, delete on public.workout_shared_participant_state to authenticated;
revoke all on public.workout_shared_participant_state from anon;

create policy "workout shared members can read participant state"
on public.workout_shared_participant_state
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_shared_sessions s
    where s.id = session_id
      and ((select auth.uid()) = s.host_user_id or (select auth.uid()) = s.partner_user_id)
  )
);

create policy "workout shared member can create own participant state"
on public.workout_shared_participant_state
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.workout_shared_sessions s
    where s.id = session_id
      and ((select auth.uid()) = s.host_user_id or (select auth.uid()) = s.partner_user_id)
  )
);

create policy "workout shared member can update own participant state"
on public.workout_shared_participant_state
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.workout_shared_sessions s
    where s.id = session_id
      and ((select auth.uid()) = s.host_user_id or (select auth.uid()) = s.partner_user_id)
  )
);

create policy "workout shared member can delete own participant state"
on public.workout_shared_participant_state
for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.join_workout_shared_session(
  p_join_code text,
  p_display_name text default null
)
returns public.workout_shared_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
  v_display_name text := left(coalesce(nullif(btrim(p_display_name), ''), 'Workout partner'), 80);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.workout_shared_sessions
  where join_code = upper(btrim(p_join_code))
    and status = 'lobby'
    and expires_at > now()
  for update;

  if not found
     or v_session.host_user_id = v_user_id
     or (v_session.partner_user_id is not null and v_session.partner_user_id <> v_user_id) then
    raise exception 'Shared session is unavailable';
  end if;

  update public.workout_shared_sessions
  set partner_user_id = v_user_id,
      partner_name = v_display_name,
      updated_at = now()
  where id = v_session.id
  returning * into v_session;

  insert into public.workout_shared_participant_state (
    session_id, user_id, display_name, ready, connection_state, phase, updated_at
  )
  values (
    v_session.id, v_user_id, v_display_name, true, 'online', 'lobby', now()
  )
  on conflict (session_id, user_id)
  do update set
    display_name = excluded.display_name,
    ready = true,
    connection_state = 'online',
    phase = 'lobby',
    updated_at = now();

  return v_session;
end;
$$;

revoke all on function public.join_workout_shared_session(text, text) from public;
revoke all on function public.join_workout_shared_session(text, text) from anon;
grant execute on function public.join_workout_shared_session(text, text) to authenticated;

comment on function public.join_workout_shared_session(text, text) is
  'Authenticated join-code exchange. SECURITY DEFINER is intentional so a user can resolve exactly one lobby code before membership exists; auth.uid is required and execution is revoked from PUBLIC/anon.';

create or replace function public.leave_workout_shared_session(
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_session
  from public.workout_shared_sessions
  where id = p_session_id
  for update;

  if not found then
    return false;
  end if;

  if v_session.host_user_id = v_user_id then
    update public.workout_shared_sessions
    set status = 'cancelled',
        updated_at = now()
    where id = p_session_id
      and status = 'lobby';
  elsif v_session.partner_user_id = v_user_id then
    if v_session.status = 'lobby' then
      update public.workout_shared_sessions
      set partner_user_id = null,
          partner_name = null,
          updated_at = now()
      where id = p_session_id;
    end if;

    delete from public.workout_shared_participant_state
    where session_id = p_session_id
      and user_id = v_user_id;
  else
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.leave_workout_shared_session(uuid) from public;
revoke all on function public.leave_workout_shared_session(uuid) from anon;
grant execute on function public.leave_workout_shared_session(uuid) to authenticated;

comment on function public.leave_workout_shared_session(uuid) is
  'Authenticated shared-session leave/cancel helper with explicit membership checks.';

create policy "workout shared realtime members can receive"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.workout_shared_sessions s
    where ('workout:' || s.id::text) = (select realtime.topic())
      and ((select auth.uid()) = s.host_user_id or (select auth.uid()) = s.partner_user_id)
      and s.status in ('lobby','active','completed')
      and s.expires_at > now()
  )
);

create policy "workout shared realtime members can send"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.workout_shared_sessions s
    where ('workout:' || s.id::text) = (select realtime.topic())
      and ((select auth.uid()) = s.host_user_id or (select auth.uid()) = s.partner_user_id)
      and s.status in ('lobby','active','completed')
      and s.expires_at > now()
  )
);

comment on table public.workout_shared_sessions is
  'Two-person workout lobby/session metadata. Detailed performance data remains client-private.';
comment on table public.workout_shared_participant_state is
  'Share-safe live coordination state only: presence, readiness, phase, exercise/set position. No weights, reps, body data, or readiness answers.';
