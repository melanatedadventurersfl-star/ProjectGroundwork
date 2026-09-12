create table if not exists public.trail_guide_place_profiles (
  place_id text primary key,
  display_name text not null,
  category text,
  operator_name text,
  address text,
  city text,
  state text,
  country text not null default 'US',
  completeness_score integer not null default 0 check (completeness_score between 0 and 100),
  is_published boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trail_guide_sources (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  source_type text not null check (source_type in ('official_website','official_rules','reservation','api','admin','community')),
  source_name text not null,
  source_url text not null,
  source_date date,
  priority integer not null default 50 check (priority between 0 and 100),
  status text not null default 'active' check (status in ('active','failed','retired')),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, source_url)
);

create table if not exists public.trail_guide_facts (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  source_id uuid not null references public.trail_guide_sources(id) on delete cascade,
  field_key text not null,
  value jsonb not null,
  value_type text not null check (value_type in ('boolean','number','string','string_array')),
  evidence_text text,
  confidence text not null default 'explicit' check (confidence in ('explicit','partial','community')),
  is_current boolean not null default false,
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, source_id, field_key)
);

create table if not exists public.trail_guide_conflicts (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  field_key text not null,
  candidate_fact_ids uuid[] not null default '{}',
  recommended_fact_id uuid references public.trail_guide_facts(id) on delete set null,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, field_key)
);

