-- Host Communications + Capacity V1.2

create table if not exists public.adventure_waitlist (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','offered','claimed','expired','removed')),
  position integer,
  offered_at timestamptz,
  claim_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adventure_id, profile_id)
);

create index if not exists adventure_waitlist_queue_idx
  on public.adventure_waitlist (adventure_id, status, created_at);

create table if not exists public.host_outing_messages (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  audience text not null default 'registered' check (audience in ('registered','checked_in','waitlist')),
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists host_outing_messages_adventure_idx
  on public.host_outing_messages (adventure_id, sent_at desc);

create table if not exists public.adventure_registration_questions (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  label text not null,
  help_text text,
  question_type text not null default 'text' check (question_type in ('text','yes_no','choice')),
  required boolean not null default false,
  options jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adventure_registration_questions_idx
  on public.adventure_registration_questions (adventure_id, is_active, sort_order);

alter table public.adventure_waitlist enable row level security;
alter table public.host_outing_messages enable row level security;
alter table public.adventure_registration_questions enable row level security;

create policy "Members manage their waitlist entries"
on public.adventure_waitlist for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Hosts read waitlists for their outings"
on public.adventure_waitlist for select
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

create policy "Hosts manage waitlists for their outings"
on public.adventure_waitlist for update
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

create policy "Hosts manage outing messages"
on public.host_outing_messages for all
using (
  host_id = auth.uid()
  and exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
)
with check (
  host_id = auth.uid()
  and exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

create policy "Hosts manage registration questions"
on public.adventure_registration_questions for all
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

create policy "Members read active registration questions"
on public.adventure_registration_questions for select
using (
  is_active = true
  and exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.status in ('published','sold_out')
  )
);

grant select, insert, update on public.adventure_waitlist to authenticated;
grant select, insert on public.host_outing_messages to authenticated;
grant select, insert, update, delete on public.adventure_registration_questions to authenticated;

create or replace function public.join_adventure_waitlist(p_adventure_id uuid)
returns public.adventure_waitlist
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.adventure_waitlist;
  next_position integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (
    select 1 from public.adventures a
    where a.id = p_adventure_id and a.status in ('published','sold_out')
  ) then raise exception 'Outing is not accepting a waitlist'; end if;

  select coalesce(max(position), 0) + 1 into next_position
  from public.adventure_waitlist
  where adventure_id = p_adventure_id and status in ('waiting','offered');

  insert into public.adventure_waitlist (adventure_id, profile_id, status, position)
  values (p_adventure_id, auth.uid(), 'waiting', next_position)
  on conflict (adventure_id, profile_id) do update set
    status = 'waiting',
    position = excluded.position,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.join_adventure_waitlist(uuid) to authenticated;
