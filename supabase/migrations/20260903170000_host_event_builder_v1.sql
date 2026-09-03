create table public.host_event_components (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  component_key text not null,
  status text not null default 'added' check (status in ('added','needs_setup','ready','disabled')),
  settings jsonb not null default '{}'::jsonb,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, component_key)
);

create table public.host_event_finance_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  entry_type text not null check (entry_type in ('revenue','expense')),
  category text not null,
  description text not null,
  vendor_name text,
  estimated_cents integer not null default 0 check (estimated_cents >= 0),
  actual_cents integer not null default 0 check (actual_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  due_at timestamptz,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  payment_method text,
  receipt_url text,
  invoice_url text,
  notes text,
  source_type text not null default 'manual' check (source_type in ('manual','ticket','vendor','sponsor','integration')),
  source_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.host_vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  category text not null default 'Other',
  description text,
  contact_name text,
  email text,
  phone text,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  service_area text,
  brand_assets jsonb not null default '{}'::jsonb,
  documents jsonb not null default '{}'::jsonb,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.host_event_vendors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  vendor_profile_id uuid references public.host_vendor_profiles(id) on delete set null,
  manual_business_name text,
  status text not null default 'invited' check (status in ('invited','applied','pending','confirmed','declined','cancelled')),
  vendor_fee_cents integer not null default 0 check (vendor_fee_cents >= 0),
  vendor_fee_paid_cents integer not null default 0 check (vendor_fee_paid_cents >= 0),
  booth_size text,
  power_required boolean not null default false,
  water_required boolean not null default false,
  arrival_at timestamptz,
  event_details jsonb not null default '{}'::jsonb,
  document_status jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vendor_profile_id is not null or nullif(trim(manual_business_name), '') is not null)
);

create table public.host_communication_templates (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audience_type text not null,
  channel text not null default 'email' check (channel in ('email','push','sms','in_app')),
  subject text,
  body text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.host_event_communications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.host_campaigns(id) on delete cascade,
  template_id uuid references public.host_communication_templates(id) on delete set null,
  communication_key text not null,
  name text not null,
  audience_type text not null,
  channel text not null default 'email' check (channel in ('email','push','sms','in_app')),
  trigger_type text not null default 'relative' check (trigger_type in ('immediate','relative','scheduled','condition')),
  days_offset integer,
  scheduled_at timestamptz,
  condition_key text,
  status text not null default 'draft' check (status in ('draft','scheduled','paused','sent','cancelled')),
  subject_override text,
  body_override text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, communication_key)
);

create index host_event_components_campaign_idx on public.host_event_components(campaign_id);
create index host_event_finance_campaign_idx on public.host_event_finance_entries(campaign_id);
create index host_event_finance_type_idx on public.host_event_finance_entries(campaign_id, entry_type);
create index host_event_vendors_campaign_idx on public.host_event_vendors(campaign_id);
create index host_vendor_profiles_owner_idx on public.host_vendor_profiles(owner_profile_id);
create index host_event_communications_campaign_idx on public.host_event_communications(campaign_id);

alter table public.host_event_components enable row level security;
alter table public.host_event_finance_entries enable row level security;
alter table public.host_vendor_profiles enable row level security;
alter table public.host_event_vendors enable row level security;
alter table public.host_communication_templates enable row level security;
alter table public.host_event_communications enable row level security;

grant select, insert, update, delete on table public.host_event_components to authenticated;
grant select, insert, update, delete on table public.host_event_finance_entries to authenticated;
grant select, insert, update, delete on table public.host_vendor_profiles to authenticated;
grant select, insert, update, delete on table public.host_event_vendors to authenticated;
grant select, insert, update, delete on table public.host_communication_templates to authenticated;
grant select, insert, update, delete on table public.host_event_communications to authenticated;

create policy "Campaign staff can read event components" on public.host_event_components for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can manage event components" on public.host_event_components for all to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Campaign staff can read event finances" on public.host_event_finance_entries for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can manage event finances" on public.host_event_finance_entries for all to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Authenticated users can read vendor profiles" on public.host_vendor_profiles for select to authenticated using (true);
create policy "Vendor owners and admins can create vendor profiles" on public.host_vendor_profiles for insert to authenticated with check (created_by = (select auth.uid()) or owner_profile_id = (select auth.uid()) or (select is_platform_admin()));
create policy "Vendor owners and admins can update vendor profiles" on public.host_vendor_profiles for update to authenticated using (owner_profile_id = (select auth.uid()) or created_by = (select auth.uid()) or (select is_platform_admin())) with check (owner_profile_id = (select auth.uid()) or created_by = (select auth.uid()) or (select is_platform_admin()));
create policy "Vendor owners and admins can delete vendor profiles" on public.host_vendor_profiles for delete to authenticated using (owner_profile_id = (select auth.uid()) or created_by = (select auth.uid()) or (select is_platform_admin()));

create policy "Campaign staff can read event vendors" on public.host_event_vendors for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can manage event vendors" on public.host_event_vendors for all to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));

create policy "Owners can read communication templates" on public.host_communication_templates for select to authenticated using (owner_profile_id = (select auth.uid()) or is_system or (select is_platform_admin()));
create policy "Owners can manage communication templates" on public.host_communication_templates for all to authenticated using (owner_profile_id = (select auth.uid()) or (select is_platform_admin())) with check (owner_profile_id = (select auth.uid()) or (select is_platform_admin()));

create policy "Campaign staff can read event communications" on public.host_event_communications for select to authenticated using ((select app_private.can_access_host_campaign(campaign_id)));
create policy "Campaign managers can manage event communications" on public.host_event_communications for all to authenticated using ((select app_private.can_manage_host_campaign(campaign_id))) with check ((select app_private.can_manage_host_campaign(campaign_id)));
