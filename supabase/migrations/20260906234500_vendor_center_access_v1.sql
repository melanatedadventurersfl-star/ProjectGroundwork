create table if not exists public.vendor_center_access (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','needs_info','approved','paused','declined','revoked')),
  business_name text not null default '',
  category text not null default '',
  service_area text not null default '',
  application_note text not null default '',
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendor_center_access enable row level security;
grant select, insert, update on table public.vendor_center_access to authenticated;

create policy "Users can read own vendor access"
  on public.vendor_center_access for select to authenticated
  using (profile_id = (select auth.uid()) or (select is_platform_admin()));

create policy "Users can submit vendor applications"
  on public.vendor_center_access for insert to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending');

create policy "Users can update open vendor applications"
  on public.vendor_center_access for update to authenticated
  using (profile_id = (select auth.uid()) and status in ('pending','needs_info'))
  with check (profile_id = (select auth.uid()) and status in ('pending','needs_info'));

create policy "Platform admins can manage vendor access"
  on public.vendor_center_access for all to authenticated
  using ((select is_platform_admin()))
  with check ((select is_platform_admin()));

create or replace function public.is_approved_vendor(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendor_center_access
    where profile_id = p_profile_id
      and status = 'approved'
  );
$$;

grant execute on function public.is_approved_vendor(uuid) to authenticated;

insert into public.vendor_center_access (
  profile_id,
  status,
  business_name,
  category,
  service_area,
  application_note,
  applied_at,
  approved_at,
  updated_at
)
select
  owner_profile_id,
  'approved',
  business_name,
  category,
  coalesce(service_area, ''),
  'Existing owned vendor profile migrated to Vendor Center access.',
  created_at,
  coalesce(updated_at, created_at),
  now()
from public.host_vendor_profiles
where owner_profile_id is not null
  and coalesce(is_demo, false) = false
on conflict (profile_id) do nothing;

create index if not exists vendor_center_access_status_idx
  on public.vendor_center_access(status, applied_at desc);
