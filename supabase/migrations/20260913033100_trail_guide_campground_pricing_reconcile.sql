-- Ensure the highest-priority verified pricing/booking source is the current
-- fact after the Jacksonville-area campground pricing audit.
with ranked as (
  select
    f.id,
    row_number() over (
      partition by f.place_id, f.field_key
      order by
        s.priority desc,
        coalesce(s.source_date::timestamptz, s.last_checked_at, f.verified_at, f.observed_at) desc nulls last,
        f.updated_at desc
    ) as rn
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
    and (f.field_key like 'pricing.%' or f.field_key in ('reservations.available', 'reservations.url'))
)
update public.trail_guide_facts f
set
  is_current = ranked.rn = 1,
  updated_at = now()
from ranked
where f.id = ranked.id;
