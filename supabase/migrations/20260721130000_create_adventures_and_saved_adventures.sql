create type public.adventure_status as enum ('draft', 'scheduled', 'published', 'sold_out', 'cancelled', 'completed');
create type public.adventure_difficulty as enum ('easy', 'moderate', 'challenging');

create table public.adventures (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  description text not null,
  category text not null,
  difficulty public.adventure_difficulty not null default 'easy',
  status public.adventure_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  city text not null,
  state text not null,
  venue_name text,
  meeting_instructions text,
  hero_image_url text,
  capacity integer check (capacity is null or capacity > 0),
  spots_remaining integer check (spots_remaining is null or spots_remaining >= 0),
  starting_price_cents integer not null default 0 check (starting_price_cents >= 0),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adventures_valid_schedule check (ends_at > starts_at)
);

create table public.saved_adventures (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, adventure_id)
);

create index adventures_discovery_idx on public.adventures (status, starts_at);
create index adventures_category_idx on public.adventures (category);
create index adventures_location_idx on public.adventures (state, city);

create trigger adventures_set_updated_at
before update on public.adventures
for each row execute function public.set_updated_at();

alter table public.adventures enable row level security;
alter table public.saved_adventures enable row level security;

create policy "Published adventures are readable"
on public.adventures for select
using (status in ('published', 'sold_out', 'completed'));

create policy "Hosts may manage adventures"
on public.adventures for all
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "Members read their saved adventures"
on public.saved_adventures for select
using (profile_id = auth.uid());

create policy "Members save adventures"
on public.saved_adventures for insert
with check (profile_id = auth.uid());

create policy "Members remove saved adventures"
on public.saved_adventures for delete
using (profile_id = auth.uid());

create or replace view public.adventure_discovery as
select
  a.id,
  a.slug,
  a.title,
  a.summary,
  a.category,
  a.difficulty,
  a.status,
  a.starts_at,
  a.ends_at,
  a.city,
  a.state,
  a.venue_name,
  a.hero_image_url,
  a.capacity,
  a.spots_remaining,
  a.starting_price_cents,
  a.is_featured
from public.adventures a
where a.status in ('published', 'sold_out')
  and a.ends_at >= now();

grant select on public.adventure_discovery to authenticated;
