insert into public.trail_guide_place_profiles
(place_id,display_name,category,operator_name,address,city,state,completeness_score,is_published,last_verified_at)
values
('jacksonville-arboretum-and-botanical-gardens','Jacksonville Arboretum & Botanical Gardens','Parks','Jacksonville Arboretum & Botanical Gardens','1445 Millcoe Rd, Jacksonville, FL 32225','Jacksonville','FL',63,true,now()),
('tree-hill-nature-center','Tree Hill Nature Center','Parks','Tree Hill Nature Center','7152 Lone Star Rd, Jacksonville, FL 32211','Jacksonville','FL',65,true,now()),
('reddie-point-preserve','Reddie Point Preserve','Water','City of Jacksonville','4499 Yachtsman Way, Jacksonville, FL 32277','Jacksonville','FL',69,true,now()),
('blue-cypress-park','Blue Cypress Park','Parks','City of Jacksonville','4012 University Blvd N, Jacksonville, FL 32277','Jacksonville','FL',71,true,now()),
('ringhaver-park','Ringhaver Park','Water','City of Jacksonville','5198 118th St, Jacksonville, FL 32244','Jacksonville','FL',67,true,now()),
('bulls-bay-preserve','Bulls Bay Preserve','Hiking','City of Jacksonville','8017 Old Plank Rd, Jacksonville, FL 32220','Jacksonville','FL',61,true,now()),
('thomas-creek-conservation-area','Thomas Creek Conservation Area','Hiking','St. Johns River Water Management District',null,'Jacksonville','FL',61,true,now()),
('twelve-mile-swamp-conservation-area','Twelve Mile Swamp Conservation Area','Hiking','St. Johns River Water Management District',null,'St. Johns County','FL',57,true,now()),
('guana-tolomato-matanzas-nerr','Guana Tolomato Matanzas NERR','Scenic','GTM Research Reserve','505 Guana River Rd, Ponte Vedra Beach, FL 32082','Ponte Vedra Beach','FL',65,true,now()),
('guana-river-wildlife-management-area','Guana River Wildlife Management Area','Hiking','Florida Fish and Wildlife Conservation Commission',null,'Ponte Vedra Beach','FL',61,true,now())
on conflict (place_id) do update set
 display_name=excluded.display_name,category=excluded.category,operator_name=excluded.operator_name,
 address=coalesce(excluded.address,public.trail_guide_place_profiles.address),city=excluded.city,state=excluded.state,
 completeness_score=greatest(public.trail_guide_place_profiles.completeness_score,excluded.completeness_score),
 is_published=true,last_verified_at=now(),updated_at=now();

insert into public.trail_guide_sources
(place_id,source_type,source_name,source_url,priority,status,last_checked_at)
values
('jacksonville-arboretum-and-botanical-gardens','official_website','Jacksonville Arboretum · Visit','https://jacksonvillearboretum.org/visit',90,'active',now()),
('tree-hill-nature-center','official_website','Tree Hill Nature Center · Visit','https://www.treehill.org/visit',90,'active',now()),
('tree-hill-nature-center','official_rules','Tree Hill Nature Center · Park Rules','https://www.treehill.org/visit/park-rules',95,'active',now()),
('reddie-point-preserve','official_website','City of Jacksonville · Reddie Point Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/reddie-point-preserve',90,'active',now()),
('blue-cypress-park','official_website','City of Jacksonville · Blue Cypress Park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/blue-cypress-park%2C-community-center-golf-course',90,'active',now()),
('ringhaver-park','official_website','City of Jacksonville · Ringhaver Park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/ringhaver-park',90,'active',now()),
('bulls-bay-preserve','official_website','City of Jacksonville · Bulls Bay Preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/bulls-bay-preserve',90,'active',now()),
('thomas-creek-conservation-area','official_website','SJRWMD · Thomas Creek Conservation Area','https://www.sjrwmd.com/lands/recreation/thomas-creek/',90,'active',now()),
('twelve-mile-swamp-conservation-area','official_website','SJRWMD · Twelve Mile Swamp Conservation Area','https://www.sjrwmd.com/lands/recreation/twelve-mile-swamp/',90,'active',now()),
('guana-tolomato-matanzas-nerr','official_website','GTM Research Reserve · Visit','https://gtmnerr.org/visit/',90,'active',now()),
('guana-river-wildlife-management-area','official_website','Florida FWC · Guana River','https://myfwc.com/recreation/lead/guana-river/',90,'active',now())
on conflict (place_id,source_url) do update set
 source_type=excluded.source_type,source_name=excluded.source_name,priority=excluded.priority,status='active',
 last_checked_at=now(),last_error=null,updated_at=now();

