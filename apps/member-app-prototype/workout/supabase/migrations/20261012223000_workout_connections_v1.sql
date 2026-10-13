
-- GO Workout Connections V1. Separate opt-in social data from private workout_user_state.
create table if not exists public.workout_connection_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  discoverable boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint workout_connection_handle_chk check (handle ~ '^[a-z0-9_]{3,24}$'),
  constraint workout_connection_name_chk check (char_length(btrim(display_name)) between 1 and 80)
);

create table if not exists public.workout_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  user_low uuid generated always as (least(requester_id,recipient_id)) stored,
  user_high uuid generated always as (greatest(requester_id,recipient_id)) stored,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint workout_connections_distinct_chk check (requester_id <> recipient_id),
  constraint workout_connections_pair_unique unique (user_low,user_high)
);
create index if not exists workout_connections_recipient_idx on public.workout_connections(recipient_id,status);
create index if not exists workout_connections_requester_idx on public.workout_connections(requester_id,status);

create table if not exists public.workout_connection_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  constraint workout_block_distinct_chk check (blocker_id <> blocked_id)
);

-- Published goal projections are separate from the private goalLab in workout_user_state.
-- For goal_only/status visibility, sensitive numeric fields are never stored.
create table if not exists public.workout_goal_shares (
  owner_id uuid not null references auth.users(id) on delete cascade,
  goal_id text not null,
  goal_name text not null,
  visibility text not null check (visibility in ('goal_only','status','details')),
  progress_status text,
  progress_percent integer check (progress_percent between 0 and 100),
  measured_value numeric,
  target_value numeric,
  unit text,
  updated_at timestamptz not null default now(),
  primary key (owner_id,goal_id),
  constraint workout_share_goal_id_chk check (char_length(goal_id) between 1 and 120),
  constraint workout_share_name_chk check (char_length(goal_name) between 1 and 100),
  constraint workout_share_level_chk check (
    (visibility = 'goal_only' and progress_status is null and progress_percent is null and measured_value is null and target_value is null and unit is null)
    or (visibility = 'status' and progress_status is not null and progress_percent is null and measured_value is null and target_value is null and unit is null)
    or (visibility = 'details' and progress_status is not null and progress_percent is not null and measured_value is not null and target_value is not null and unit is not null)
  )
);

create table if not exists public.workout_encouragement (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  goal_id text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint workout_encouragement_distinct_chk check (sender_id <> recipient_id),
  constraint workout_encouragement_message_chk check (char_length(btrim(message)) between 1 and 240)
);
create index if not exists workout_encouragement_recipient_idx on public.workout_encouragement(recipient_id,created_at desc);

alter table public.workout_connection_profiles enable row level security;
alter table public.workout_connections enable row level security;
alter table public.workout_connection_blocks enable row level security;
alter table public.workout_goal_shares enable row level security;
alter table public.workout_encouragement enable row level security;

create policy workout_connections_read on public.workout_connections for select to authenticated
using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy workout_blocks_read on public.workout_connection_blocks for select to authenticated
using (blocker_id = (select auth.uid()));
create policy workout_profiles_read on public.workout_connection_profiles for select to authenticated
using (
  user_id = (select auth.uid()) or discoverable
  or exists (
    select 1 from public.workout_connections c
    where (c.requester_id = user_id and c.recipient_id = (select auth.uid()))
       or (c.recipient_id = user_id and c.requester_id = (select auth.uid()))
  )
);
create policy workout_profiles_insert on public.workout_connection_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy workout_profiles_update on public.workout_connection_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy workout_goals_read on public.workout_goal_shares for select to authenticated
using (
  owner_id = (select auth.uid()) or (
    exists (
      select 1 from public.workout_connections c
      where c.status = 'accepted'
        and ((c.requester_id = owner_id and c.recipient_id = (select auth.uid()))
          or (c.recipient_id = owner_id and c.requester_id = (select auth.uid())))
    )
    and not exists (
      select 1 from public.workout_connection_blocks b
      where (b.blocker_id = owner_id and b.blocked_id = (select auth.uid()))
         or (b.blocker_id = (select auth.uid()) and b.blocked_id = owner_id)
    )
  )
);
create policy workout_goals_insert on public.workout_goal_shares for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy workout_goals_update on public.workout_goal_shares for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy workout_goals_delete on public.workout_goal_shares for delete to authenticated
using (owner_id = (select auth.uid()));
create policy workout_encouragement_read on public.workout_encouragement for select to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

