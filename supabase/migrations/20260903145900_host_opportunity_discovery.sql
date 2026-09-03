create table if not exists public.host_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text not null default '',
  source_id text not null default 'external',
  source_label text not null default 'External source',
  source_url text not null,
  source_event_id text,
  organizer_name text not null default '',
  organizer_profile_id uuid references public.profiles(id) on delete set null,
  verification_status text not null default 'external' check (verification_status in ('go_melanated_verified','platform_sourced','external')),
  relevance_label text check (relevance_label is null or relevance_label in ('melanated_led','melanated_focused','community_relevant')),
  relevance_basis text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  image_url text not null default '',
  ticket_url text not null default '',
  application_url text not null default '',
  vendor_fee_text text not null default '',
  application_deadline timestamptz,
  stage text not null default 'saved' check (stage in ('saved','discovered','reviewing','applied','approved','scheduled','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_profile_id, source_url)
);

alter table public.host_opportunities enable row level security;

drop policy if exists "Hosts read own opportunities" on public.host_opportunities;
create policy "Hosts read own opportunities" on public.host_opportunities
  for select to authenticated using (auth.uid() = owner_profile_id);

drop policy if exists "Hosts insert own opportunities" on public.host_opportunities;
create policy "Hosts insert own opportunities" on public.host_opportunities
  for insert to authenticated with check (auth.uid() = owner_profile_id and public.is_approved_outing_host(auth.uid()));

drop policy if exists "Hosts update own opportunities" on public.host_opportunities;
create policy "Hosts update own opportunities" on public.host_opportunities
  for update to authenticated using (auth.uid() = owner_profile_id) with check (auth.uid() = owner_profile_id);

drop policy if exists "Hosts delete own opportunities" on public.host_opportunities;
create policy "Hosts delete own opportunities" on public.host_opportunities
  for delete to authenticated using (auth.uid() = owner_profile_id);

create index if not exists host_opportunities_owner_stage_idx
  on public.host_opportunities(owner_profile_id, stage, created_at desc);
create index if not exists host_opportunities_deadline_idx
  on public.host_opportunities(owner_profile_id, application_deadline)
  where application_deadline is not null;
