create type public.event_staff_role as enum ('lead', 'check_in', 'safety', 'transport', 'food', 'activity', 'general');
create type public.check_in_method as enum ('qr', 'manual', 'offline_sync');
create type public.incident_severity as enum ('low', 'moderate', 'high', 'critical');
create type public.incident_status as enum ('open', 'monitoring', 'resolved', 'escalated');

create table public.adventure_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.event_staff_role not null default 'general',
  station text,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (adventure_id, profile_id, role)
);

create table public.adventure_schedule_items (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.adventure_check_ins (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  attendee_id uuid not null references public.order_attendees(id) on delete cascade,
  checked_in_by uuid references public.profiles(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  method public.check_in_method not null,
  credential_code text,
  device_id text,
  offline_recorded_at timestamptz,
  notes text,
  unique (adventure_id, attendee_id)
);

create table public.adventure_headcounts (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  label text not null,
  expected_count integer,
  actual_count integer not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  notes text
);

create table public.adventure_incidents (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  reported_by uuid references public.profiles(id) on delete set null,
  severity public.incident_severity not null,
  status public.incident_status not null default 'open',
  occurred_at timestamptz not null,
  location text,
  title text not null,
  description text not null,
  people_involved text,
  actions_taken text,
  emergency_services_contacted boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger adventure_incidents_set_updated_at
before update on public.adventure_incidents
for each row execute function public.set_updated_at();

create or replace function public.is_adventure_staff(target_adventure uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.adventure_staff_assignments asa
    where asa.adventure_id = target_adventure and asa.profile_id = auth.uid()
  );
$$;

alter table public.adventure_staff_assignments enable row level security;
alter table public.adventure_schedule_items enable row level security;
alter table public.adventure_check_ins enable row level security;
alter table public.adventure_headcounts enable row level security;
alter table public.adventure_incidents enable row level security;

create policy "Adventure staff view assignments" on public.adventure_staff_assignments
for select using (profile_id = auth.uid() or public.is_adventure_staff(adventure_id));

create policy "Adventure staff manage operations" on public.adventure_staff_assignments
for all using (public.is_adventure_staff(adventure_id)) with check (public.is_adventure_staff(adventure_id));

create policy "Published schedules readable by booked members" on public.adventure_schedule_items
for select using (
  is_public and exists (
    select 1 from public.orders o
    where o.adventure_id = adventure_schedule_items.adventure_id
      and o.profile_id = auth.uid()
      and o.status = 'paid'
  )
  or public.is_adventure_staff(adventure_id)
);

create policy "Adventure staff manage schedules" on public.adventure_schedule_items
for all using (public.is_adventure_staff(adventure_id)) with check (public.is_adventure_staff(adventure_id));

create policy "Adventure staff manage checkins" on public.adventure_check_ins
for all using (public.is_adventure_staff(adventure_id)) with check (public.is_adventure_staff(adventure_id));

create policy "Adventure staff manage headcounts" on public.adventure_headcounts
for all using (public.is_adventure_staff(adventure_id)) with check (public.is_adventure_staff(adventure_id));

create policy "Adventure staff manage incidents" on public.adventure_incidents
for all using (public.is_adventure_staff(adventure_id)) with check (public.is_adventure_staff(adventure_id));

create or replace view public.adventure_roster as
select
  o.adventure_id,
  oa.id as attendee_id,
  oa.first_name,
  oa.last_name,
  oa.email,
  oa.phone,
  oi.ticket_type_id,
  tt.name as ticket_type_name,
  ec.code as credential_code,
  ac.checked_in_at,
  ac.method as check_in_method
from public.order_attendees oa
join public.order_items oi on oi.id = oa.order_item_id
join public.orders o on o.id = oi.order_id
join public.ticket_types tt on tt.id = oi.ticket_type_id
left join public.entry_credentials ec on ec.attendee_id = oa.id
left join public.adventure_check_ins ac on ac.attendee_id = oa.id and ac.adventure_id = o.adventure_id
where o.status = 'paid';