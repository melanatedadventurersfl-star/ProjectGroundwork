insert into public.trail_guide_place_profiles
(place_id,display_name,category,operator_name,address,city,state,completeness_score,is_published,last_verified_at)
values
('theodore-roosevelt-area','Theodore Roosevelt Area','Hiking','National Park Service','13175 Mt Pleasant Rd, Jacksonville, FL 32225','Jacksonville','FL',65,true,now()),
('kingsley-plantation','Kingsley Plantation','Scenic','National Park Service','11676 Palmetto Ave, Jacksonville, FL 32226','Jacksonville','FL',69,true,now()),
('cedar-point','Cedar Point','Water','National Park Service','9023 Cedar Point Rd, Jacksonville, FL 32226','Jacksonville','FL',71,true,now()),
('pumpkin-hill-creek-preserve-state-park','Pumpkin Hill Creek Preserve State Park','Water','Florida State Parks','13802 Pumpkin Hill Rd, Jacksonville, FL 32226','Jacksonville','FL',79,true,now()),
('betz-tiger-point-preserve','Betz-Tiger Point Preserve','Hiking','City of Jacksonville','13990 Pumpkin Hill Rd, Jacksonville, FL 32226','Jacksonville','FL',69,true,now()),
('seaton-creek-historic-preserve','Seaton Creek Historic Preserve','Hiking','City of Jacksonville','2145 Gold Star Family Pkwy, Jacksonville, FL 32218','Jacksonville','FL',63,true,now()),
('cary-state-forest','Cary State Forest','Camping','Florida Forest Service','7465 Pavilion Rd, Bryceville, FL 32009','Bryceville','FL',77,true,now()),
('jennings-state-forest','Jennings State Forest','Hiking','Florida Forest Service','1337 Longhorn Rd, Middleburg, FL 32068','Middleburg','FL',83,true,now()),
('camp-milton-historic-preserve','Camp Milton Historic Preserve','Parks','City of Jacksonville','1225 Halsema Rd N, Jacksonville, FL 32220','Jacksonville','FL',63,true,now()),
('tillie-k-fowler-regional-park','Tillie K. Fowler Regional Park','Hiking','City of Jacksonville','7000 Roosevelt Blvd, Jacksonville, FL 32244','Jacksonville','FL',71,true,now())
on conflict (place_id) do update set
 display_name=excluded.display_name,category=excluded.category,operator_name=excluded.operator_name,
 address=coalesce(excluded.address,public.trail_guide_place_profiles.address),city=excluded.city,state=excluded.state,
 completeness_score=greatest(public.trail_guide_place_profiles.completeness_score,excluded.completeness_score),
 is_published=true,last_verified_at=now(),updated_at=now();

insert into public.trail_guide_sources
(place_id,source_type,source_name,source_url,priority,status,last_checked_at)
values
('theodore-roosevelt-area','official_website','National Park Service · Theodore Roosevelt Area','https://www.nps.gov/timu/planyourvisit/directions_theodorerooseveltarea.htm',90,'active',now()),
('kingsley-plantation','official_website','National Park Service · Kingsley Plantation','https://www.nps.gov/places/kingsley-plantation.htm',90,'active',now()),
('cedar-point','official_website','National Park Service · Cedar Point','https://www.nps.gov/timu/learn/historyculture/cedarpoint.htm',90,'active',now()),
('pumpkin-hill-creek-preserve-state-park','official_website','Florida State Parks · Pumpkin Hill Creek Preserve State Park','https://www.floridastateparks.org/parks-and-trails/pumpkin-hill-creek-preserve-state-park',90,'active',now()),
('betz-tiger-point-preserve','official_website','City of Jacksonville · Betz-Tiger Point Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/betz-tiger-point-preserve',90,'active',now()),
('seaton-creek-historic-preserve','official_website','City of Jacksonville · Seaton Creek Historic Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/seaton-creek-historic-preserve',90,'active',now()),
('cary-state-forest','official_website','Florida Forest Service · Cary State Forest','https://www.fdacs.gov/Forest-Wildfire/Our-Forests/State-Forests/Cary-State-Forest',90,'active',now()),
('jennings-state-forest','official_website','Florida Forest Service · Jennings State Forest','https://www.fdacs.gov/JenningsStateForest',90,'active',now()),
('camp-milton-historic-preserve','official_website','City of Jacksonville · Camp Milton Historic Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/camp-milton-historic-preserve',90,'active',now()),
('tillie-k-fowler-regional-park','official_website','City of Jacksonville · Tillie K. Fowler Regional Park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/tillie-k-fowler-regional-park',90,'active',now())
on conflict (place_id,source_url) do update set
 source_type=excluded.source_type,source_name=excluded.source_name,priority=excluded.priority,status='active',
 last_checked_at=now(),last_error=null,updated_at=now();

