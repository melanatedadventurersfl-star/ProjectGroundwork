create extension if not exists pgcrypto;

create type public.access_status as enum (
  'waitlisted', 'under_review', 'approved', 'invited', 'activated', 'paused', 'declined'
);

create type public.member_role as enum (
  'pilot_member', 'member', 'welcome_contact', 'operator', 'administrator'
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  experience_level text not null check (experience_level in ('new','beginner','comfortable','experienced')),
  interests text[] not null default '{}',
  attending_solo boolean not null default false,
  referral_source text,
  support_notes text,
  communication_consent boolean not null default false,
  communication_consent_at timestamptz,
  access_status public.access_status not null default 'waitlisted',
  cohort text,
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_roles (
  person_id uuid not null references public.people(id) on delete cascade,
  role public.member_role not null,
  granted_by uuid references public.people(id),
  granted_at timestamptz not null default now(),
  primary key (person_id, role)
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  venue_name text,
  venue_address text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  admission_cents integer not null default 0,
  lunch_cents integer,
  donation_enabled boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','updated','postponed','canceled','completed','archived')),
  published_version integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id),
  person_id uuid not null references public.people(id),
  is_newcomer boolean not null default false,
  lunch_selected boolean not null default false,
  lunch_payment_status text check (lunch_payment_status in ('not_selected','pending','paid','refunded')),
  donation_cents integer not null default 0,
  status text not null default 'registered' check (status in ('registered','confirmed','canceled','checked_in','late','no_show','walk_in')),
  welcome_contact_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experience_id, person_id)
);

create table public.access_status_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  from_status public.access_status,
  to_status public.access_status not null,
  actor_id uuid references public.people(id),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.people enable row level security;
alter table public.member_roles enable row level security;
alter table public.experiences enable row level security;
alter table public.registrations enable row level security;
alter table public.access_status_history enable row level security;

create policy "published experiences are public"
on public.experiences for select
using (status in ('published','updated','postponed','canceled','completed'));

-- Production policies for authenticated members and operators should be added
-- with helper functions that evaluate member_roles without exposing private rows.

insert into public.experiences (
  slug, title, summary, venue_name, venue_address, capacity,
  admission_cents, lunch_cents, donation_enabled, status
) values (
  'first-steps-castaway',
  'First Steps with MA: Marsh Walk & Picnic',
  'A beginner-friendly marsh walk and picnic for prospective and newly activated MA members.',
  'Castaway Island Preserve',
  '2921 San Pablo Road South, Jacksonville, FL 32224',
  20, 0, 1200, true, 'draft'
) on conflict (slug) do nothing;
