create table if not exists public.host_event_imports (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete set null,
  source_type text not null check (source_type in ('event_site','file_url','pasted_text','template')),
  source_label text not null default '',
  source_url text,
  source_library_item_id uuid references public.host_library_items(id) on delete set null,
  extracted_payload jsonb not null default '{}'::jsonb,
  approved_payload jsonb not null default '{}'::jsonb,
  status text not null default 'preview' check (status in ('preview','approved','created','cancelled','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists host_event_imports_owner_idx on public.host_event_imports(owner_profile_id, created_at desc);
create index if not exists host_event_imports_adventure_idx on public.host_event_imports(adventure_id) where adventure_id is not null;

alter table public.host_event_imports enable row level security;
revoke all on table public.host_event_imports from anon, authenticated;
grant select, insert, update, delete on table public.host_event_imports to authenticated;

create policy "Hosts read own event imports" on public.host_event_imports
for select to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts create own event imports" on public.host_event_imports
for insert to authenticated
with check (owner_profile_id = (select auth.uid()) and (select is_approved_outing_host(auth.uid())));

create policy "Hosts update own event imports" on public.host_event_imports
for update to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()))
with check (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts delete own event imports" on public.host_event_imports
for delete to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

update public.host_library_items
set content = jsonb_build_object(
  'modules', jsonb_build_array('venue','ticketing','meals','gear','guest_comms','run_of_show','cleanup'),
  'default_milestones', jsonb_build_array('Venue locked','Ticketing ready','Experience locked','Event ready'),
  'tasks', jsonb_build_array(
    jsonb_build_object('title','Confirm venue and rules','category','Venue','owner','Event owner','days_before',120,'priority','critical'),
    jsonb_build_object('title','Finalize ticket structure','category','Ticketing','owner','Event owner','days_before',90,'priority','high'),
    jsonb_build_object('title','Lock meal plan','category','Food','owner','Meals','days_before',30,'priority','high'),
    jsonb_build_object('title','Confirm gear and packing list','category','Gear','owner','Operations','days_before',14,'priority','normal'),
    jsonb_build_object('title','Send final guest details','category','Guests','owner','Guest support','days_before',3,'priority','high'),
    jsonb_build_object('title','Pack event equipment','category','Gear','owner','Operations','days_before',1,'priority','critical')
  )
), updated_at = now()
where item_key = 'system-weekend-camping-template';
