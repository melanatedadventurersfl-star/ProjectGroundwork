create table public.host_campaign_meetings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  meeting_url text,
  status text not null default 'scheduled' check (status in ('scheduled','complete','cancelled')),
  notes text not null default '',
  recap text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.host_campaign_meeting_attendees (
  meeting_id uuid not null references public.host_campaign_meetings(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  response text not null default 'invited' check (response in ('invited','going','maybe','declined')),
  required boolean not null default true,
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (meeting_id, profile_id)
);

create table public.host_campaign_meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.host_campaign_meetings(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open','complete')),
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.host_campaign_tasks
  add column if not exists source_meeting_id uuid references public.host_campaign_meetings(id) on delete set null;

alter table public.host_campaign_decisions
  add column if not exists source_meeting_id uuid references public.host_campaign_meetings(id) on delete set null;

create index host_campaign_meetings_campaign_idx on public.host_campaign_meetings(campaign_id, starts_at);
create index host_campaign_meeting_attendees_profile_idx on public.host_campaign_meeting_attendees(profile_id);
create index host_campaign_meeting_agenda_idx on public.host_campaign_meeting_agenda_items(meeting_id, sort_order);
create index host_campaign_tasks_source_meeting_idx on public.host_campaign_tasks(source_meeting_id);
create index host_campaign_decisions_source_meeting_idx on public.host_campaign_decisions(source_meeting_id);

alter table public.host_campaign_meetings enable row level security;
alter table public.host_campaign_meeting_attendees enable row level security;
alter table public.host_campaign_meeting_agenda_items enable row level security;

revoke all on table public.host_campaign_meetings from anon, authenticated;
revoke all on table public.host_campaign_meeting_attendees from anon, authenticated;
revoke all on table public.host_campaign_meeting_agenda_items from anon, authenticated;

grant select, insert, update, delete on table public.host_campaign_meetings to authenticated;
grant select, insert, update, delete on table public.host_campaign_meeting_attendees to authenticated;
grant select, insert, update, delete on table public.host_campaign_meeting_agenda_items to authenticated;

create or replace function app_private.can_access_host_meeting(target_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.host_campaign_meetings m
    where m.id = target_meeting
      and app_private.can_access_host_campaign(m.campaign_id)
  );
$$;

create or replace function app_private.can_manage_host_meeting(target_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.host_campaign_meetings m
    where m.id = target_meeting
      and app_private.can_manage_host_campaign(m.campaign_id)
  );
$$;

revoke execute on function app_private.can_access_host_meeting(uuid) from public;
revoke execute on function app_private.can_manage_host_meeting(uuid) from public;
grant execute on function app_private.can_access_host_meeting(uuid) to authenticated;
grant execute on function app_private.can_manage_host_meeting(uuid) to authenticated;

create policy "Campaign staff can read meetings"
on public.host_campaign_meetings for select to authenticated
using ((select app_private.can_access_host_campaign(campaign_id)));

create policy "Campaign managers can create meetings"
on public.host_campaign_meetings for insert to authenticated
with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign managers can update meetings"
on public.host_campaign_meetings for update to authenticated
using ((select app_private.can_manage_host_campaign(campaign_id)))
with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign managers can delete meetings"
on public.host_campaign_meetings for delete to authenticated
using ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign staff can read meeting attendees"
on public.host_campaign_meeting_attendees for select to authenticated
using ((select app_private.can_access_host_meeting(meeting_id)));

create policy "Campaign managers can invite meeting attendees"
on public.host_campaign_meeting_attendees for insert to authenticated
with check ((select app_private.can_manage_host_meeting(meeting_id)));

create policy "Attendees can RSVP and managers can update attendees"
on public.host_campaign_meeting_attendees for update to authenticated
using (profile_id = (select auth.uid()) or (select app_private.can_manage_host_meeting(meeting_id)))
with check (profile_id = (select auth.uid()) or (select app_private.can_manage_host_meeting(meeting_id)));

create policy "Campaign managers can remove meeting attendees"
on public.host_campaign_meeting_attendees for delete to authenticated
using ((select app_private.can_manage_host_meeting(meeting_id)));

create policy "Campaign staff can read meeting agenda"
on public.host_campaign_meeting_agenda_items for select to authenticated
using ((select app_private.can_access_host_meeting(meeting_id)));

create policy "Campaign staff can add meeting agenda items"
on public.host_campaign_meeting_agenda_items for insert to authenticated
with check ((select app_private.can_access_host_meeting(meeting_id)) and created_by = (select auth.uid()));

create policy "Campaign staff can update meeting agenda items"
on public.host_campaign_meeting_agenda_items for update to authenticated
using ((select app_private.can_access_host_meeting(meeting_id)))
with check ((select app_private.can_access_host_meeting(meeting_id)));

create policy "Campaign managers can delete meeting agenda items"
on public.host_campaign_meeting_agenda_items for delete to authenticated
using ((select app_private.can_manage_host_meeting(meeting_id)));
