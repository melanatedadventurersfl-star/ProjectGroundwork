insert into public.trail_guide_place_profiles
(place_id,display_name,category,operator_name,address,city,state,completeness_score,is_published,last_verified_at)
values
('kathryn-abbey-hanna-park','Kathryn Abbey Hanna Park','Parks','City of Jacksonville','500 Wonderwood Dr, Jacksonville, FL 32233','Jacksonville','FL',92,true,now()),
('jacksonville-baldwin-rail-trail','Jacksonville-Baldwin Rail Trail','Hiking','City of Jacksonville','850 N Center St, Jacksonville, FL 32234','Jacksonville','FL',71,true,now()),
('timucuan-ecological-and-historic-preserve','Timucuan Ecological & Historic Preserve','Scenic','National Park Service','12713 Fort Caroline Rd, Jacksonville, FL 32225','Jacksonville','FL',65,true,now()),
('little-talbot-island-state-park','Little Talbot Island State Park','Water','Florida State Parks','12157 Heckscher Dr, Jacksonville, FL 32226','Jacksonville','FL',92,true,now()),
('big-talbot-island-state-park','Big Talbot Island State Park','Scenic','Florida State Parks','State Road A1A, Jacksonville, FL 32226','Jacksonville','FL',73,true,now()),
('amelia-island-state-park','Amelia Island State Park','Water','Florida State Parks','9550 1st Coast Hwy, Fernandina Beach, FL 32034','Fernandina Beach','FL',65,true,now()),
('fort-clinch-state-park','Fort Clinch State Park','Camping','Florida State Parks','2601 Atlantic Ave, Fernandina Beach, FL 32034','Fernandina Beach','FL',92,true,now()),
('dutton-island-preserve','Dutton Island Preserve','Water','City of Atlantic Beach','793 Dutton Island Rd W, Atlantic Beach, FL 32233','Atlantic Beach','FL',83,true,now()),
('castaway-island-preserve','Castaway Island Preserve','Parks','City of Jacksonville','2921 San Pablo Rd S, Jacksonville, FL 32224','Jacksonville','FL',71,true,now()),
('julington-durbin-preserve','Julington-Durbin Preserve','Hiking','City of Jacksonville','13130 Bartram Park Blvd, Jacksonville, FL','Jacksonville','FL',63,true,now())
on conflict (place_id) do update set
 display_name=excluded.display_name,category=excluded.category,operator_name=excluded.operator_name,
 address=coalesce(excluded.address,public.trail_guide_place_profiles.address),city=excluded.city,state=excluded.state,
 completeness_score=greatest(public.trail_guide_place_profiles.completeness_score,excluded.completeness_score),
 is_published=true,last_verified_at=now(),updated_at=now();

insert into public.trail_guide_sources
(place_id,source_type,source_name,source_url,priority,status,last_checked_at)
values
('kathryn-abbey-hanna-park','official_website','City of Jacksonville · Kathryn Abbey Hanna Park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/kathryn-abbey-hanna-park',90,'active',now()),
('kathryn-abbey-hanna-park','official_website','City of Jacksonville · Camping at Hanna Park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/kathryn-abbey-hanna-park/camping-at-hanna-park',90,'active',now()),
('jacksonville-baldwin-rail-trail','official_website','City of Jacksonville · Jacksonville-Baldwin Rail Trail','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/jacksonville-baldwin-rail-trail',90,'active',now()),
('timucuan-ecological-and-historic-preserve','official_website','National Park Service · Timucuan Basic Information','https://www.nps.gov/timu/planyourvisit/basicinfo.htm',90,'active',now()),
('little-talbot-island-state-park','official_website','Florida State Parks · Little Talbot Island State Park','https://www.floridastateparks.org/parks-and-trails/little-talbot-island-state-park',90,'active',now()),
('big-talbot-island-state-park','official_website','Florida State Parks · Big Talbot Island State Park','https://www.floridastateparks.org/parks-and-trails/big-talbot-island-state-park',90,'active',now()),
('amelia-island-state-park','official_website','Florida State Parks · Amelia Island State Park','https://www.floridastateparks.org/amelia-island',90,'active',now()),
('fort-clinch-state-park','official_website','Florida State Parks · Fort Clinch State Park','https://www.floridastateparks.org/fortclinch',90,'active',now()),
('dutton-island-preserve','official_website','City of Atlantic Beach · Dutton Island Preserve','https://www.coab.us/163/Dutton-Island-Preserve',90,'active',now()),
('dutton-island-preserve','official_website','City of Atlantic Beach · Dutton Island Campsites','https://www.coab.us/620/Campsites-Dutton-Island',90,'active',now()),
('castaway-island-preserve','official_website','City of Jacksonville · Castaway Island Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/castaway-island-preserve',90,'active',now()),
('julington-durbin-preserve','official_website','City of Jacksonville · Preservation Parks','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/preservation-parks',90,'active',now())
on conflict (place_id,source_url) do update set
 source_type=excluded.source_type,source_name=excluded.source_name,priority=excluded.priority,status='active',
 last_checked_at=now(),last_error=null,updated_at=now();

