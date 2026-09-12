insert into public.trail_guide_place_profiles
(place_id,display_name,category,operator_name,address,city,state,completeness_score,is_published,last_verified_at)
values
('micklers-landing-beach','Mickler''s Landing Beach','Water','St. Johns County','1109 Ponte Vedra Blvd, Ponte Vedra Beach, FL 32082','Ponte Vedra Beach','FL',61,true,now()),
('anastasia-state-park','Anastasia State Park','Camping','Florida State Parks','300 Anastasia Park Rd, St. Augustine, FL 32080','St. Augustine','FL',75,true,now()),
('washington-oaks-gardens-state-park','Washington Oaks Gardens State Park','Scenic','Florida State Parks','6400 N Oceanshore Blvd, Palm Coast, FL 32137','Palm Coast','FL',71,true,now()),
('ravine-gardens-state-park','Ravine Gardens State Park','Hiking','Florida State Parks','1600 Twigg St, Palatka, FL 32177','Palatka','FL',65,true,now()),
('princess-place-preserve','Princess Place Preserve','Camping','Flagler County','2500 Princess Place Rd, Palm Coast, FL 32137','Palm Coast','FL',79,true,now()),
('faver-dykes-state-park','Faver-Dykes State Park','Camping','Florida State Parks','1000 Faver-Dykes Rd, St. Augustine, FL 32086','St. Augustine','FL',85,true,now()),
('deep-creek-conservation-area','Deep Creek Conservation Area','Hiking','St. Johns River Water Management District',null,'St. Johns County','FL',59,true,now()),
('moses-creek-conservation-area','Moses Creek Conservation Area','Hiking','St. Johns River Water Management District',null,'St. Augustine','FL',71,true,now()),
('fort-george-island-cultural-state-park','Fort George Island Cultural State Park','Scenic','Florida State Parks','11241 Fort George Rd, Jacksonville, FL 32226','Jacksonville','FL',63,true,now())
on conflict (place_id) do update set
 display_name=excluded.display_name,category=excluded.category,operator_name=excluded.operator_name,
 address=coalesce(excluded.address,public.trail_guide_place_profiles.address),city=excluded.city,state=excluded.state,
 completeness_score=greatest(public.trail_guide_place_profiles.completeness_score,excluded.completeness_score),
 is_published=true,last_verified_at=now(),updated_at=now();

insert into public.trail_guide_sources
(place_id,source_type,source_name,source_url,priority,status,last_checked_at)
values
('micklers-landing-beach','official_website','St. Johns County · Mickler''s Landing Beachfront Park','https://www.sjcfl.us/parks_trails/micklers-landing-beachfront-park/',90,'active',now()),
('anastasia-state-park','official_website','Florida State Parks · Anastasia State Park','https://www.floridastateparks.org/anastasia',90,'active',now()),
('washington-oaks-gardens-state-park','official_website','Florida State Parks · Washington Oaks Gardens State Park','https://www.floridastateparks.org/parks-and-trails/washington-oaks-gardens-state-park',90,'active',now()),
('ravine-gardens-state-park','official_website','Florida State Parks · Ravine Gardens State Park','https://www.floridastateparks.org/parks-and-trails/ravine-gardens-state-park',90,'active',now()),
('princess-place-preserve','official_website','Flagler County · Princess Place Preserve','https://www.flaglercounty.gov/Things-to-Do/Find-a-Park/Princess-Place-Preserve',90,'active',now()),
('faver-dykes-state-park','official_website','Florida State Parks · Faver-Dykes State Park','https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park',90,'active',now()),
('deep-creek-conservation-area','official_website','SJRWMD · Deep Creek Conservation Area','https://www.sjrwmd.com/lands/recreation/deep-creek/',90,'active',now()),
('moses-creek-conservation-area','official_website','SJRWMD · Moses Creek Conservation Area','https://www.sjrwmd.com/lands/recreation/moses-creek/',90,'active',now()),
('fort-george-island-cultural-state-park','official_website','Florida State Parks · Fort George Island Cultural State Park','https://www.floridastateparks.org/parks-and-trails/fort-george-island-cultural-state-park',90,'active',now())
on conflict (place_id,source_url) do update set
 source_type=excluded.source_type,source_name=excluded.source_name,priority=excluded.priority,status='active',
 last_checked_at=now(),last_error=null,updated_at=now();

