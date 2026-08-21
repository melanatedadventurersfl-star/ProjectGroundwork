-- Go+ Phase 1: membership foundation + Adventure access controls

create table if not exists public.membership_plans (
  code text primary key,
  name text not null,
  description text,
  monthly_price_cents integer check (monthly_price_cents is null or monthly_price_cents >= 0),
  annual_price_cents integer check (annual_price_cents is null or annual_price_cents >= 0),
  is_active boolean not null default true,
  entitlements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.membership_plans (code, name, description, monthly_price_cents, annual_price_cents, entitlements)
values (
  'go_plus',
  'Go+',
  'Closer access to the Go Melanated community, Adventures, and member experiences.',
  1299,
  12900,
  '["priority_registration","member_only_adventures","premium_trip_early_access"]'::jsonb
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  annual_price_cents = excluded.annual_price_cents,
  entitlements = excluded.entitlements,
  is_active = true,
  updated_at = now();

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.membership_plans(code),
  status text not null default 'active' check (status in ('trialing','active','past_due','canceled','expired','complimentary')),
  billing_period text check (billing_period is null or billing_period in ('monthly','annual','complimentary')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists memberships_one_current_per_profile
  on public.memberships(profile_id)
  where status in ('trialing','active','past_due','complimentary');

create index if not exists memberships_profile_id_idx on public.memberships(profile_id);
create index if not exists memberships_status_idx on public.memberships(status);

alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;

drop policy if exists "membership plans are readable" on public.membership_plans;
create policy "membership plans are readable"
  on public.membership_plans for select
  to authenticated
  using (is_active = true);

drop policy if exists "members can read own membership" on public.memberships;
create policy "members can read own membership"
  on public.memberships for select
  to authenticated
  using (profile_id = auth.uid());

-- Billing writes are intentionally server-side only. No client insert/update/delete policies.

alter table public.adventures
  add column if not exists access_level text not null default 'public',
  add column if not exists go_plus_early_access_at timestamptz,
  add column if not exists public_registration_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'adventures_access_level_check'
  ) then
    alter table public.adventures
      add constraint adventures_access_level_check
      check (access_level in ('public','go_plus_only','go_plus_early_access'));
  end if;
end $$;

create or replace function public.has_active_membership(required_plan text default 'go_plus')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.plan_code = required_plan
      and m.status in ('trialing','active','complimentary')
      and (m.current_period_ends_at is null or m.current_period_ends_at > now())
  );
$$;

grant execute on function public.has_active_membership(text) to authenticated;

create or replace view public.member_membership_status as
select
  m.profile_id,
  m.plan_code,
  p.name as plan_name,
  m.status,
  m.billing_period,
  m.current_period_ends_at,
  m.cancel_at_period_end,
  p.entitlements
from public.memberships m
join public.membership_plans p on p.code = m.plan_code
where m.profile_id = auth.uid();

grant select on public.member_membership_status to authenticated;