revoke all on public.workout_connection_profiles,public.workout_connections,
  public.workout_connection_blocks,public.workout_goal_shares,public.workout_encouragement from anon;
grant select,insert,update on public.workout_connection_profiles to authenticated;
grant select on public.workout_connections,public.workout_connection_blocks,public.workout_encouragement to authenticated;
grant select,insert,update,delete on public.workout_goal_shares to authenticated;

create or replace function public.workout_connection_request(p_handle text)
returns uuid language plpgsql security definer set search_path = pg_catalog,public as $$
declare
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_id uuid;
begin
  if v_sender is null then raise exception 'Sign in to connect'; end if;
  select p.user_id into v_recipient from public.workout_connection_profiles p
  where p.handle = lower(btrim(p_handle)) and p.discoverable = true;
  if v_recipient is null then raise exception 'No discoverable member has that username'; end if;
  if v_recipient = v_sender then raise exception 'You cannot connect to yourself'; end if;
  if exists (select 1 from public.workout_connection_blocks b
     where (b.blocker_id=v_sender and b.blocked_id=v_recipient)
        or (b.blocker_id=v_recipient and b.blocked_id=v_sender))
  then raise exception 'Connection is unavailable'; end if;
  insert into public.workout_connections (requester_id,recipient_id,status)
  values (v_sender,v_recipient,'pending')
  on conflict (user_low,user_high) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.workout_connections
    where user_low=least(v_sender,v_recipient) and user_high=greatest(v_sender,v_recipient);
  end if;
  return v_id;
end;
$$;

create or replace function public.workout_connection_respond(p_connection_id uuid,p_accept boolean)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_user uuid := auth.uid(); v_row public.workout_connections%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select * into v_row from public.workout_connections where id=p_connection_id for update;
  if not found or v_row.recipient_id<>v_user or v_row.status<>'pending' then
    raise exception 'Connection request is unavailable';
  end if;
  if exists(select 1 from public.workout_connection_blocks b
    where (b.blocker_id=v_user and b.blocked_id=v_row.requester_id)
       or (b.blocker_id=v_row.requester_id and b.blocked_id=v_user))
    then raise exception 'Connection is unavailable';
  end if;
  if p_accept then
    update public.workout_connections set status='accepted',responded_at=now() where id=p_connection_id;
  else
    delete from public.workout_connections where id=p_connection_id;
  end if;
  return true;
end;
$$;

