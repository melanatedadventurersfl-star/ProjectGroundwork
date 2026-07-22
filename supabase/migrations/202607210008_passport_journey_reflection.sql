create table public.passport_stamps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  icon_name text,
  category text not null default 'adventure',
  created_at timestamptz not null default now()
);

create table public.member_passport_stamps (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stamp_id uuid not null references public.passport_stamps(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete set null,
  earned_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  primary key (profile_id, stamp_id, adventure_id)
);

create table public.adventure_reflections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  highlight text,
  reflection text,
  visibility text not null default 'private' check (visibility in ('private','community')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, adventure_id)
);

create table public.reflection_media (
  id uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.adventure_reflections(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create trigger adventure_reflections_set_updated_at before update on public.adventure_reflections
for each row execute function public.set_updated_at();

create or replace view public.member_journey as
select
  o.profile_id,
  a.id as adventure_id,
  a.title,
  a.category,
  a.city,
  a.state,
  a.starts_at,
  a.ends_at,
  coalesce(max(ac.checked_in_at), o.paid_at) as experienced_at,
  r.rating,
  r.highlight,
  r.reflection,
  r.visibility,
  count(distinct mps.stamp_id) as stamp_count
from public.orders o
join public.adventures a on a.id = o.adventure_id
left join public.order_attendees oa on oa.order_id = o.id
left join public.attendee_checkins ac on ac.order_attendee_id = oa.id
left join public.adventure_reflections r on r.profile_id = o.profile_id and r.adventure_id = a.id
left join public.member_passport_stamps mps on mps.profile_id = o.profile_id and mps.adventure_id = a.id
where o.status = 'paid' and (a.ends_at < now() or ac.checked_in_at is not null)
group by o.profile_id, a.id, r.rating, r.highlight, r.reflection, r.visibility, o.paid_at;

alter table public.passport_stamps enable row level security;
alter table public.member_passport_stamps enable row level security;
alter table public.adventure_reflections enable row level security;
alter table public.reflection_media enable row level security;

create policy "Authenticated members read stamp catalog" on public.passport_stamps for select to authenticated using (true);
create policy "Members read own earned stamps" on public.member_passport_stamps for select using (profile_id = auth.uid());
create policy "Members read visible reflections" on public.adventure_reflections for select using (profile_id = auth.uid() or visibility = 'community');
create policy "Members create own reflections" on public.adventure_reflections for insert with check (profile_id = auth.uid());
create policy "Members update own reflections" on public.adventure_reflections for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "Members delete own reflections" on public.adventure_reflections for delete using (profile_id = auth.uid());
create policy "Members read reflection media" on public.reflection_media for select using (exists (select 1 from public.adventure_reflections r where r.id = reflection_id and (r.profile_id = auth.uid() or r.visibility = 'community')));
create policy "Members manage own reflection media" on public.reflection_media for all using (exists (select 1 from public.adventure_reflections r where r.id = reflection_id and r.profile_id = auth.uid())) with check (exists (select 1 from public.adventure_reflections r where r.id = reflection_id and r.profile_id = auth.uid()));