with place_seed(place_id,source_url,facts) as (
 values
 ('jacksonville-arboretum-and-botanical-gardens','https://jacksonvillearboretum.org/visit','{"visit.hours": "March 12–November 5: 8:00 AM–7:00 PM; November 6–March 11: 8:00 AM–5:00 PM; last entry 30 minutes before close", "visit.admission": "$3 adult; children age 3 and under free; bus/van parking $30", "contact.phone": "904-318-4342", "parking.available": true, "amenities.restrooms": true, "amenities.drinking_water": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.bicycling": false}'::jsonb),
 ('tree-hill-nature-center','https://www.treehill.org/visit','{"visit.hours": "Monday–Saturday 8:00 AM–4:30 PM; last admission 4:00 PM", "visit.admission": "$6 adult; $5 senior/student/military/teacher; $4 ages 3–17; ages 2 and under free", "contact.phone": "904-724-4646", "parking.available": true, "trail.distance_miles": 2.3, "activities.hiking": true}'::jsonb),
 ('tree-hill-nature-center','https://www.treehill.org/visit/park-rules','{"amenities.picnic_tables": true, "pets.allowed": false, "activities.bicycling": false, "alcohol.allowed": false}'::jsonb),
 ('reddie-point-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/reddie-point-preserve','{"visit.hours": "Sunrise–sundown", "parking.available": true, "amenities.drinking_water": true, "amenities.restrooms": true, "amenities.picnic_tables": true, "activities.hiking": true, "activities.birding": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "launch.boat": true, "activities.picnicking": true}'::jsonb),
 ('blue-cypress-park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/blue-cypress-park%2C-community-center-golf-course','{"visit.hours": "Daylight hours", "contact.phone": "904-255-6780", "parking.available": true, "amenities.concession": true, "amenities.drinking_water": true, "amenities.playground": true, "amenities.restrooms": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.fishing": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true}'::jsonb),
 ('ringhaver-park','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/ringhaver-park','{"visit.hours": "Daylight hours", "parking.available": true, "amenities.concession": true, "amenities.drinking_water": true, "amenities.playground": true, "amenities.restrooms": true, "accessibility.wheelchair": true, "activities.hiking": true, "activities.paddling": true, "launch.nonmotorized": true, "activities.picnicking": true}'::jsonb),
 ('bulls-bay-preserve','https://www.jacksonville.gov/departments/parks-and-recreation/jaxparks/all-parks/bulls-bay-preserve','{"visit.hours": "Sunrise–sundown", "trail.distance_miles": 2, "parking.available": true, "amenities.picnic_tables": true, "amenities.restrooms": true, "activities.hiking": true, "activities.bicycling": true, "activities.picnicking": true}'::jsonb),
 ('thomas-creek-conservation-area','https://www.sjrwmd.com/lands/recreation/thomas-creek/','{"visit.admission": "Free", "parking.available": true, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.wildlife_viewing": true, "trail.distance_miles": 3, "alerts.current": "Some trails are seasonally flooded and the area is open to regulated hunting. Check current conditions and hunt schedules."}'::jsonb),
 ('twelve-mile-swamp-conservation-area','https://www.sjrwmd.com/lands/recreation/twelve-mile-swamp/','{"visit.admission": "Free", "trail.distance_miles": 2.2, "activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.wildlife_viewing": true}'::jsonb),
 ('guana-tolomato-matanzas-nerr','https://gtmnerr.org/visit/','{"visit.hours": "Visitor Center Tuesday–Saturday 9:00 AM–4:00 PM; Guana Dam 4:00 AM–9:00 PM daily; trail and beach lots 8:00 AM–sunset", "visit.admission": "Visitor Center: $3 per group up to 5 for ages 12+; under 12 free. Guana lots/dam: $3 vehicle plus tax; $1 pedestrian/bicyclist/extra passenger.", "contact.phone": "904-380-8600", "parking.available": true, "amenities.restrooms": true, "activities.hiking": true, "activities.paddling": true, "activities.birding": true, "activities.wildlife_viewing": true, "activities.scenic": true}'::jsonb),
 ('guana-river-wildlife-management-area','https://myfwc.com/recreation/lead/guana-river/','{"activities.hiking": true, "activities.bicycling": true, "activities.equestrian": true, "activities.fishing": true, "activities.paddling": true, "activities.birding": true, "activities.wildlife_viewing": true, "alerts.current": "This is an active wildlife management area with scheduled hunts. Access restrictions can apply during quota hunts and fluorescent orange is encouraged during hunt periods."}'::jsonb)
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