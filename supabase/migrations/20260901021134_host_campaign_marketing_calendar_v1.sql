create table public.host_campaign_marketing_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  item_key text not null,
  title text not null,
  content_type text not null default 'post' check (content_type in ('post','static_post','carousel','reel','story','email','other')),
  platforms text[] not null default '{}',
  planned_for date not null,
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea','draft','ready','scheduled','published','skipped')),
  copy_text text,
  asset_url text,
  notes text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  source_task_id uuid references public.host_campaign_tasks(id) on delete set null,
  external_post_ids jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, item_key),
  check (platforms <@ array['facebook','instagram','meetup','eventbrite','email','other']::text[])
);

create index host_campaign_marketing_campaign_date_idx on public.host_campaign_marketing_items(campaign_id, planned_for);
create index host_campaign_marketing_owner_idx on public.host_campaign_marketing_items(owner_profile_id) where owner_profile_id is not null;
create index host_campaign_marketing_status_idx on public.host_campaign_marketing_items(campaign_id, status);

alter table public.host_campaign_marketing_items enable row level security;
revoke all on table public.host_campaign_marketing_items from anon, authenticated;
grant select, insert, update, delete on table public.host_campaign_marketing_items to authenticated;

create policy "Campaign staff can read marketing" on public.host_campaign_marketing_items
for select to authenticated
using ((select app_private.can_access_host_campaign(campaign_id)));

create policy "Campaign managers can create marketing" on public.host_campaign_marketing_items
for insert to authenticated
with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign managers can update marketing" on public.host_campaign_marketing_items
for update to authenticated
using ((select app_private.can_manage_host_campaign(campaign_id)))
with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign managers can delete marketing" on public.host_campaign_marketing_items
for delete to authenticated
using ((select app_private.can_manage_host_campaign(campaign_id)));

insert into public.host_campaign_marketing_items (
  campaign_id, item_key, title, content_type, platforms, planned_for, status,
  owner_profile_id, source_task_id, created_by
)
select c.id, 'rule-drop-2026-09-01', 'Tuesday Rule Drop', 'static_post',
       array['facebook','instagram']::text[], date '2026-09-01', 'draft',
       c.owner_profile_id, t.id, c.owner_profile_id
from public.host_campaigns c
left join public.host_campaign_tasks t
  on t.campaign_id = c.id and t.task_key = 'rule-drop'
where c.slug = 'little-camp-of-horrors-2026'
on conflict (campaign_id, item_key) do nothing;