with place_seed(place_id,source_url,facts) as (
 values
 ('micklers-landing-beach','https://www.sjcfl.us/parks_trails/micklers-landing-beachfront-park/','{"visit.hours": "Dawn–dusk", "parking.available": true, "amenities.restrooms": true, "amenities.showers": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "activities.picnicking": true, "activities.equestrian": true}'::jsonb),
 ('anastasia-state-park','https://www.floridastateparks.org/anastasia','{"visit.hours": "8:00 AM–sunset, 365 days a year", "visit.admission": "$8 per vehicle", "contact.phone": "904-461-2033", "parking.available": true, "amenities.restrooms": true, "amenities.concession": true, "accessibility.wheelchair": true, "activities.picnicking": true, "camping.tent": true, "camping.rv": true, "reservations.available": true, "pricing.tent_base": 28, "pricing.rv_base": 28, "pricing.currency": "USD", "alerts.current": "Music from the adjacent amphitheatre may be audible in the campground. Events end by 10:00 PM under city ordinance."}'::jsonb),
 ('washington-oaks-gardens-state-park','https://www.floridastateparks.org/parks-and-trails/washington-oaks-gardens-state-park','{"visit.hours": "8:00 AM–sunset", "visit.admission": "$5 per vehicle", "contact.phone": "386-446-6780", "parking.available": true, "amenities.restrooms": true, "amenities.playground": true, "accessibility.wheelchair": true, "activities.bicycling": true, "activities.birding": true, "activities.fishing": true, "activities.wildlife_viewing": true, "activities.picnicking": true, "alerts.current": "Maintenance work is scheduled during October 2026 and portions of the park may close during the day. Check current alerts before visiting."}'::jsonb),
 ('ravine-gardens-state-park','https://www.floridastateparks.org/parks-and-trails/ravine-gardens-state-park','{"visit.hours": "Park 8:00 AM–sundown; Loop Drive 9:00 AM–4:00 PM", "visit.admission": "$5 vehicle with 2–8 people; $4 single-occupant vehicle; $2 pedestrian/bicyclist/extra passenger", "contact.phone": "386-329-3721", "parking.available": true, "amenities.restrooms": true, "amenities.playground": true, "activities.hiking": true, "activities.picnicking": true, "pets.allowed": true, "pets.leash_required": true}'::jsonb),
 ('princess-place-preserve','https://www.flaglercounty.gov/Things-to-Do/Find-a-Park/Princess-Place-Preserve','{"visit.hours": "7:00 AM–6:00 PM daily", "contact.phone": "386-313-4020", "parking.available": true, "amenities.restrooms": true, "activities.hiking": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.birding": true, "activities.fishing": true, "activities.picnicking": true, "activities.wildlife_viewing": true, "camping.tent": true, "camping.primitive": true, "camping.cabins": true, "reservations.available": true, "check_in.time": "4:30 PM–5:30 PM", "pets.allowed": true}'::jsonb),
 ('faver-dykes-state-park','https://www.floridastateparks.org/parks-and-trails/faver-dykes-state-park','{"visit.hours": "8:00 AM–sunset", "visit.admission": "$5 per vehicle", "contact.phone": "386-931-4124", "parking.available": true, "amenities.restrooms": true, "amenities.showers": true, "dump_station.available": true, "activities.bicycling": true, "activities.birding": true, "activities.paddling": true, "launch.boat": true, "camping.tent": true, "camping.rv": true, "camping.site_count": 30, "electric.available": true, "water.hookup": true, "fires.rings_only": true, "amenities.picnic_tables": true, "pets.allowed": true, "reservations.available": true}'::jsonb),
 ('deep-creek-conservation-area','https://www.sjrwmd.com/lands/recreation/deep-creek/','{"visit.admission": "Free", "activities.hiking": true, "activities.bicycling": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": false, "activities.wildlife_viewing": true}'::jsonb),
 ('moses-creek-conservation-area','https://www.sjrwmd.com/lands/recreation/moses-creek/','{"visit.admission": "Free", "trail.distance_miles": 6, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": false, "activities.picnicking": true, "activities.wildlife_viewing": true, "camping.tent": true, "camping.primitive": true, "alerts.current": "Mulch mowing work is affecting portions of the red, yellow and white trails through September 2026, including access near the hike-in campsite."}'::jsonb),
 ('fort-george-island-cultural-state-park','https://www.floridastateparks.org/parks-and-trails/fort-george-island-cultural-state-park','{"visit.hours": "Park 8:00 AM–sunset; Ribault Club Wednesday–Sunday 9:00 AM–5:00 PM", "visit.admission": "Free", "contact.phone": "904-251-2320", "parking.available": true, "activities.hiking": true, "activities.bicycling": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true}'::jsonb)
), expanded as (
 select p.place_id,p.source_url,j.key as field_key,j.value,
   case jsonb_typeof(j.value)
     when 'boolean' then 'boolean'
     when 'number' then 'number'
     when 'array' then 'string_array'
     else 'string'
   end as value_type
 from place_seed p
 cross join lateral jsonb_each(p.facts) j
)
insert into public.trail_guide_facts
(place_id,source_id,field_key,value,value_type,evidence_text,confidence,is_current,observed_at,verified_at)
select e.place_id,s.id,e.field_key,e.value,e.value_type,
       'Verified from the listed official destination or operator source.',
       'explicit',true,now(),now()
from expanded e
join public.trail_guide_sources s on s.place_id=e.place_id and s.source_url=e.source_url
on conflict (place_id,source_id,field_key) do update set
 value=excluded.value,value_type=excluded.value_type,evidence_text=excluded.evidence_text,
 confidence='explicit',is_current=true,observed_at=now(),verified_at=now(),updated_at=now();