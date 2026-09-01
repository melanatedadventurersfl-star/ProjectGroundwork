create table public.host_library_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  scope text not null default 'personal' check (scope in ('system','organization','personal')),
  category text not null check (category in ('template','meal_plan','gear_list','guest_message','policy','vendor','marketing_sequence','ticket_structure')),
  title text not null,
  summary text not null default '',
  content jsonb not null default '{}'::jsonb,
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  source_event_id uuid references public.adventures(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'system' and owner_profile_id is null) or scope <> 'system')
);

create index host_library_items_category_idx on public.host_library_items(category);
create index host_library_items_owner_idx on public.host_library_items(owner_profile_id);
create index host_library_items_scope_idx on public.host_library_items(scope);

alter table public.host_library_items enable row level security;

revoke all on table public.host_library_items from anon, authenticated;
grant select, insert, update, delete on table public.host_library_items to authenticated;

create policy "Hosts can read reusable library" on public.host_library_items
for select to authenticated
using (
  is_active
  and (
    scope = 'system'
    or owner_profile_id = (select auth.uid())
    or (select is_platform_admin())
    or (select app_private.is_master_account())
  )
);

create policy "Hosts can create personal library items" on public.host_library_items
for insert to authenticated
with check (
  (
    scope = 'personal'
    and owner_profile_id = (select auth.uid())
  )
  or (select is_platform_admin())
  or (select app_private.is_master_account())
);

create policy "Hosts can update owned library items" on public.host_library_items
for update to authenticated
using (
  owner_profile_id = (select auth.uid())
  or (select is_platform_admin())
  or (select app_private.is_master_account())
)
with check (
  owner_profile_id = (select auth.uid())
  or (select is_platform_admin())
  or (select app_private.is_master_account())
);

create policy "Hosts can delete owned library items" on public.host_library_items
for delete to authenticated
using (
  owner_profile_id = (select auth.uid())
  or (select is_platform_admin())
  or (select app_private.is_master_account())
);

insert into public.host_library_items (item_key, scope, category, title, summary, content)
values
  ('system-weekend-camping-template','system','template','Weekend Camping','Reusable structure for a multi-day camping event.', jsonb_build_object('modules', jsonb_build_array('venue','ticketing','meals','gear','guest_comms','run_of_show','cleanup'), 'default_milestones', jsonb_build_array('Venue locked','Ticketing ready','Experience locked','Event ready'))),
  ('system-weekend-meal-plan','system','meal_plan','Weekend Camp Meal Plan','Friday arrival through Sunday breakfast meal structure.', jsonb_build_object('meals', jsonb_build_array('Friday arrival meal','Saturday breakfast','Saturday lunch','Saturday dinner','Sunday breakfast'))),
  ('system-camp-gear-list','system','gear_list','Core Camp Operations Gear','Reusable event operations packing categories.', jsonb_build_object('sections', jsonb_build_array('Shelter','Kitchen','Power','Lighting','Guest support','Safety','Cleanup'))),
  ('system-final-guest-message','system','guest_message','Final Guest Details','Pre-event message structure for arrival, parking, weather and what to bring.', jsonb_build_object('sections', jsonb_build_array('Arrival','Parking','What to bring','Weather','Meals','Contact'))),
  ('system-standard-refund-policy','system','policy','Refund & Transfer Policy Starter','Editable policy starter. Review before publishing to guests.', jsonb_build_object('status','starter','requires_review',true)),
  ('system-eight-week-marketing','system','marketing_sequence','8-Week Event Marketing Sequence','Relative marketing cadence leading into an event.', jsonb_build_object('relative_days', jsonb_build_array(-56,-42,-28,-21,-14,-7,-3,-1))),
  ('system-basic-ticket-structure','system','ticket_structure','Basic Event Ticket Structure','Starter structure for base admission plus optional add-ons.', jsonb_build_object('components', jsonb_build_array('Base admission','Additional attendee','Youth','Add-on'))),
  ('system-vendor-record','system','vendor','Vendor Record','Reusable vendor information checklist.', jsonb_build_object('fields', jsonb_build_array('Company','Contact','Phone','Email','Service','Arrival time','Payment status','Notes')))
on conflict (item_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  updated_at = now();
