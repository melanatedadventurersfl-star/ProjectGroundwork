create extension if not exists pgcrypto;

create type public.member_status as enum ('pending', 'active', 'restricted', 'suspended');
create type public.household_role as enum ('owner', 'adult', 'dependent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  home_city text,
  home_state text,
  status public.member_status not null default 'pending',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null,
  can_manage_bookings boolean not null default false,
  can_manage_readiness boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "Profiles are readable by their owners"
on public.profiles for select
using (auth.uid() = id);

create policy "Profiles are editable by their owners"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Households are readable by members"
on public.households for select
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.profile_id = auth.uid()
  )
);

create policy "Households are creatable by authenticated users"
on public.households for insert
with check (auth.uid() = created_by);

create policy "Households are editable by owners"
on public.households for update
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.profile_id = auth.uid()
      and hm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.profile_id = auth.uid()
      and hm.role = 'owner'
  )
);

create policy "Household membership is readable by household members"
on public.household_members for select
using (
  exists (
    select 1
    from public.household_members self
    where self.household_id = household_members.household_id
      and self.profile_id = auth.uid()
  )
);

create policy "Household owners manage membership"
on public.household_members for all
using (
  exists (
    select 1
    from public.household_members owner_row
    where owner_row.household_id = household_members.household_id
      and owner_row.profile_id = auth.uid()
      and owner_row.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.household_members owner_row
    where owner_row.household_id = household_members.household_id
      and owner_row.profile_id = auth.uid()
      and owner_row.role = 'owner'
  )
);