with place_seed(place_id,source_url,facts) as (
 values
 ('theodore-roosevelt-area','https://www.nps.gov/timu/planyourvisit/directions_theodorerooseveltarea.htm','{"visit.hours": "Sunrise–sunset; restrooms generally 9:00 AM–4:30 PM", "visit.admission": "Free", "contact.phone": "904-641-7155", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "pets.allowed": true, "pets.leash_required": true, "activities.hiking": true, "activities.wildlife_viewing": true}'::jsonb),
 ('kingsley-plantation','https://www.nps.gov/places/kingsley-plantation.htm','{"visit.hours": "Grounds 9:00 AM–5:00 PM Wednesday–Sunday; visitor contact station 9:00 AM–4:30 PM", "visit.admission": "Free", "contact.phone": "904-641-7155", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "launch.boat": true, "activities.picnicking": true, "activities.scenic": true, "pets.allowed": true, "pets.leash_required": true}'::jsonb),
 ('cedar-point','https://www.nps.gov/timu/learn/historyculture/cedarpoint.htm','{"visit.hours": "Sunrise–sunset", "visit.admission": "Free", "contact.phone": "904-641-7155", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "activities.hiking": true, "activities.bicycling": true, "activities.fishing": true, "activities.paddling": true, "activities.birding": true, "launch.boat": true, "activities.picnicking": true}'::jsonb),
 ('pumpkin-hill-creek-preserve-state-park','https://www.floridastateparks.org/parks-and-trails/pumpkin-hill-creek-preserve-state-park','{"visit.hours": "8:00 AM–sunset", "visit.admission": "Free", "contact.phone": "904-696-5980", "trail.distance_miles": 15, "parking.available": true, "amenities.restrooms": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.paddling": true, "activities.picnicking": true, "activities.birding": true, "activities.wildlife_viewing": true, "launch.nonmotorized": true, "pets.allowed": true}'::jsonb),
 ('betz-tiger-point-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/betz-tiger-point-preserve','{"visit.hours": "Sunrise–sundown", "parking.available": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.wildlife_viewing": true}'::jsonb),
 ('seaton-creek-historic-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/seaton-creek-historic-preserve','{"visit.hours": "Sunrise–sundown", "trail.distance_miles": 5, "parking.available": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "launch.nonmotorized": true, "activities.paddling": true}'::jsonb),
 ('cary-state-forest','https://www.fdacs.gov/Forest-Wildfire/Our-Forests/State-Forests/Cary-State-Forest','{"visit.hours": "Sunrise–sunset", "visit.admission": "$2 per person day-use fee; $45 annual pass", "contact.phone": "904-266-8398", "parking.available": true, "amenities.restrooms": true, "amenities.showers": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.picnicking": true, "activities.wildlife_viewing": true, "camping.tent": true, "camping.rv": true, "camping.primitive": true, "reservations.available": true}'::jsonb),
 ('jennings-state-forest','https://www.fdacs.gov/JenningsStateForest','{"visit.hours": "Sunrise–sunset", "visit.admission": "$2 per person day-use fee; $45 annual pass", "contact.phone": "904-406-6390", "parking.available": true, "amenities.restrooms": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.paddling": true, "activities.swimming": true, "activities.wildlife_viewing": true, "camping.tent": true, "camping.primitive": true, "camping.site_count": 8, "amenities.picnic_tables": true, "pets.allowed": true, "pets.leash_required": true, "reservations.available": true}'::jsonb),
 ('camp-milton-historic-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/camp-milton-historic-preserve','{"visit.hours": "Daylight hours", "parking.available": true, "amenities.drinking_water": true, "amenities.restrooms": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.scenic": true}'::jsonb),
 ('tillie-k-fowler-regional-park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/tillie-k-fowler-regional-park','{"visit.hours": "Daylight hours", "contact.phone": "904-255-6877", "parking.available": true, "amenities.drinking_water": true, "amenities.picnic_tables": true, "amenities.playground": true, "amenities.restrooms": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true}'::jsonb)
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