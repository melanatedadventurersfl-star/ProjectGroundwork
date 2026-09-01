create table public.host_campaigns (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null unique references public.adventures(id) on delete cascade,
  slug text not null unique,
  title text not null,
  short_title text not null,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planning' check (status in ('planning','live','complete')),
  accent text not null default '#D7B45A',
  owner_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.host_campaign_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  task_key text not null,
  title text not null,
  category text not null,
  owner_label text not null default 'Unassigned',
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  due_label text not null default 'No due date',
  due_at timestamptz,
  status text not null default 'not_started' check (status in ('not_started','in_progress','waiting','blocked','review','complete')),
  priority text not null default 'normal' check (priority in ('critical','high','normal')),
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, task_key)
);

create table public.host_campaign_task_dependencies (
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  task_id uuid not null references public.host_campaign_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.host_campaign_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table public.host_campaign_milestones (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  milestone_key text not null,
  title text not null,
  weight integer not null check (weight between 0 and 100),
  complete boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, milestone_key)
);

create table public.host_campaign_decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  decision_key text not null,
  title text not null,
  owner_label text not null default 'Unassigned',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_label text not null default 'No due date',
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','decided')),
  decision_text text,
  decided_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, decision_key)
);

create index host_campaigns_owner_idx on public.host_campaigns(owner_profile_id);
create index host_campaigns_adventure_idx on public.host_campaigns(adventure_id);
create index host_campaign_tasks_campaign_idx on public.host_campaign_tasks(campaign_id);
create index host_campaign_tasks_assignee_idx on public.host_campaign_tasks(assignee_profile_id);
create index host_campaign_dependencies_campaign_idx on public.host_campaign_task_dependencies(campaign_id);
create index host_campaign_milestones_campaign_idx on public.host_campaign_milestones(campaign_id);
create index host_campaign_decisions_campaign_idx on public.host_campaign_decisions(campaign_id);
create index host_campaign_decisions_owner_idx on public.host_campaign_decisions(owner_profile_id);

alter table public.host_campaigns enable row level security;
alter table public.host_campaign_tasks enable row level security;
alter table public.host_campaign_task_dependencies enable row level security;
alter table public.host_campaign_milestones enable row level security;
alter table public.host_campaign_decisions enable row level security;

revoke all on table public.host_campaigns from anon, authenticated;
revoke all on table public.host_campaign_tasks from anon, authenticated;
revoke all on table public.host_campaign_task_dependencies from anon, authenticated;
revoke all on table public.host_campaign_milestones from anon, authenticated;
revoke all on table public.host_campaign_decisions from anon, authenticated;
grant select, insert, update, delete on table public.host_campaigns to authenticated;
grant select, insert, update, delete on table public.host_campaign_tasks to authenticated;
grant select, insert, update, delete on table public.host_campaign_task_dependencies to authenticated;
grant select, insert, update, delete on table public.host_campaign_milestones to authenticated;
grant select, insert, update, delete on table public.host_campaign_decisions to authenticated;

create or replace function app_private.can_access_host_campaign(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    app_private.is_master_account()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.platform_role = 'admin'
    )
    or exists (
      select 1 from public.host_campaigns c
      where c.id = target_campaign
        and (
          c.owner_profile_id = (select auth.uid())
          or exists (
            select 1 from public.adventure_staff_assignments asa
            where asa.adventure_id = c.adventure_id
              and asa.profile_id = (select auth.uid())
          )
        )
    )
  );
$$;

create or replace function app_private.can_manage_host_campaign(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    app_private.is_master_account()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.platform_role = 'admin'
    )
    or exists (
      select 1 from public.host_campaigns c
      where c.id = target_campaign
        and (
          c.owner_profile_id = (select auth.uid())
          or exists (
            select 1 from public.adventure_staff_assignments asa
            where asa.adventure_id = c.adventure_id
              and asa.profile_id = (select auth.uid())
              and asa.role = 'lead'
          )
        )
    )
  );
$$;

revoke execute on function app_private.can_access_host_campaign(uuid) from public;
revoke execute on function app_private.can_manage_host_campaign(uuid) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.can_access_host_campaign(uuid) to authenticated;
grant execute on function app_private.can_manage_host_campaign(uuid) to authenticated;

create policy "Campaign staff can read campaigns" on public.host_campaigns for select to authenticated using ((select app_private.can_access_host_campaign(id)));
create policy "Campaign managers can create campaigns" on public.host_campaigns for insert to authenticated with check (
  owner_profile_id = (select auth.uid()) and ((select is_platform_admin()) or exists (
    select 1 from public.adventures a where a.id = adventure_id and a.created_by = (select auth.uid())
  ))
);
create policy "Campaign managers can update campaigns" on public.host_campaigns for update to authenticated using ((select app_private.can_manage_host_campaign(id))) with check ((select app_private.can_manage_host_campaign(id)));
create policy "Campaign managers can delete campaigns" on public.host_campaigns for delete to authenticated using ((select app_private.can_manage_host_campaign(id)));

