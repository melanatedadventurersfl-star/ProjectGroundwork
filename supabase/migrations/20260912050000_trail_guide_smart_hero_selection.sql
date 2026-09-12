create table if not exists public.trail_guide_hero_candidates (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.trail_guide_place_profiles(place_id) on delete cascade,
  source_type text not null check (source_type in ('official','admin','camper','google','curated','wikimedia','generic')),
  source_name text,
  image_url text,
  storage_path text,
  source_url text,
  photo_id uuid unique references public.trail_guide_photos(id) on delete cascade,
  credit text,
  license text,
  tags text[] not null default '{}',
  destination_match_score numeric(5,4) not null default 0.5 check (destination_match_score between 0 and 1),
  source_trust_score numeric(5,4) not null default 0.5 check (source_trust_score between 0 and 1),
  quality_score numeric(5,4) not null default 0.5 check (quality_score between 0 and 1),
  recency_score numeric(5,4) not null default 0.5 check (recency_score between 0 and 1),
  hero_score numeric(5,4) not null default 0.5 check (hero_score between 0 and 1),
  status text not null default 'candidate' check (status in ('candidate','approved','rejected')),
  is_preferred boolean not null default false,
  is_generic boolean not null default false,
  classification_note text,
  classified_at timestamptz,
  last_scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (image_url is not null or storage_path is not null)
);

create unique index if not exists trail_guide_hero_candidates_external_unique
  on public.trail_guide_hero_candidates (place_id, image_url)
  where image_url is not null;

create index if not exists trail_guide_hero_candidates_rank_idx
  on public.trail_guide_hero_candidates (place_id, status, is_preferred desc, is_generic asc, hero_score desc, updated_at desc);

create unique index if not exists trail_guide_hero_candidates_one_preferred_idx
  on public.trail_guide_hero_candidates (place_id)
  where is_preferred = true and status = 'approved';

alter table public.trail_guide_place_profiles
  add column if not exists hero_candidate_id uuid references public.trail_guide_hero_candidates(id) on delete set null,
  add column if not exists hero_selection_mode text not null default 'automatic' check (hero_selection_mode in ('automatic','manual')),
  add column if not exists hero_confidence numeric(5,4) not null default 0 check (hero_confidence between 0 and 1),
  add column if not exists hero_selection_reason text,
  add column if not exists hero_last_reviewed_at timestamptz;

alter table public.trail_guide_hero_candidates enable row level security;

drop policy if exists "Members read approved Trail Guide hero candidates" on public.trail_guide_hero_candidates;
create policy "Members read approved Trail Guide hero candidates"
on public.trail_guide_hero_candidates for select
to authenticated
using (status = 'approved' or public.is_platform_admin());

drop policy if exists "Admins manage Trail Guide hero candidates" on public.trail_guide_hero_candidates;
create policy "Admins manage Trail Guide hero candidates"
on public.trail_guide_hero_candidates for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

grant select, insert, update, delete on public.trail_guide_hero_candidates to authenticated;

