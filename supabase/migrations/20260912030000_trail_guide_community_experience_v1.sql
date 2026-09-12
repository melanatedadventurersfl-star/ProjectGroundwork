create table if not exists public.trail_guide_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text check (char_length(review_text) <= 2000),
  camping_type text check (camping_type in ('tent','rv','cabin','day_visit','other')),
  campsite_label text check (char_length(campsite_label) <= 80),
  visit_date date,
  category_ratings jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('published','hidden','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, profile_id, visit_date)
);

create table if not exists public.trail_guide_photos (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.trail_guide_reviews(id) on delete set null,
  storage_path text not null unique,
  category text not null default 'other' check (category in ('campsite','bathroom','beach','trail','rv_site','tent_site','facilities','activities','other')),
  campsite_label text check (char_length(campsite_label) <= 80),
  caption text check (char_length(caption) <= 500),
  visit_date date,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  moderation_source text,
  moderation_model text,
  moderation_score double precision,
  moderation_reason text,
  moderation_categories jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  feature_eligible boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trail_guide_reviews_place_idx
  on public.trail_guide_reviews (place_id, status, created_at desc);
create index if not exists trail_guide_photos_place_idx
  on public.trail_guide_photos (place_id, moderation_status, featured desc, created_at desc);
create index if not exists trail_guide_photos_profile_idx
  on public.trail_guide_photos (profile_id, created_at desc);

alter table public.trail_guide_reviews enable row level security;
alter table public.trail_guide_photos enable row level security;

drop policy if exists "Members read published Trail Guide reviews" on public.trail_guide_reviews;
create policy "Members read published Trail Guide reviews"
on public.trail_guide_reviews for select
to authenticated
using (status = 'published' or profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Members create Trail Guide reviews" on public.trail_guide_reviews;
create policy "Members create Trail Guide reviews"
on public.trail_guide_reviews for insert
to authenticated
with check (profile_id = auth.uid());

drop policy if exists "Members edit own Trail Guide reviews" on public.trail_guide_reviews;
create policy "Members edit own Trail Guide reviews"
on public.trail_guide_reviews for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "Members delete own Trail Guide reviews" on public.trail_guide_reviews;
create policy "Members delete own Trail Guide reviews"
on public.trail_guide_reviews for delete
to authenticated
using (profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Members read approved Trail Guide photos" on public.trail_guide_photos;
create policy "Members read approved Trail Guide photos"
on public.trail_guide_photos for select
to authenticated
using (moderation_status = 'approved' or profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Members create Trail Guide photos" on public.trail_guide_photos;
create policy "Members create Trail Guide photos"
on public.trail_guide_photos for insert
to authenticated
with check (profile_id = auth.uid() and moderation_status = 'pending');

drop policy if exists "Members edit own pending Trail Guide photos" on public.trail_guide_photos;
create policy "Members edit own pending Trail Guide photos"
on public.trail_guide_photos for update
to authenticated
using (profile_id = auth.uid() and moderation_status = 'pending')
with check (profile_id = auth.uid());

drop policy if exists "Members delete own Trail Guide photos" on public.trail_guide_photos;
create policy "Members delete own Trail Guide photos"
on public.trail_guide_photos for delete
to authenticated
using (profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide photos" on public.trail_guide_photos;
create policy "Admins manage Trail Guide photos"
on public.trail_guide_photos for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select, insert, update, delete on public.trail_guide_reviews to authenticated;
grant select, insert, update, delete on public.trail_guide_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trail-guide-photos',
  'trail-guide-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Trail Guide photo owners can upload" on storage.objects;
create policy "Trail Guide photo owners can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trail-guide-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Trail Guide photo owners can read originals" on storage.objects;
create policy "Trail Guide photo owners can read originals"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trail-guide-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_platform_admin()
  )
);

drop policy if exists "Trail Guide photo owners can remove" on storage.objects;
create policy "Trail Guide photo owners can remove"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trail-guide-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_platform_admin())
);

comment on table public.trail_guide_reviews is
  'Member reviews for Trail Guide destinations, including visit context and category ratings.';
comment on table public.trail_guide_photos is
  'Member-submitted Trail Guide destination photos. Public display requires moderation_status=approved.';