create or replace function public.workout_connection_remove(p_connection_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  delete from public.workout_connections where id=p_connection_id and (requester_id=v_user or recipient_id=v_user);
  return found;
end;
$$;

create or replace function public.workout_connection_block(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_user_id is null or p_user_id=v_user then raise exception 'Invalid member'; end if;
  insert into public.workout_connection_blocks(blocker_id,blocked_id) values(v_user,p_user_id)
  on conflict do nothing;
  delete from public.workout_connections where user_low=least(v_user,p_user_id) and user_high=greatest(v_user,p_user_id);
  return true;
end;
$$;

create or replace function public.workout_connection_unblock(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  delete from public.workout_connection_blocks where blocker_id=v_user and blocked_id=p_user_id;
  return found;
end;
$$;

create or replace function public.workout_send_encouragement(p_recipient_id uuid,p_message text,p_goal_id text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_sender uuid := auth.uid(); v_id uuid;
begin
  if v_sender is null then raise exception 'Sign in required'; end if;
  if char_length(btrim(coalesce(p_message,''))) not between 1 and 240 then raise exception 'Message must be 1 to 240 characters'; end if;
  if not exists (select 1 from public.workout_connections c where c.status='accepted'
    and ((c.requester_id=v_sender and c.recipient_id=p_recipient_id)
      or (c.recipient_id=v_sender and c.requester_id=p_recipient_id))) then
    raise exception 'Connect with this member before sending encouragement';
  end if;
  if exists(select 1 from public.workout_connection_blocks b
    where (b.blocker_id=v_sender and b.blocked_id=p_recipient_id)
      or (b.blocker_id=p_recipient_id and b.blocked_id=v_sender)) then
    raise exception 'Encouragement is unavailable';
  end if;
  if p_goal_id is not null and not exists (
    select 1 from public.workout_goal_shares g where g.owner_id=p_recipient_id and g.goal_id=p_goal_id
  ) then raise exception 'That goal is no longer shared'; end if;
  if (select count(*) from public.workout_encouragement
      where sender_id=v_sender and recipient_id=p_recipient_id and created_at>now()-interval '24 hours')>=10 then
    raise exception 'Daily encouragement limit reached';
  end if;
  insert into public.workout_encouragement(sender_id,recipient_id,goal_id,message)
  values(v_sender,p_recipient_id,p_goal_id,btrim(p_message)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.workout_encouragement_mark_read(p_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog,public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  update public.workout_encouragement set read_at=coalesce(read_at,now())
  where id=p_id and recipient_id=v_user;
  return found;
end;
$$;

revoke all on function public.workout_connection_request(text),public.workout_connection_respond(uuid,boolean),
  public.workout_connection_remove(uuid),public.workout_connection_block(uuid),
  public.workout_connection_unblock(uuid),public.workout_send_encouragement(uuid,text,text),
  public.workout_encouragement_mark_read(uuid) from public,anon;
grant execute on function public.workout_connection_request(text),public.workout_connection_respond(uuid,boolean),
  public.workout_connection_remove(uuid),public.workout_connection_block(uuid),
  public.workout_connection_unblock(uuid),public.workout_send_encouragement(uuid,text,text),
  public.workout_encouragement_mark_read(uuid) to authenticated;

notify pgrst,'reload schema';

-- Upgrade direct invites to support accepted Connections without requiring a previous session.
create or replace function public.create_workout_shared_session_for_partner(
  p_join_code text,
  p_partner_user_id uuid,
  p_partner_name text,
  p_host_name text,
  p_routine_name text,
  p_scheduled_date date,
  p_plan_day_id text,
  p_plan_snapshot jsonb,
  p_mode text,
  p_pace text,
  p_set_flow text
)
returns public.workout_shared_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.workout_shared_sessions%rowtype;
  v_partner_name text := left(coalesce(nullif(btrim(p_partner_name), ''), 'Workout partner'), 80);
  v_host_name text := left(coalesce(nullif(btrim(p_host_name), ''), 'Workout partner'), 80);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_partner_user_id is null or p_partner_user_id = v_user_id then
    raise exception 'Choose a valid saved workout partner';
  end if;

  if exists (select 1 from public.workout_connection_blocks b
    where (b.blocker_id = v_user_id and b.blocked_id = p_partner_user_id)
       or (b.blocker_id = p_partner_user_id and b.blocked_id = v_user_id))
  then
    raise exception 'This workout invitation is unavailable';
  end if;

  if upper(btrim(p_join_code)) !~ '^[A-Z2-9]{6}$' then
    raise exception 'Invalid join code';
  end if;

  -- Accepted connections can invite each other without a previous shared workout.
  -- Prior code-connected workout partners remain eligible.
  if not exists (
    select 1 from public.workout_connections c
    where c.status = 'accepted'
      and ((c.requester_id = v_user_id and c.recipient_id = p_partner_user_id)
        or (c.recipient_id = v_user_id and c.requester_id = p_partner_user_id))
  )
  and not exists (
    select 1
    from public.workout_shared_sessions s
    where s.partner_user_id is not null
      and (
        (s.host_user_id = v_user_id and s.partner_user_id = p_partner_user_id)
        or
        (s.host_user_id = p_partner_user_id and s.partner_user_id = v_user_id)
      )
  ) then
    raise exception 'Connect with this partner by code once before using direct invites';
  end if;

  insert into public.workout_shared_sessions (
    join_code,
    host_user_id,
    partner_user_id,
    host_name,
    partner_name,
    routine_name,
    scheduled_date,
    plan_day_id,
    plan_snapshot,
    mode,
    pace,
    set_flow,
    lead_audio_user_id,
    status
  )
  values (
    upper(btrim(p_join_code)),
    v_user_id,
    p_partner_user_id,
    v_host_name,
    v_partner_name,
    coalesce(nullif(btrim(p_routine_name), ''), 'Shared workout'),
    p_scheduled_date,
    p_plan_day_id,
    coalesce(p_plan_snapshot, '{}'::jsonb),
    p_mode,
    p_pace,
    p_set_flow,
    v_user_id,
    'lobby'
  )
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) from public;
revoke all on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) from anon;
grant execute on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) to authenticated;

comment on function public.create_workout_shared_session_for_partner(
  text, uuid, text, text, text, date, text, jsonb, text, text, text
) is
  'Creates direct shared workouts for accepted GO Workout Connections or partners previously joined by code.';

notify pgrst, 'reload schema';
