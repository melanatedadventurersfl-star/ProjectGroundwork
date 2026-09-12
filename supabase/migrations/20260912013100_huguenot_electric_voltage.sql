with rules_source as (
  select id
  from public.trail_guide_sources
  where place_id = 'huguenot-memorial-park'
    and source_type = 'official_rules'
  order by priority desc
  limit 1
)
insert into public.trail_guide_facts (
  place_id,
  source_id,
  field_key,
  value,
  value_type,
  evidence_text,
  confidence,
  is_current,
  verified_at
)
select
  'huguenot-memorial-park',
  rules_source.id,
  'electric.voltage',
  '110'::jsonb,
  'number',
  'Campground rules list standard 110V electrical service in addition to 30A and 50A service.',
  'explicit',
  true,
  now()
from rules_source
on conflict (place_id, source_id, field_key) do update set
  value = excluded.value,
  value_type = excluded.value_type,
  evidence_text = excluded.evidence_text,
  confidence = excluded.confidence,
  is_current = true,
  verified_at = now(),
  updated_at = now();
