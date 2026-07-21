create type public.notification_kind as enum ('readiness', 'announcement', 'emergency', 'registration', 'payment', 'community', 'system');
create type public.notification_priority as enum ('low', 'normal', 'high', 'critical');
create type public.delivery_channel as enum ('in_app', 'push', 'email', 'sms');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid references public.adventures(id) on delete cascade,
  title text not null,
  body text not null,
  kind public.notification_kind not null default 'announcement',
  priority public.notification_priority not null default 'normal',
  action_url text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint emergency_requires_critical check (kind <> 'emergency' or priority = 'critical')
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete cascade,
  announcement_id uuid references public.announcements(id) on delete cascade,
  readiness_task_id uuid references public.member_readiness_tasks(id) on delete cascade,
  kind public.notification_kind not null,
  priority public.notification_priority not null default 'normal',
  title text not null,
  body text not null,
  action_url text,
  dedupe_key text,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.delivery_channel not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  attempted_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "Members read announcements for registered adventures"
on public.announcements for select
using (
  adventure_id is null
  or exists (
    select 1 from public.orders o
    where o.adventure_id = announcements.adventure_id
      and o.purchaser_id = auth.uid()
      and o.status = 'paid'
  )
);

create policy "Members read their notifications"
on public.notifications for select
using (recipient_id = auth.uid());

create policy "Members update their notifications"
on public.notifications for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "Members read their delivery records"
on public.notification_deliveries for select
using (
  exists (
    select 1 from public.notifications n
    where n.id = notification_deliveries.notification_id
      and n.recipient_id = auth.uid()
  )
);

create or replace function public.mark_notification_read(notification_uuid uuid)
returns void
language sql
security invoker
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = notification_uuid
    and recipient_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security invoker
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid()
    and read_at is null;
$$;

create or replace function public.fan_out_announcement(announcement_uuid uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  created_count integer;
begin
  insert into public.notifications (
    recipient_id, adventure_id, announcement_id, kind, priority, title, body, action_url, dedupe_key
  )
  select distinct
    o.purchaser_id,
    a.adventure_id,
    a.id,
    a.kind,
    a.priority,
    a.title,
    a.body,
    a.action_url,
    'announcement:' || a.id::text || ':' || o.purchaser_id::text
  from public.announcements a
  join public.orders o on o.adventure_id = a.adventure_id and o.status = 'paid'
  where a.id = announcement_uuid
  on conflict (recipient_id, dedupe_key) do nothing;

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

create or replace function public.create_readiness_deadline_notifications()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  created_count integer;
begin
  insert into public.notifications (
    recipient_id, adventure_id, readiness_task_id, kind, priority, title, body, action_url, dedupe_key
  )
  select
    t.profile_id,
    t.adventure_id,
    t.id,
    'readiness',
    case when t.blocks_check_in then 'high'::public.notification_priority else 'normal'::public.notification_priority end,
    case when t.blocks_check_in then 'Action required before check-in' else 'Adventure task due soon' end,
    t.title,
    '/readiness/' || t.adventure_id::text,
    'readiness-due:' || t.id::text || ':' || to_char(t.due_at, 'YYYY-MM-DD')
  from public.member_readiness_tasks t
  where t.completed_at is null
    and t.due_at is not null
    and t.due_at between now() and now() + interval '48 hours'
  on conflict (recipient_id, dedupe_key) do nothing;

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id, read_at) where archived_at is null;
create index announcements_adventure_idx on public.announcements (adventure_id, starts_at desc);