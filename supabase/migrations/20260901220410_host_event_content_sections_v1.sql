create table if not exists public.host_event_content_sections (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  section_type text not null check (section_type in ('schedule','meals','policies','operations','gear','guest_info','marketing')),
  content jsonb not null default '[]'::jsonb,
  source_import_id uuid references public.host_event_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adventure_id, section_type)
);

create index if not exists host_event_content_sections_owner_idx on public.host_event_content_sections(owner_profile_id, adventure_id);
create index if not exists host_event_content_sections_adventure_idx on public.host_event_content_sections(adventure_id, section_type);

alter table public.host_event_content_sections enable row level security;
revoke all on table public.host_event_content_sections from anon, authenticated;
grant select, insert, update, delete on table public.host_event_content_sections to authenticated;

create policy "Hosts read own event content" on public.host_event_content_sections
for select to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts create own event content" on public.host_event_content_sections
for insert to authenticated
with check (owner_profile_id = (select auth.uid()) and (select is_approved_outing_host(auth.uid())));

create policy "Hosts update own event content" on public.host_event_content_sections
for update to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()))
with check (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts delete own event content" on public.host_event_content_sections
for delete to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

insert into public.host_event_content_sections(owner_profile_id, adventure_id, section_type, content, source_import_id)
select distinct on (adventure_id) owner_profile_id, adventure_id, 'meals', approved_payload->'meals', id
from public.host_event_imports
where adventure_id is not null
  and jsonb_typeof(approved_payload->'meals') = 'array'
  and jsonb_array_length(approved_payload->'meals') > 0
order by adventure_id, created_at asc
on conflict (adventure_id, section_type) do nothing;

insert into public.host_event_content_sections(owner_profile_id, adventure_id, section_type, content, source_import_id)
select distinct on (adventure_id) owner_profile_id, adventure_id, 'policies', approved_payload->'policies', id
from public.host_event_imports
where adventure_id is not null
  and jsonb_typeof(approved_payload->'policies') = 'array'
  and jsonb_array_length(approved_payload->'policies') > 0
order by adventure_id, created_at asc
on conflict (adventure_id, section_type) do nothing;

insert into public.host_event_content_sections(owner_profile_id, adventure_id, section_type, content, source_import_id)
select distinct on (adventure_id) owner_profile_id, adventure_id, 'schedule', approved_payload->'schedule', id
from public.host_event_imports
where adventure_id is not null
  and jsonb_typeof(approved_payload->'schedule') = 'array'
  and jsonb_array_length(approved_payload->'schedule') > 0
order by adventure_id, created_at asc
on conflict (adventure_id, section_type) do nothing;
