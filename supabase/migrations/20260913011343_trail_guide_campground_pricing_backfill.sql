-- Backfill pricing states for Jacksonville-area Trail Guide campgrounds.
-- Numeric rates come from official park/forest sources or current reservation listings.
-- Where a current numeric rate is not published, store an explicit check-current-rate state.

insert into public.trail_guide_sources (
  place_id,
  source_type,
  source_name,
  source_url,
  source_date,
  priority,
  status,
  last_checked_at,
  updated_at
)
values
  ('cary-state-forest', 'reservation', 'Florida State Forests ReserveAmerica · Cary State Forest Campground', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', null, 100, 'active', now(), now()),
  ('jennings-state-forest', 'reservation', 'Florida State Forests ReserveAmerica · Jennings State Forest', 'https://floridastateforests.reserveamerica.com/camping/hammock-campground-jennings-state-forest/r/campgroundDetails.do?contractCode=FLFS&parkId=1120138', null, 100, 'active', now(), now()),
  ('faver-dykes-state-park', 'official_website', 'Florida State Parks · Faver-Dykes Hours & Fees', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', null, 100, 'active', now(), now()),
  ('fort-clinch-state-park', 'official_website', 'Florida State Parks · Official Fee Schedule', 'https://www.floridastateparks.org/sites/default/files/inline-files/2021_05_10%20FSP%20Fee%20Schedule%2005.2022.pdf', '2022-05-10', 95, 'active', now(), now()),
  ('fort-clinch-state-park', 'official_website', 'Florida State Parks · Current Camping Fees', 'https://www.floridastateparks.org/fees', null, 100, 'active', now(), now()),
  ('moses-creek-conservation-area', 'official_website', 'SJRWMD · Camping on District Lands', 'https://www.sjrwmd.com/lands/recreation/camping/', null, 100, 'active', now(), now()),
  ('princess-place-preserve', 'reservation', 'Flagler County · Camping & Cottages Reservations', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', null, 100, 'active', now(), now())
on conflict (place_id, source_url) do update
set source_type = excluded.source_type,
    source_name = excluded.source_name,
    source_date = excluded.source_date,
    priority = excluded.priority,
    status = 'active',
    last_checked_at = now(),
    updated_at = now();

update public.trail_guide_facts
set is_current = false,
    updated_at = now()
where place_id in (
  'cary-state-forest',
  'jennings-state-forest',
  'faver-dykes-state-park',
  'fort-clinch-state-park',
  'moses-creek-conservation-area',
  'princess-place-preserve'
)
and field_key in (
  'pricing.tent_base',
  'pricing.tent_total',
  'pricing.rv_base',
  'pricing.rv_total',
  'pricing.campsite_base',
  'pricing.campsite_total',
  'pricing.primitive_base',
  'pricing.primitive_total',
  'pricing.reservation_fee',
  'pricing.rv_utility_fee',
  'pricing.rate_mode',
  'pricing.status',
  'pricing.display_text'
);

with pricing_facts(place_id, source_url, field_key, value, value_type, evidence_text, confidence) as (
  values
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.tent_base', '13.51'::jsonb, 'number', 'Current facility rate lists RV or Tent at $13.51 nightly for 2026 and 2027. Displayed rates exclude attribute fees, taxes, and incremental charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.rv_base', '13.51'::jsonb, 'number', 'Current facility rate lists RV or Tent at $13.51 nightly for 2026 and 2027. Displayed rates exclude attribute fees, taxes, and incremental charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.rate_mode', '"starting_at"'::jsonb, 'string', 'ReserveAmerica notes that displayed rates do not reflect attribute fees, taxes, or incremental charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.status', '"published"'::jsonb, 'string', 'Current nightly rate is published in the reservation system.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.display_text', '"RV or tent sites start at $13.51/night. Attribute fees, taxes, or incremental charges may apply."'::jsonb, 'string', 'Current reservation listing and its fee disclaimer.', 'explicit'),

    ('jennings-state-forest', 'https://floridastateforests.reserveamerica.com/camping/hammock-campground-jennings-state-forest/r/campgroundDetails.do?contractCode=FLFS&parkId=1120138', 'pricing.tent_base', '9.09'::jsonb, 'number', 'Current Hammock Campground facility rate lists Tent Only at $9.09 nightly for 2026 and 2027.', 'explicit'),
    ('jennings-state-forest', 'https://floridastateforests.reserveamerica.com/camping/hammock-campground-jennings-state-forest/r/campgroundDetails.do?contractCode=FLFS&parkId=1120138', 'pricing.primitive_base', '9.09'::jsonb, 'number', 'Jennings State Forest reservation listings show primitive and tent camping at $9.09 nightly.', 'explicit'),
    ('jennings-state-forest', 'https://floridastateforests.reserveamerica.com/camping/hammock-campground-jennings-state-forest/r/campgroundDetails.do?contractCode=FLFS&parkId=1120138', 'pricing.status', '"published"'::jsonb, 'string', 'Current nightly rate is published in the reservation system.', 'explicit'),
    ('jennings-state-forest', 'https://floridastateforests.reserveamerica.com/camping/hammock-campground-jennings-state-forest/r/campgroundDetails.do?contractCode=FLFS&parkId=1120138', 'pricing.display_text', '"Tent and primitive sites are $9.09/night. Taxes or incremental charges may apply."'::jsonb, 'string', 'Current reservation listing and its fee disclaimer.', 'explicit'),

    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.tent_base', '18'::jsonb, 'number', 'Official current hours and fees page lists camping at $18 per night plus tax. The $7 utility fee does not apply to tent camping.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.rv_base', '25'::jsonb, 'number', 'Official current page lists $18 base camping plus a $7 nightly utility fee for RV units.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.reservation_fee', '6.70'::jsonb, 'number', 'Official page lists a nonrefundable $6.70 reservation fee.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.rv_utility_fee', '7'::jsonb, 'number', 'Official page lists a $7 nightly utility fee for RV units.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.status', '"published"'::jsonb, 'string', 'Current camping rate is published on the official park page.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.display_text', '"$18/night base camping. RV units add a $7 nightly utility fee. Tax and a $6.70 reservation fee also apply."'::jsonb, 'string', 'Official current hours and fees page.', 'explicit'),

    ('fort-clinch-state-park', 'https://www.floridastateparks.org/sites/default/files/inline-files/2021_05_10%20FSP%20Fee%20Schedule%2005.2022.pdf', 'pricing.tent_base', '26'::jsonb, 'number', 'Official Florida State Parks fee schedule lists Fort Clinch tent-only camping at $26 per night.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/sites/default/files/inline-files/2021_05_10%20FSP%20Fee%20Schedule%2005.2022.pdf', 'pricing.status', '"published"'::jsonb, 'string', 'Official fee schedule publishes the Fort Clinch base camping rate.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/fees', 'pricing.rv_base', '33'::jsonb, 'number', 'Fort Clinch base camping is $26 and the current statewide RV utility fee is $7 nightly.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/fees', 'pricing.reservation_fee', '6.70'::jsonb, 'number', 'Current Florida State Parks fees page lists a $6.70 reservation fee per reservation.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/fees', 'pricing.rv_utility_fee', '7'::jsonb, 'number', 'Current Florida State Parks fees page lists a $7 nightly utility fee for RV units.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/fees', 'pricing.display_text', '"$26/night base camping. RV units add the statewide $7 nightly utility fee. Tax and a $6.70 reservation fee also apply."'::jsonb, 'string', 'Official park-specific fee schedule combined with current statewide reservation and utility fees.', 'explicit'),

    ('moses-creek-conservation-area', 'https://www.sjrwmd.com/lands/recreation/camping/', 'pricing.tent_total', '0'::jsonb, 'number', 'SJRWMD states that campsites on District lands are free of charge.', 'explicit'),
    ('moses-creek-conservation-area', 'https://www.sjrwmd.com/lands/recreation/camping/', 'pricing.primitive_total', '0'::jsonb, 'number', 'Only primitive tent camping is allowed on District lands and campsites are free of charge.', 'explicit'),
    ('moses-creek-conservation-area', 'https://www.sjrwmd.com/lands/recreation/camping/', 'pricing.status', '"free"'::jsonb, 'string', 'SJRWMD states that campsites on District lands are free of charge.', 'explicit'),
    ('moses-creek-conservation-area', 'https://www.sjrwmd.com/lands/recreation/camping/', 'pricing.display_text', '"Free primitive tent camping. Reservations are required for reservable sites and must be made in advance."'::jsonb, 'string', 'Current District camping rules and reservation policy.', 'explicit'),

    ('princess-place-preserve', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', 'pricing.status', '"check_current_rate"'::jsonb, 'string', 'The current Flagler County page directs campers to its live reservation system but does not publish a numeric campsite rate on the page.', 'partial'),
    ('princess-place-preserve', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', 'pricing.display_text', '"Current campsite pricing is shown in Flagler County’s live reservation system. Check the booking system for the current rate."'::jsonb, 'string', 'Current county reservation page.', 'partial')
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
  observed_at,
  verified_at,
  updated_at
)
select
  f.place_id,
  s.id,
  f.field_key,
  f.value,
  f.value_type,
  f.evidence_text,
  f.confidence,
  true,
  now(),
  now(),
  now()
from pricing_facts f
join public.trail_guide_sources s
  on s.place_id = f.place_id
 and s.source_url = f.source_url
on conflict (place_id, source_id, field_key) do update
set value = excluded.value,
    value_type = excluded.value_type,
    evidence_text = excluded.evidence_text,
    confidence = excluded.confidence,
    is_current = true,
    observed_at = excluded.observed_at,
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at;

update public.trail_guide_place_profiles
set last_verified_at = now(),
    updated_at = now()
where place_id in (
  'cary-state-forest',
  'jennings-state-forest',
  'faver-dykes-state-park',
  'fort-clinch-state-park',
  'moses-creek-conservation-area',
  'princess-place-preserve'
);