create table if not exists public.trail_guide_reports (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  campsite_label text,
  report jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  reported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trail_guide_sources_place_idx
  on public.trail_guide_sources (place_id, status, priority desc);
create index if not exists trail_guide_facts_current_idx
  on public.trail_guide_facts (place_id, is_current, field_key);
create index if not exists trail_guide_conflicts_status_idx
  on public.trail_guide_conflicts (place_id, status);
create index if not exists trail_guide_reports_place_idx
  on public.trail_guide_reports (place_id, status, reported_at desc);

alter table public.trail_guide_place_profiles enable row level security;
alter table public.trail_guide_sources enable row level security;
alter table public.trail_guide_facts enable row level security;
alter table public.trail_guide_conflicts enable row level security;
alter table public.trail_guide_reports enable row level security;

drop policy if exists "Members read published Trail Guide profiles" on public.trail_guide_place_profiles;
create policy "Members read published Trail Guide profiles"
on public.trail_guide_place_profiles for select
to authenticated
using (is_published = true or public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide profiles" on public.trail_guide_place_profiles;
create policy "Admins manage Trail Guide profiles"
on public.trail_guide_place_profiles for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Members read active Trail Guide sources" on public.trail_guide_sources;
create policy "Members read active Trail Guide sources"
on public.trail_guide_sources for select
to authenticated
using (status = 'active' or public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide sources" on public.trail_guide_sources;
create policy "Admins manage Trail Guide sources"
on public.trail_guide_sources for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Members read current Trail Guide facts" on public.trail_guide_facts;
create policy "Members read current Trail Guide facts"
on public.trail_guide_facts for select
to authenticated
using (is_current = true or public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide facts" on public.trail_guide_facts;
create policy "Admins manage Trail Guide facts"
on public.trail_guide_facts for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Admins read Trail Guide conflicts" on public.trail_guide_conflicts;
create policy "Admins read Trail Guide conflicts"
on public.trail_guide_conflicts for select
to authenticated
using (public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide conflicts" on public.trail_guide_conflicts;
create policy "Admins manage Trail Guide conflicts"
on public.trail_guide_conflicts for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Members read accepted Trail Guide reports" on public.trail_guide_reports;
create policy "Members read accepted Trail Guide reports"
on public.trail_guide_reports for select
to authenticated
using (status = 'accepted' or profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Members submit Trail Guide reports" on public.trail_guide_reports;
create policy "Members submit Trail Guide reports"
on public.trail_guide_reports for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists "Members edit pending Trail Guide reports" on public.trail_guide_reports;
create policy "Members edit pending Trail Guide reports"
on public.trail_guide_reports for update
to authenticated
using (profile_id = auth.uid() and status = 'pending')
with check (profile_id = auth.uid() and status = 'pending');

drop policy if exists "Admins manage Trail Guide reports" on public.trail_guide_reports;
create policy "Admins manage Trail Guide reports"
on public.trail_guide_reports for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select, insert, update, delete on public.trail_guide_place_profiles to authenticated;
grant select, insert, update, delete on public.trail_guide_sources to authenticated;
grant select, insert, update, delete on public.trail_guide_facts to authenticated;
grant select, insert, update, delete on public.trail_guide_conflicts to authenticated;
grant select, insert, update, delete on public.trail_guide_reports to authenticated;

comment on table public.trail_guide_place_profiles is
  'Structured enrichment records for static Trail Guide destinations. place_id matches apps/mobile/src/trailGuide/catalog.ts.';
comment on table public.trail_guide_sources is
  'Official/API/admin/community sources used to prove Trail Guide facts. One destination can have several sources.';
comment on table public.trail_guide_facts is
  'Source-backed Trail Guide facts. is_current marks the winning value after source-priority reconciliation.';
comment on table public.trail_guide_conflicts is
  'Conflicting source-backed values that require admin review or an explicit resolution.';
comment on table public.trail_guide_reports is
  'Structured member observations kept separate from official Trail Guide facts.';

insert into public.trail_guide_place_profiles (
  place_id, display_name, category, operator_name, address, city, state,
  completeness_score, is_published, last_verified_at
)
values (
  'huguenot-memorial-park',
  'Huguenot Memorial Park',
  'Camping',
  'City of Jacksonville',
  '10980 Heckscher Drive, Jacksonville, FL 32226',
  'Jacksonville',
  'FL',
  88,
  true,
  now()
)
on conflict (place_id) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  operator_name = excluded.operator_name,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  completeness_score = greatest(public.trail_guide_place_profiles.completeness_score, excluded.completeness_score),
  is_published = true,
  updated_at = now();

insert into public.trail_guide_sources (
  place_id, source_type, source_name, source_url, source_date, priority, status, last_checked_at
)
values
  (
    'huguenot-memorial-park',
    'official_website',
    'City of Jacksonville · Huguenot Memorial Park',
    'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/huguenot-memorial-park',
    null,
    90,
    'active',
    now()
  ),
  (
    'huguenot-memorial-park',
    'official_rules',
    'City of Jacksonville · Huguenot Campground Rules',
    'https://www.jacksonville.gov/getmedia/acce064d-07b5-442c-8e77-c38b8bd184b6/Huguenot-Rules-Revised-4-21-26_1.pdf',
    '2026-04-21',
    95,
    'active',
    now()
  ),
  (
    'huguenot-memorial-park',
    'reservation',
    'City of Jacksonville · Huguenot Campsite Reservations',
    'https://fljacksonweb.myvscloud.com/webtrac/web/search.html?module=RN&primarycode=Huguenot%20Campsites',
    null,
    85,
    'active',
    now()
  )
on conflict (place_id, source_url) do update set
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  source_date = excluded.source_date,
  priority = excluded.priority,
  status = 'active',
  updated_at = now();

with rules_source as (
  select id
  from public.trail_guide_sources
  where place_id = 'huguenot-memorial-park'
    and source_type = 'official_rules'
  order by priority desc
  limit 1
),
seed(field_key, value, value_type, evidence_text) as (
  values
    ('electric.available', 'true'::jsonb, 'boolean', 'Electrical service is listed for every campsite.'),
    ('electric.scope', to_jsonb('all_sites'::text), 'string', 'Electrical service applies to all campsites.'),
    ('electric.amps', '["30","50"]'::jsonb, 'string_array', 'Campground rules list 30A and 50A electrical service plus standard 110V service.'),
    ('water.hookup', 'false'::jsonb, 'boolean', 'Individual campsites do not have water hookups.'),
    ('water.potable_central', 'true'::jsonb, 'boolean', 'Potable water is available from a centralized campground location.'),
    ('sewer.hookup', 'false'::jsonb, 'boolean', 'Individual campsites do not have sewer hookups.'),
    ('dump_station.available', 'true'::jsonb, 'boolean', 'Dump station service is available.'),
    ('camping.tent', 'true'::jsonb, 'boolean', 'Tent camping is permitted.'),
    ('camping.rv', 'true'::jsonb, 'boolean', 'RV camping is permitted.'),
    ('occupancy.max_people', '6'::jsonb, 'number', 'Campsites are limited to six people.'),
    ('parking.included_passes', '2'::jsonb, 'number', 'Two parking passes are included with a campsite.'),
    ('check_in.time', to_jsonb('1:00 PM'::text), 'string', 'Campground check-in begins at 1:00 PM.'),
    ('check_out.time', to_jsonb('12:00 PM'::text), 'string', 'Campground check-out is noon.'),
    ('quiet_hours.range', to_jsonb('10:00 PM–7:00 AM'::text), 'string', 'Quiet hours run from 10:00 PM to 7:00 AM.'),
    ('generators.off_during_quiet_hours', 'true'::jsonb, 'boolean', 'Generators must be off during quiet hours.'),
    ('fires.rings_only', 'true'::jsonb, 'boolean', 'Campfires are limited to designated fire rings.'),
    ('pets.allowed', 'true'::jsonb, 'boolean', 'Registered campers may bring pets under campground rules.'),
    ('pets.max_per_site', '3'::jsonb, 'number', 'A campsite may have up to three pets.'),
    ('pets.fee', '5.38'::jsonb, 'number', 'The rules list a $5.38 pet fee per pet per stay.'),
    ('pets.shoreline_allowed', 'false'::jsonb, 'boolean', 'Pets are not permitted on the shoreline.'),
    ('amenities.showers', 'true'::jsonb, 'boolean', 'Showers are available to campers.'),
    ('amenities.restrooms', 'true'::jsonb, 'boolean', 'Restrooms are available to campers.'),
    ('amenities.picnic_tables', 'true'::jsonb, 'boolean', 'Campsites include picnic-table use under campground rules.'),
    ('accessibility.ada_sites', '["X","Z"]'::jsonb, 'string_array', 'ADA campsites are identified as sites X and Z.'),
    ('stay_limit.tent_days', '14'::jsonb, 'number', 'Tent stays are limited to 14 days in a 45-day period.'),
    ('stay_limit.rv_days', '30'::jsonb, 'number', 'RV stays are limited to 30 days in a 45-day period.'),
    ('stay_limit.window_days', '45'::jsonb, 'number', 'Campground stay limits are measured within a 45-day period.'),
    ('alcohol.allowed', 'false'::jsonb, 'boolean', 'Alcohol is prohibited by campground rules.'),
    ('hammocks.on_trees_allowed', 'false'::jsonb, 'boolean', 'Hammocks may not be attached to trees.'),
    ('vehicles.golf_carts_atvs_utvs_allowed', 'false'::jsonb, 'boolean', 'Golf carts, ATVs, and UTVs are not permitted.')
)
insert into public.trail_guide_facts (
  place_id, source_id, field_key, value, value_type, evidence_text,
  confidence, is_current, verified_at
)
select
  'huguenot-memorial-park',
  rules_source.id,
  seed.field_key,
  seed.value,
  seed.value_type,
  seed.evidence_text,
  'explicit',
  true,
  now()
from rules_source
cross join seed
on conflict (place_id, source_id, field_key) do update set
  value = excluded.value,
  value_type = excluded.value_type,
  evidence_text = excluded.evidence_text,
  confidence = excluded.confidence,
  is_current = true,
  verified_at = now(),
  updated_at = now();

with website_source as (
  select id
  from public.trail_guide_sources
  where place_id = 'huguenot-memorial-park'
    and source_type = 'official_website'
  order by priority desc
  limit 1
),
seed(field_key, value, value_type, evidence_text) as (
  values
    ('pricing.tent_total', '22.70'::jsonb, 'number', 'The City page lists the tent rate including tax.'),
    ('pricing.rv_total', '27.24'::jsonb, 'number', 'The City page lists the RV rate including tax.'),
    ('pricing.currency', to_jsonb('USD'::text), 'string', 'Published campground rates are in U.S. dollars.'),
    ('reservations.available', 'true'::jsonb, 'boolean', 'The City provides campsite reservation options.'),
    ('activities.swimming', 'true'::jsonb, 'boolean', 'Swimming is listed as a park activity, at the visitor’s own risk.'),
    ('activities.fishing', 'true'::jsonb, 'boolean', 'Fishing is listed as a park activity.'),
    ('activities.surfing', 'true'::jsonb, 'boolean', 'Surfing is listed as a park activity.'),
    ('activities.hiking', 'true'::jsonb, 'boolean', 'Hiking is listed as a park activity.'),
    ('activities.birding', 'true'::jsonb, 'boolean', 'Birding and wildlife viewing are available.'),
    ('launch.nonmotorized', 'true'::jsonb, 'boolean', 'Nonmotorized water access is available.'),
    ('launch.boat', 'true'::jsonb, 'boolean', 'Boat-launch access is available.'),
    ('amenities.playground', 'true'::jsonb, 'boolean', 'A playground is listed among park amenities.'),
    ('amenities.concession', 'true'::jsonb, 'boolean', 'A concession operation is listed for the park.'),
    ('beach_driving.four_wheel_drive_recommended', 'true'::jsonb, 'boolean', 'Four-wheel drive is strongly recommended for soft Atlantic-side sand.')
)
insert into public.trail_guide_facts (
  place_id, source_id, field_key, value, value_type, evidence_text,
  confidence, is_current, verified_at
)
select
  'huguenot-memorial-park',
  website_source.id,
  seed.field_key,
  seed.value,
  seed.value_type,
  seed.evidence_text,
  'explicit',
  true,
  now()
from website_source
cross join seed
on conflict (place_id, source_id, field_key) do update set
  value = excluded.value,
  value_type = excluded.value_type,
  evidence_text = excluded.evidence_text,
  confidence = excluded.confidence,
  is_current = true,
  verified_at = now(),
  updated_at = now();

with reservation_source as (
  select id
  from public.trail_guide_sources
  where place_id = 'huguenot-memorial-park'
    and source_type = 'reservation'
  order by priority desc
  limit 1
),
seed(field_key, value, value_type, evidence_text) as (
  values
    ('pricing.tent_base', '20'::jsonb, 'number', 'The reservation system lists the tent camping base rate before tax.'),
    ('pricing.rv_base', '24'::jsonb, 'number', 'The reservation system lists the RV camping base rate before tax.')
)
insert into public.trail_guide_facts (
  place_id, source_id, field_key, value, value_type, evidence_text,
  confidence, is_current, verified_at
)
select
  'huguenot-memorial-park',
  reservation_source.id,
  seed.field_key,
  seed.value,
  seed.value_type,
  seed.evidence_text,
  'explicit',
  true,
  now()
from reservation_source
cross join seed
on conflict (place_id, source_id, field_key) do update set
  value = excluded.value,
  value_type = excluded.value_type,
  evidence_text = excluded.evidence_text,
  confidence = excluded.confidence,
  is_current = true,
  verified_at = now(),
  updated_at = now();
