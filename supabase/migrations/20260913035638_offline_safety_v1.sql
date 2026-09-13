create table public.adventure_safety_sessions (
  id uuid primary key,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null,
  expected_return_at timestamptz,
  ended_at timestamptz,
  safe_point_latitude double precision,
  safe_point_longitude double precision,
  last_check_in text check (last_check_in in ('starting','okay','back','need_help')),
  last_check_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index adventure_safety_sessions_adventure_idx on public.adventure_safety_sessions(adventure_id, status);
create index adventure_safety_sessions_profile_idx on public.adventure_safety_sessions(profile_id, status);

create table public.adventure_safety_check_ins (
  id uuid primary key,
  session_id uuid not null references public.adventure_safety_sessions(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('starting','okay','back','need_help')),
  latitude double precision,
  longitude double precision,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  note text
);

create index adventure_safety_check_ins_adventure_idx on public.adventure_safety_check_ins(adventure_id, recorded_at desc);
create index adventure_safety_check_ins_session_idx on public.adventure_safety_check_ins(session_id, recorded_at desc);

alter table public.adventure_safety_sessions enable row level security;
alter table public.adventure_safety_check_ins enable row level security;

grant select, insert, update on public.adventure_safety_sessions to authenticated;
grant select, insert on public.adventure_safety_check_ins to authenticated;

create policy "Members read own safety sessions"
on public.adventure_safety_sessions for select
to authenticated
using ((select auth.uid()) = profile_id);

create policy "Event staff read safety sessions"
on public.adventure_safety_sessions for select
to authenticated
using (
  public.is_adventure_staff(adventure_id)
  or exists (
    select 1 from public.adventures a
    where a.id = adventure_safety_sessions.adventure_id
      and a.created_by = (select auth.uid())
  )
);

create policy "Members create own safety sessions"
on public.adventure_safety_sessions for insert
to authenticated
with check ((select auth.uid()) = profile_id);

create policy "Members update own safety sessions"
on public.adventure_safety_sessions for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

create policy "Members read own safety checkins"
on public.adventure_safety_check_ins for select
to authenticated
using ((select auth.uid()) = profile_id);

create policy "Event staff read safety checkins"
on public.adventure_safety_check_ins for select
to authenticated
using (
  public.is_adventure_staff(adventure_id)
  or exists (
    select 1 from public.adventures a
    where a.id = adventure_safety_check_ins.adventure_id
      and a.created_by = (select auth.uid())
  )
);

create policy "Members create own safety checkins"
on public.adventure_safety_check_ins for insert
to authenticated
with check (
  (select auth.uid()) = profile_id
  and exists (
    select 1 from public.adventure_safety_sessions s
    where s.id = adventure_safety_check_ins.session_id
      and s.profile_id = (select auth.uid())
      and s.adventure_id = adventure_safety_check_ins.adventure_id
  )
);