with place_seed(place_id,source_url,facts) as (
 values
 ('kathryn-abbey-hanna-park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/kathryn-abbey-hanna-park','{"visit.hours": "8:00 AM–8:00 PM during daylight-saving season; 8:00 AM–6:00 PM during standard-time season", "visit.admission": "$5 per vehicle up to 6 people; $3 pedestrian/bicycle", "contact.phone": "904-255-6767", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "amenities.playground": true, "amenities.concession": true, "amenities.drinking_water": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.fishing": true, "activities.paddling": true, "activities.surfing": true, "launch.nonmotorized": true}'::jsonb),
 ('kathryn-abbey-hanna-park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/oceanfront-parks/kathryn-abbey-hanna-park/camping-at-hanna-park','{"amenities.showers": true, "amenities.laundry": true, "camping.tent": true, "camping.rv": true, "camping.cabins": true, "camping.site_count": 300, "electric.available": true, "water.hookup": true, "dump_station.available": true, "occupancy.max_people": 6, "pets.allowed": true, "pets.max_per_site": 3, "alcohol.allowed": false, "reservations.available": true, "pricing.tent_base": 18, "pricing.rv_base": 30, "pricing.cabin_base": 30, "pricing.currency": "USD", "stay_limit.rv_days": 30, "stay_limit.tent_days": 14, "stay_limit.window_days": 45}'::jsonb),
 ('jacksonville-baldwin-rail-trail','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/jacksonville-baldwin-rail-trail','{"visit.hours": "Sunrise–sundown", "visit.admission": "Free", "trail.distance_miles": 14.5, "trail.surface": "12-foot-wide paved trail with parallel equestrian trail", "parking.available": true, "amenities.restrooms": true, "amenities.drinking_water": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.picnicking": true}'::jsonb),
 ('timucuan-ecological-and-historic-preserve','https://www.nps.gov/timu/planyourvisit/basicinfo.htm','{"visit.hours": "Primary Fort Caroline and Kingsley Plantation visitor areas: 9:00 AM–5:00 PM Wednesday–Sunday; Cedar Point and Theodore Roosevelt Area: sunrise–sunset", "visit.admission": "Free", "contact.phone": "904-641-7155", "pets.allowed": true, "pets.leash_required": true, "amenities.picnic_tables": true, "amenities.wifi": false, "activities.hiking": true, "activities.birding": true, "activities.wildlife_viewing": true}'::jsonb),
 ('little-talbot-island-state-park','https://www.floridastateparks.org/parks-and-trails/little-talbot-island-state-park','{"visit.hours": "8:00 AM–sunset, 365 days a year", "visit.admission": "$5 vehicle up to 8 people; $4 single-occupant vehicle; $2 pedestrian/bicyclist/extra passenger", "contact.phone": "904-251-2320", "parking.available": true, "amenities.restrooms": true, "amenities.showers": true, "amenities.playground": true, "accessibility.wheelchair": true, "activities.hiking": true, "trail.distance_miles": 4, "activities.bicycling": true, "activities.birding": true, "activities.fishing": true, "activities.paddling": true, "activities.surfing": true, "activities.swimming": true, "launch.nonmotorized": true, "camping.tent": true, "camping.rv": true, "camping.site_count": 20, "camping.max_rv_length_ft": 30, "electric.available": true, "electric.amps": ["20", "30"], "water.potable_central": true, "dump_station.available": true, "fires.rings_only": true, "pets.allowed": true, "pets.leash_required": true, "pets.shoreline_allowed": false, "reservations.available": true, "pricing.tent_base": 24, "pricing.rv_base": 24, "pricing.currency": "USD", "alerts.current": "Duval County burn restrictions can prohibit campfires. Check current park alerts before arrival."}'::jsonb),
 ('big-talbot-island-state-park','https://www.floridastateparks.org/parks-and-trails/big-talbot-island-state-park','{"visit.hours": "8:00 AM–sundown; boat ramp open 24 hours", "visit.admission": "$3 per vehicle at Bluffs, Blackrock and Big Pine trail areas", "contact.phone": "904-251-2320", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.fishing": true, "activities.paddling": true, "activities.birding": true, "launch.boat": true, "pets.allowed": true, "pets.shoreline_allowed": false}'::jsonb),
 ('amelia-island-state-park','https://www.floridastateparks.org/amelia-island','{"visit.hours": "8:00 AM–sunset, 365 days a year", "visit.admission": "$2 per person", "contact.phone": "904-251-2320", "parking.available": true, "amenities.restrooms": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true, "alerts.current": "Beach parking is capacity-limited and temporary closures can occur when the park reaches capacity."}'::jsonb),
 ('fort-clinch-state-park','https://www.floridastateparks.org/fortclinch','{"visit.hours": "Park 8:00 AM–sunset; fort 9:00 AM–5:00 PM; visitor center 9:00 AM–4:30 PM", "visit.admission": "$6 per vehicle; additional fort admission applies", "contact.phone": "904-277-7274", "parking.available": true, "amenities.restrooms": true, "amenities.showers": true, "amenities.playground": true, "amenities.drinking_water": true, "amenities.laundry": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.birding": true, "activities.fishing": true, "activities.paddling": true, "activities.picnicking": true, "activities.surfing": true, "activities.swimming": true, "activities.wildlife_viewing": true, "camping.tent": true, "camping.rv": true, "camping.primitive": true, "camping.site_count": 69, "electric.available": true, "electric.amps": ["30", "50"], "water.hookup": true, "dump_station.available": true, "amenities.picnic_tables": true, "fires.rings_only": true, "reservations.available": true, "alerts.current": "The ranger station is temporarily closed for renovation. Check the park alert page for reopening status."}'::jsonb),
 ('dutton-island-preserve','https://www.coab.us/163/Dutton-Island-Preserve','{"visit.hours": "8:00 AM–dusk", "parking.available": true, "trail.distance_miles": 1.7, "activities.hiking": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true, "accessibility.wheelchair": true, "alcohol.allowed": false, "alerts.current": "King tides can flood the access road and campsites and may cause closures."}'::jsonb),
 ('dutton-island-preserve','https://www.coab.us/620/Campsites-Dutton-Island','{"camping.tent": true, "camping.rv": false, "camping.primitive": true, "camping.site_count": 5, "electric.available": false, "pricing.tent_base": 35, "pricing.currency": "USD", "reservations.available": true}'::jsonb),
 ('castaway-island-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/castaway-island-preserve','{"visit.hours": "Sunrise–sundown", "parking.available": true, "amenities.drinking_water": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.birding": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true, "activities.wildlife_viewing": true}'::jsonb),
 ('julington-durbin-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/preservation-parks','{"visit.hours": "Sunrise–sunset", "parking.available": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.paddling": true, "activities.picnicking": true, "activities.wildlife_viewing": true, "alerts.current": "Trail conditions and restroom availability can vary. Check current preserve information before visiting."}'::jsonb)
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