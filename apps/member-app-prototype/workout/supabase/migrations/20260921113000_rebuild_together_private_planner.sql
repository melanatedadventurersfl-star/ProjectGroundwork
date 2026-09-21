create table if not exists public.workout_shared_private_state (
  session_id uuid not null references public.workout_shared_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  planning_profile jsonb not null default '{}'::jsonb,
  planned_day jsonb not null default '{}'::jsonb,
  readiness jsonb,
  updated_at timestamptz not null default now(),
  primary key (session_id,user_id)
);

alter table public.workout_shared_private_state enable row level security;
revoke all on public.workout_shared_private_state from anon;
grant select,insert,update,delete on public.workout_shared_private_state to authenticated;

create policy "workout shared private state own read" on public.workout_shared_private_state for select to authenticated using ((select auth.uid())=user_id);
create policy "workout shared private state own insert" on public.workout_shared_private_state for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.workout_shared_sessions s where s.id=session_id and ((select auth.uid())=s.host_user_id or (select auth.uid())=s.partner_user_id)));
create policy "workout shared private state own update" on public.workout_shared_private_state for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

alter table public.workout_shared_sessions add column if not exists shared_plan jsonb not null default '{}'::jsonb;
alter table public.workout_shared_sessions add column if not exists plan_version integer not null default 0;

-- Server-side planner reads both private records only after both participants check in.
-- It returns only the sanitized compatible movement plan, never the other user's raw readiness.
create or replace function public.get_workout_shared_plan(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_session public.workout_shared_sessions%rowtype;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select * into v_session from public.workout_shared_sessions where id=p_session_id;
 if not found or (v_uid<>v_session.host_user_id and v_uid<>v_session.partner_user_id) then raise exception 'Shared session unavailable'; end if;
 return coalesce(v_session.shared_plan,'{}'::jsonb);
end $$;
revoke all on function public.get_workout_shared_plan(uuid) from public,anon;
grant execute on function public.get_workout_shared_plan(uuid) to authenticated;