create or replace function public.refresh_trail_guide_hero_selection(target_place_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_id uuid;
  selected_score numeric;
  selected_preferred boolean;
begin
  select id, hero_score, is_preferred
  into selected_id, selected_score, selected_preferred
  from public.trail_guide_hero_candidates
  where place_id = target_place_id
    and status = 'approved'
  order by is_preferred desc, is_generic asc, hero_score desc, updated_at desc
  limit 1;

  update public.trail_guide_place_profiles
  set hero_candidate_id = selected_id,
      hero_confidence = coalesce(selected_score, 0),
      hero_selection_mode = case when coalesce(selected_preferred, false) then 'manual' else 'automatic' end,
      hero_selection_reason = case
        when selected_id is null then 'No approved destination-specific hero candidate is available.'
        when selected_preferred then 'Admin-selected preferred cover.'
        else 'Highest-scoring approved hero candidate.'
      end,
      hero_last_reviewed_at = now(),
      updated_at = now()
  where place_id = target_place_id;

  return selected_id;
end;
$$;

revoke all on function public.refresh_trail_guide_hero_selection(text) from public, anon, authenticated;
grant execute on function public.refresh_trail_guide_hero_selection(text) to service_role;

create or replace function public.sync_trail_guide_photo_hero_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  suitability numeric := 0.60;
  freshness numeric := 0.85;
  computed_score numeric;
begin
  suitability := case new.category
    when 'beach' then 0.92
    when 'trail' then 0.88
    when 'campsite' then 0.90
    when 'rv_site' then 0.86
    when 'tent_site' then 0.88
    when 'activities' then 0.72
    when 'facilities' then 0.50
    when 'bathroom' then 0.28
    else 0.55
  end;

  freshness := case
    when new.visit_date is null then 0.78
    when new.visit_date >= current_date - interval '18 months' then 1.00
    when new.visit_date >= current_date - interval '36 months' then 0.82
    else 0.62
  end;

  computed_score := least(1, greatest(0,
    (0.40 * suitability) +
    (0.30 * 0.76) +
    (0.20 * 0.68) +
    (0.10 * freshness)
  ));

  if new.moderation_status = 'approved' and new.feature_eligible = true then
    insert into public.trail_guide_hero_candidates (
      place_id, source_type, source_name, storage_path, photo_id, credit, tags,
      destination_match_score, source_trust_score, quality_score, recency_score,
      hero_score, status, is_preferred, is_generic, classification_note,
      classified_at, last_scored_at, updated_at
    ) values (
      new.place_id, 'camper', 'Go Melanated camper', new.storage_path, new.id, null,
      array[new.category], suitability, 0.76, 0.68, freshness,
      computed_score, 'approved', false, false,
      'Auto-classified from the member-selected Trail Guide photo category.',
      now(), now(), now()
    )
    on conflict (photo_id) do update set
      place_id = excluded.place_id,
      storage_path = excluded.storage_path,
      tags = excluded.tags,
      destination_match_score = excluded.destination_match_score,
      source_trust_score = excluded.source_trust_score,
      quality_score = excluded.quality_score,
      recency_score = excluded.recency_score,
      hero_score = excluded.hero_score,
      status = 'approved',
      is_generic = false,
      classification_note = excluded.classification_note,
      classified_at = now(),
      last_scored_at = now(),
      updated_at = now();
  else
    update public.trail_guide_hero_candidates
    set status = 'rejected', is_preferred = false, updated_at = now()
    where photo_id = new.id;
  end if;

  perform public.refresh_trail_guide_hero_selection(new.place_id);
  return new;
end;
$$;

revoke all on function public.sync_trail_guide_photo_hero_candidate() from public, anon, authenticated;

DROP TRIGGER IF EXISTS trail_guide_photo_hero_candidate_sync ON public.trail_guide_photos;
create trigger trail_guide_photo_hero_candidate_sync
after insert or update of moderation_status, feature_eligible, category, visit_date
on public.trail_guide_photos
for each row execute function public.sync_trail_guide_photo_hero_candidate();

insert into public.trail_guide_hero_candidates (
  place_id, source_type, source_name, storage_path, photo_id, tags,
  destination_match_score, source_trust_score, quality_score, recency_score,
  hero_score, status, is_generic, classification_note, classified_at, last_scored_at
)
select
  p.place_id,
  'camper',
  'Go Melanated camper',
  p.storage_path,
  p.id,
  array[p.category],
  case p.category
    when 'beach' then 0.92 when 'trail' then 0.88 when 'campsite' then 0.90
    when 'rv_site' then 0.86 when 'tent_site' then 0.88 when 'activities' then 0.72
    when 'facilities' then 0.50 when 'bathroom' then 0.28 else 0.55 end,
  0.76,
  0.68,
  case
    when p.visit_date is null then 0.78
    when p.visit_date >= current_date - interval '18 months' then 1.00
    when p.visit_date >= current_date - interval '36 months' then 0.82
    else 0.62 end,
  least(1, greatest(0,
    (0.40 * (case p.category
      when 'beach' then 0.92 when 'trail' then 0.88 when 'campsite' then 0.90
      when 'rv_site' then 0.86 when 'tent_site' then 0.88 when 'activities' then 0.72
      when 'facilities' then 0.50 when 'bathroom' then 0.28 else 0.55 end)) +
    (0.30 * 0.76) + (0.20 * 0.68) +
    (0.10 * (case
      when p.visit_date is null then 0.78
      when p.visit_date >= current_date - interval '18 months' then 1.00
      when p.visit_date >= current_date - interval '36 months' then 0.82
      else 0.62 end))
  )),
  'approved',
  false,
  'Backfilled from an approved member photo.',
  now(),
  now()
from public.trail_guide_photos p
where p.moderation_status = 'approved'
  and p.feature_eligible = true
on conflict (photo_id) do nothing;

insert into public.trail_guide_hero_candidates (
  place_id, source_type, source_name, image_url, source_url, credit, license, tags,
  destination_match_score, source_trust_score, quality_score, recency_score,
  hero_score, status, is_preferred, is_generic, classification_note,
  classified_at, last_scored_at
)
select
  'huguenot-memorial-park',
  'wikimedia',
  'Wikimedia Commons',
  'https://upload.wikimedia.org/wikipedia/commons/9/9c/Shorebirds_at_Huguenot_Park.jpg',
  'https://commons.wikimedia.org/wiki/File:Shorebirds_at_Huguenot_Park.jpg',
  'The Bushranger / Wikimedia Commons',
  'CC BY-SA 4.0',
  array['beach','shoreline','water','wildlife'],
  1.00,
  0.72,
  0.72,
  0.65,
  0.825,
  'approved',
  false,
  false,
  'Exact destination image retained as a destination-specific candidate.',
  now(),
  now()
where exists (
  select 1 from public.trail_guide_place_profiles where place_id = 'huguenot-memorial-park'
)
on conflict (place_id, image_url) where image_url is not null do update set
  status = 'approved',
  is_generic = false,
  destination_match_score = 1.00,
  hero_score = 0.825,
  updated_at = now();

select public.refresh_trail_guide_hero_selection(place_id)
from public.trail_guide_place_profiles;

drop policy if exists "Trail Guide approved photos readable" on storage.objects;
create policy "Trail Guide approved photos readable"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trail-guide-photos'
  and exists (
    select 1
    from public.trail_guide_photos p
    where p.storage_path = name
      and p.moderation_status = 'approved'
  )
);

comment on table public.trail_guide_hero_candidates is
  'Scored destination hero-image candidates from official, admin, camper, Google, curated, Wikimedia, or generic sources.';
comment on function public.refresh_trail_guide_hero_selection(text) is
  'Selects the highest-ranked approved destination hero candidate, honoring an admin preferred cover first.';