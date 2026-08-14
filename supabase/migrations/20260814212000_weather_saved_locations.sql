create table if not exists public.weather_saved_locations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  region text,
  country text,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  unique (profile_id, latitude, longitude)
);

alter table public.weather_saved_locations enable row level security;

create policy "Members can view own saved weather locations"
  on public.weather_saved_locations
  for select
  using (auth.uid() = profile_id);

create policy "Members can add own saved weather locations"
  on public.weather_saved_locations
  for insert
  with check (auth.uid() = profile_id);

create policy "Members can delete own saved weather locations"
  on public.weather_saved_locations
  for delete
  using (auth.uid() = profile_id);

create index if not exists weather_saved_locations_profile_created_idx
  on public.weather_saved_locations (profile_id, created_at desc);
