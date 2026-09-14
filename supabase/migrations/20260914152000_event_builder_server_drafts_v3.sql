-- Server-backed resumable drafts for the progressive event builder.

create table if not exists public.event_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  creation_key text not null,
  payload jsonb not null default '{}'::jsonb,
  event_id uuid references public.adventures(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  unique (creation_key, profile_id)
);

create index if not exists event_builder_drafts_org_updated_idx
  on public.event_builder_drafts(organization_id, updated_at desc);

alter table public.event_builder_drafts enable row level security;

drop policy if exists "Event managers view own builder draft" on public.event_builder_drafts;
create policy "Event managers view own builder draft"
on public.event_builder_drafts for select to authenticated
using (
  profile_id = auth.uid()
  and private.has_organization_permission(organization_id, 'events.manage')
);

drop policy if exists "Event managers manage own builder draft" on public.event_builder_drafts;
create policy "Event managers manage own builder draft"
on public.event_builder_drafts for all to authenticated
using (
  profile_id = auth.uid()
  and private.has_organization_permission(organization_id, 'events.manage')
)
with check (
  profile_id = auth.uid()
  and private.has_organization_permission(organization_id, 'events.manage')
);

grant select, insert, update, delete on public.event_builder_drafts to authenticated;

notify pgrst, 'reload schema';
