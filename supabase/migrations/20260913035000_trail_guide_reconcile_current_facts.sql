-- Seed migrations can add a newer authoritative source for a field that was
-- already present on an older source. Keep exactly one current fact per field
-- for the audited Camping destinations so the app always resolves the same
-- rate, booking URL, evidence, and source attribution.

with ranked as (
  select
    f.id,
    row_number() over (
      partition by f.place_id, f.field_key
      order by s.priority desc,
               coalesce(s.source_date::timestamptz, s.last_checked_at, f.verified_at, f.updated_at) desc nulls last,
               f.updated_at desc,
               f.id desc
    ) as source_rank
  from public.trail_guide_facts f
  join public.trail_guide_sources s on s.id = f.source_id
  where f.place_id in (
    'huguenot-memorial-park',
    'fort-clinch-state-park',
    'cary-state-forest',
    'anastasia-state-park',
    'princess-place-preserve',
    'faver-dykes-state-park'
  )
    and s.status = 'active'
)
update public.trail_guide_facts f
set is_current = (ranked.source_rank = 1),
    updated_at = now()
from ranked
where f.id = ranked.id
  and f.is_current is distinct from (ranked.source_rank = 1);

update public.trail_guide_place_profiles
set completeness_score = public.calculate_trail_guide_camping_completeness(place_id),
    last_verified_at = now(),
    updated_at = now()
where place_id in (
  'huguenot-memorial-park',
  'fort-clinch-state-park',
  'cary-state-forest',
  'anastasia-state-park',
  'princess-place-preserve',
  'faver-dykes-state-park'
);
