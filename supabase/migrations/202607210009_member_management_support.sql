create table public.member_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  community_digest boolean not null default true,
  adventure_reminders boolean not null default true,
  emergency_alerts boolean not null default true,
  preferred_units text not null default 'imperial' check (preferred_units in ('imperial','metric')),
  updated_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  category text not null check (category in ('account','booking','payment','accessibility','safety','technical','other')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','waiting_on_member','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger member_settings_set_updated_at before update on public.member_settings
for each row execute function public.set_updated_at();
create trigger support_requests_set_updated_at before update on public.support_requests
for each row execute function public.set_updated_at();

create or replace view public.member_ticket_wallet as
select
  o.profile_id,
  o.id as order_id,
  o.adventure_id,
  a.title as adventure_title,
  a.starts_at,
  a.city,
  a.state,
  oa.id as attendee_id,
  oa.first_name,
  oa.last_name,
  tc.code as credential_code,
  tc.status as credential_status,
  ac.checked_in_at
from public.orders o
join public.adventures a on a.id = o.adventure_id
join public.order_attendees oa on oa.order_id = o.id
left join public.ticket_credentials tc on tc.order_attendee_id = oa.id
left join public.attendee_checkins ac on ac.order_attendee_id = oa.id
where o.status = 'paid';

alter table public.member_settings enable row level security;
alter table public.support_requests enable row level security;
create policy "Members manage own settings" on public.member_settings for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "Members create own support requests" on public.support_requests for insert with check (profile_id = auth.uid());
create policy "Members read own support requests" on public.support_requests for select using (profile_id = auth.uid());
create policy "Members update open support requests" on public.support_requests for update using (profile_id = auth.uid() and status in ('open','waiting_on_member')) with check (profile_id = auth.uid());