create policy "Campaign staff can read tasks" on public.host_campaign_tasks for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can create tasks" on public.host_campaign_tasks for insert to authenticated with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can update tasks" on public.host_campaign_tasks for update to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can delete tasks" on public.host_campaign_tasks for delete to authenticated using ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign staff can read dependencies" on public.host_campaign_task_dependencies for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can create dependencies" on public.host_campaign_task_dependencies for insert to authenticated with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can delete dependencies" on public.host_campaign_task_dependencies for delete to authenticated using ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign staff can read milestones" on public.host_campaign_milestones for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can create milestones" on public.host_campaign_milestones for insert to authenticated with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can update milestones" on public.host_campaign_milestones for update to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can delete milestones" on public.host_campaign_milestones for delete to authenticated using ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign staff can read decisions" on public.host_campaign_decisions for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can create decisions" on public.host_campaign_decisions for insert to authenticated with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can update decisions" on public.host_campaign_decisions for update to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));
create policy "Campaign managers can delete decisions" on public.host_campaign_decisions for delete to authenticated using ((select app_private.can_manage_host_campaign(campaign_id)));

with source_adventure as (
  select id, created_by, title, starts_at, ends_at from public.adventures
  where slug = 'great-melanated-little-camp-of-horrors-2026' limit 1
), campaign_insert as (
  insert into public.host_campaigns (adventure_id, slug, title, short_title, location, starts_at, ends_at, status, accent, owner_profile_id)
  select id, 'little-camp-of-horrors-2026', title, 'Little Camp of Horrors 2026', 'Florida Sand Music Ranch · Brooksville, FL', starts_at, ends_at, 'planning', '#E88633', created_by
  from source_adventure
  on conflict (adventure_id) do update set slug=excluded.slug,title=excluded.title,short_title=excluded.short_title,location=excluded.location,starts_at=excluded.starts_at,ends_at=excluded.ends_at,accent=excluded.accent,updated_at=now()
  returning id, owner_profile_id
)
insert into public.host_campaign_tasks (campaign_id, task_key, title, category, owner_label, due_label, status, priority, sort_order, created_by)
select c.id, x.task_key, x.title, x.category, x.owner_label, x.due_label, x.status, x.priority, x.sort_order, c.owner_profile_id
from campaign_insert c cross join (values
  ('decor-inventory','Confirm campground décor inventory','Decor & Production','Jonathan + Shannette','Needs follow-up','waiting','critical',10),
  ('decor-gaps','Identify décor gaps','Decor & Production','Unassigned','After inventory','blocked','high',20),
  ('ticket-policy','Finalize refund and transfer policy','Ticketing','Jonathan','This week','not_started','high',30),
  ('costume-categories','Finalize costume contest categories','Experience','Shannette','Open decision','not_started','normal',40),
  ('rule-drop','Prepare Tuesday Rule Drop','Marketing','Jonathan','Tuesday','in_progress','high',50),
  ('food-plan','Lock Saturday dinner menu','Food & Hospitality','Jonathan + Shannette','Complete','complete','normal',60)
) as x(task_key,title,category,owner_label,due_label,status,priority,sort_order)
on conflict (campaign_id, task_key) do nothing;

insert into public.host_campaign_milestones (campaign_id, milestone_key, title, weight, complete, sort_order)
select c.id, x.milestone_key, x.title, x.weight, x.complete, x.sort_order from public.host_campaigns c cross join (values
  ('venue','Venue locked',30,true,10),('ticketing','Ticketing ready',20,false,20),('experience','Experience locked',20,false,30),('operations','Event ready',30,false,40)
) as x(milestone_key,title,weight,complete,sort_order)
where c.slug='little-camp-of-horrors-2026' on conflict (campaign_id, milestone_key) do nothing;

insert into public.host_campaign_decisions (campaign_id, decision_key, title, owner_label, due_label, status, sort_order)
select c.id, x.decision_key, x.title, x.owner_label, x.due_label, 'open', x.sort_order from public.host_campaigns c cross join (values
  ('costume','Costume contest categories','Shannette','Sep 20',10),('checkin','Final check-in window','Jonathan','Before final attendee email',20)
) as x(decision_key,title,owner_label,due_label,sort_order)
where c.slug='little-camp-of-horrors-2026' on conflict (campaign_id, decision_key) do nothing;

insert into public.host_campaign_task_dependencies (campaign_id, task_id, depends_on_task_id)
select c.id, blocked.id, blocker.id from public.host_campaigns c
join public.host_campaign_tasks blocked on blocked.campaign_id=c.id and blocked.task_key='decor-gaps'
join public.host_campaign_tasks blocker on blocker.campaign_id=c.id and blocker.task_key='decor-inventory'
where c.slug='little-camp-of-horrors-2026' on conflict do nothing;
