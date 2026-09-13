-- Jacksonville-area campground pricing audit, verified 2026-09-12.
-- Fixed prices are seeded only where a current official operator or authorized
-- reservation source publishes the rate. Princess Place intentionally records
-- an explicit not-published state instead of reusing its stale 2021 fee PDF.

insert into public.trail_guide_sources
  (place_id, source_type, source_name, source_url, source_date, priority, status, last_checked_at)
values
  ('fort-clinch-state-park', 'official_website', 'Florida State Parks · Fort Clinch Hours & Fees', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', null, 95, 'active', now()),
  ('anastasia-state-park', 'official_website', 'Florida State Parks · Anastasia Hours & Fees', 'https://www.floridastateparks.org/Anastasia/hours-fees', null, 95, 'active', now()),
  ('faver-dykes-state-park', 'official_website', 'Florida State Parks · Faver-Dykes Hours & Fees', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', null, 95, 'active', now()),
  ('cary-state-forest', 'reservation', 'Florida State Forests · Cary State Forest Campground', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', null, 95, 'active', now()),
  ('princess-place-preserve', 'reservation', 'Flagler County · Camping & Cottages Online Reservations', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', null, 95, 'active', now())
on conflict (place_id, source_url) do update set
  source_type = excluded.source_type,
  source_name = excluded.source_name,
  source_date = excluded.source_date,
  priority = excluded.priority,
  status = 'active',
  last_checked_at = now(),
  last_error = null,
  updated_at = now();

with seed(place_id, source_url, field_key, value, value_type, evidence_text, confidence) as (
  values
    -- Huguenot Memorial Park. Existing City facts already hold $20/$24 base
    -- and $22.70/$27.24 tax-inclusive totals.
    ('huguenot-memorial-park', 'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/huguenot-memorial-park', 'pricing.status', to_jsonb('published'::text), 'string', 'The current City of Jacksonville park page publishes campground rates.', 'explicit'),
    ('huguenot-memorial-park', 'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/huguenot-memorial-park', 'pricing.taxes', to_jsonb('Published tent and RV totals include tax.'::text), 'string', 'The City labels the published campground totals as including tax.', 'explicit'),
    ('huguenot-memorial-park', 'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/huguenot-memorial-park', 'pricing.pet_fee', '5.38'::jsonb, 'number', 'The City publishes a $5.38 pet camping fee per pet per stay.', 'explicit'),
    ('huguenot-memorial-park', 'https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/huguenot-memorial-park', 'reservations.url', to_jsonb('https://fljacksonweb.myvscloud.com/webtrac/web/search.html?module=RN&primarycode=Huguenot%20Campsites'::text), 'string', 'The City provides an online Huguenot campsite reservation path.', 'explicit'),

    -- Fort Clinch State Park.
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.status', to_jsonb('published'::text), 'string', 'The current Florida State Parks fee page publishes the camping rate.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.tent_base', '26'::jsonb, 'number', 'Camping is $26 per night plus tax. The nightly utility fee does not apply to tent camping.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.rv_base', '26'::jsonb, 'number', 'Camping is $26 per night plus tax before the RV utility fee.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.reservation_fee', '6.70'::jsonb, 'number', 'The published nonrefundable reservation fee is $6.70.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.utility_fee', '7'::jsonb, 'number', 'RV and other specified units pay a $7 nightly utility fee; tent camping is excluded.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.taxes', to_jsonb('Base camping rate is plus tax. The $7 nightly utility fee applies to RV and specified lodging units, not tents.'::text), 'string', 'The official fee page states that tax and the applicable utility fee are additional.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.resident', to_jsonb('Eligible Florida residents age 65+ or with qualifying disability documentation receive 50% off the current base campsite fee; reservation and utility fees are excluded.'::text), 'string', 'Florida State Parks publishes the qualifying resident discount and exclusions.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.nonresident', to_jsonb('Standard published base campsite rate applies.'::text), 'string', 'The published $26 base rate is the standard campsite rate.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'pricing.currency', to_jsonb('USD'::text), 'string', 'Published rates are U.S. dollar amounts.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'reservations.available', 'true'::jsonb, 'boolean', 'The official park page provides a campsite reservation action.', 'explicit'),
    ('fort-clinch-state-park', 'https://www.floridastateparks.org/parks-and-trails/fort-clinch-state-park/hours-fees', 'reservations.url', to_jsonb('https://reserve.floridastateparks.org/Web/'::text), 'string', 'Florida State Parks directs campsite reservations to its reservation website.', 'explicit'),

    -- Anastasia State Park.
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.status', to_jsonb('published'::text), 'string', 'The current Florida State Parks fee page publishes the camping rate.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.tent_base', '28'::jsonb, 'number', 'Camping is $28 per night plus tax and the utility fee does not apply to tents.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.rv_base', '28'::jsonb, 'number', 'Camping is $28 per night plus tax before the RV utility fee.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.reservation_fee', '6.70'::jsonb, 'number', 'The published nonrefundable reservation fee is $6.70.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.utility_fee', '7'::jsonb, 'number', 'RV and other specified units pay a $7 nightly utility fee; tent camping is excluded.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.taxes', to_jsonb('Base camping rate is plus tax. The $7 nightly utility fee applies to RV and specified lodging units, not tents.'::text), 'string', 'The official fee page states that tax and the applicable utility fee are additional.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.resident', to_jsonb('Eligible Florida residents age 65+ or with qualifying disability documentation receive 50% off the current base campsite fee; reservation and utility fees are excluded.'::text), 'string', 'Florida State Parks publishes the qualifying resident discount and exclusions.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.nonresident', to_jsonb('Standard published base campsite rate applies.'::text), 'string', 'The published $28 base rate is the standard campsite rate.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'pricing.currency', to_jsonb('USD'::text), 'string', 'Published rates are U.S. dollar amounts.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'reservations.available', 'true'::jsonb, 'boolean', 'The official park page provides a campsite reservation action.', 'explicit'),
    ('anastasia-state-park', 'https://www.floridastateparks.org/Anastasia/hours-fees', 'reservations.url', to_jsonb('https://reserve.floridastateparks.org/Web/'::text), 'string', 'Florida State Parks directs campsite reservations to its reservation website.', 'explicit'),

    -- Faver-Dykes State Park.
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.status', to_jsonb('published'::text), 'string', 'The current Florida State Parks fee page publishes the camping rate.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.tent_base', '18'::jsonb, 'number', 'Camping is $18 per night plus tax and the utility fee does not apply to tents.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.rv_base', '18'::jsonb, 'number', 'Camping is $18 per night plus tax before the RV utility fee.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.reservation_fee', '6.70'::jsonb, 'number', 'The published nonrefundable reservation fee is $6.70.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.utility_fee', '7'::jsonb, 'number', 'RV and other specified units pay a $7 nightly utility fee; tent camping is excluded.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.taxes', to_jsonb('Base camping rate is plus tax. The $7 nightly utility fee applies to RV and specified lodging units, not tents.'::text), 'string', 'The official fee page states that tax and the applicable utility fee are additional.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.resident', to_jsonb('Eligible Florida residents age 65+ or with qualifying disability documentation receive 50% off the current base campsite fee; reservation and utility fees are excluded.'::text), 'string', 'Florida State Parks publishes the qualifying resident discount and exclusions.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.nonresident', to_jsonb('Standard published base campsite rate applies.'::text), 'string', 'The published $18 base rate is the standard campsite rate.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'pricing.currency', to_jsonb('USD'::text), 'string', 'Published rates are U.S. dollar amounts.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'reservations.available', 'true'::jsonb, 'boolean', 'The official park page provides a campsite reservation action.', 'explicit'),
    ('faver-dykes-state-park', 'https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park/hours-fees', 'reservations.url', to_jsonb('https://reserve.floridastateparks.org/Web/'::text), 'string', 'Florida State Parks directs campsite reservations to its reservation website.', 'explicit'),

    -- Cary State Forest. ReserveAmerica is the reservation system linked by FDACS.
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.status', to_jsonb('published'::text), 'string', 'The authorized Florida State Forests reservation page publishes a 2026 and 2027 RV-or-tent nightly rate.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.tent_base', '13.51'::jsonb, 'number', 'RV or Tent sites are listed at $13.51 nightly for 2026 and 2027 before added charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.rv_base', '13.51'::jsonb, 'number', 'RV or Tent sites are listed at $13.51 nightly for 2026 and 2027 before added charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.seasonal', to_jsonb('Peak-season listings for Jan 1–Dec 31, 2026 and Jan 1–Dec 31, 2027 both show $13.51 for RV or Tent sites.'::text), 'string', 'The reservation page publishes the same RV-or-tent base rate for the 2026 and 2027 seasons.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.taxes', to_jsonb('Displayed base rate excludes electrical/water attribute fees, taxes, and other incremental charges.'::text), 'string', 'ReserveAmerica states that displayed rates do not include attribute fees, taxes, or incremental charges.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'pricing.currency', to_jsonb('USD'::text), 'string', 'The reservation page publishes U.S. dollar amounts.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'reservations.available', 'true'::jsonb, 'boolean', 'The authorized reservation page accepts Cary State Forest campsite reservations.', 'explicit'),
    ('cary-state-forest', 'https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135', 'reservations.url', to_jsonb('https://floridastateforests.reserveamerica.com/camping/cary-state-forest-campground/r/campgroundDetails.do?contractCode=FLFS&parkId=1120135'::text), 'string', 'FDACS links campers to ReserveAmerica for Cary State Forest reservations.', 'explicit'),

    -- Princess Place Preserve. The current county booking page publishes no rate.
    -- The older county fee PDF is dated 2021 and is not promoted to a 2026 current rate.
    ('princess-place-preserve', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', 'pricing.status', to_jsonb('not_published'::text), 'string', 'The current county booking page offers Princess Place reservations but does not publish a current campsite price; the available county fee PDF is dated 2021.', 'partial'),
    ('princess-place-preserve', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', 'reservations.available', 'true'::jsonb, 'boolean', 'Flagler County currently offers online reservations for Princess Place primitive campsites and cottages.', 'explicit'),
    ('princess-place-preserve', 'https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations', 'reservations.url', to_jsonb('https://www.flaglercounty.gov/Things-to-Do/Camping-Cottages-Online-Reservations'::text), 'string', 'The current county page is the official reservation entry point for Princess Place.', 'explicit')
), inserted as (
  insert into public.trail_guide_facts
    (place_id, source_id, field_key, value, value_type, evidence_text, confidence, is_current, observed_at, verified_at)
  select
    seed.place_id,
    source.id,
    seed.field_key,
    seed.value,
    seed.value_type,
    seed.evidence_text,
    seed.confidence,
    true,
    now(),
    now()
  from seed
  join public.trail_guide_sources source
    on source.place_id = seed.place_id
   and source.source_url = seed.source_url
  on conflict (place_id, source_id, field_key) do update set
    value = excluded.value,
    value_type = excluded.value_type,
    evidence_text = excluded.evidence_text,
    confidence = excluded.confidence,
    is_current = true,
    observed_at = now(),
    verified_at = now(),
    updated_at = now()
  returning place_id
)
update public.trail_guide_place_profiles
set last_verified_at = now(), updated_at = now()
where place_id in (
  'huguenot-memorial-park',
  'fort-clinch-state-park',
  'cary-state-forest',
  'anastasia-state-park',
  'princess-place-preserve',
  'faver-dykes-state-park'
);
