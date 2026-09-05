create table if not exists public.host_center_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  organization_name text,
  host_display_name text,
  city text,
  state text,
  contact_email text,
  website_url text,
  public_description text,
  public_profile_enabled boolean not null default true,
  working_areas text[] not null default '{}'::text[],
  intro_started_at timestamptz,
  intro_completed_at timestamptz,
  intro_last_step integer not null default 0 check (intro_last_step between 0 and 6),
  profile_reviewed_at timestamptz,
  organization_reviewed_at timestamptz,
  working_preferences_reviewed_at timestamptz,
  ai_privacy_reviewed_at timestamptz,
  notifications_reviewed_at timestamptz,
  connections_reviewed_at timestamptz,
  event_defaults_reviewed_at timestamptz,
  team_reviewed_at timestamptz,
  default_city text,
  default_state text,
  default_visibility text not null default 'public' check (default_visibility in ('public','private')),
  default_reminder_schedule jsonb not null default '[7,1,0]'::jsonb,
  default_cancellation_note text,
  default_waiver_preference text not null default 'ask' check (default_waiver_preference in ('ask','required','not_required')),
  last_host_destination text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.host_center_profiles enable row level security;

create policy "Hosts can read own Host Center profile"
on public.host_center_profiles
for select to authenticated
using (profile_id = auth.uid());

create policy "Hosts can create own Host Center profile"
on public.host_center_profiles
for insert to authenticated
with check (
  profile_id = auth.uid()
  and public.is_approved_outing_host(auth.uid())
);

create policy "Hosts can update own Host Center profile"
on public.host_center_profiles
for update to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and public.is_approved_outing_host(auth.uid())
);

create index if not exists host_center_profiles_intro_idx
on public.host_center_profiles (intro_completed_at);

comment on table public.host_center_profiles is
'Host Center first-run, setup checklist, preferences and safe return destination. This table does not grant host access.';
