alter table public.host_vendor_profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_key text,
  add column if not exists sample_pricing jsonb not null default '{}'::jsonb,
  add column if not exists typical_setup jsonb not null default '{}'::jsonb,
  add column if not exists demo_event_count integer not null default 0 check (demo_event_count >= 0),
  add column if not exists rating numeric(2,1) check (rating is null or (rating >= 0 and rating <= 5));

create unique index if not exists host_vendor_profiles_demo_key_idx
  on public.host_vendor_profiles(demo_key)
  where demo_key is not null;

insert into public.host_vendor_profiles (
  business_name, category, description, contact_name, email, phone, website,
  social_links, service_area, brand_assets, documents, internal_notes,
  is_demo, demo_key, sample_pricing, typical_setup, demo_event_count, rating
) values
  ('Southern Smoke Kitchen', 'Catering', 'Full-service Southern comfort catering for outdoor events, private gatherings and festivals.', 'Avery Brooks', 'hello@southernsmoke.example.com', '(904) 555-0101', 'https://southernsmoke.example.com',
   '{"instagram":"@southernsmokedemo"}', 'Jacksonville and Northeast Florida',
   '{"logo":"demo://southern-smoke/logo","alternate_logo":"demo://southern-smoke/logo-alt","promo_images":["demo://southern-smoke/food-1","demo://southern-smoke/food-2"],"menu":"demo://southern-smoke/menu"}',
   '{"w9":"on_file","insurance":"on_file","food_permit":"on_file"}', 'DEMO VENDOR. Sample record for testing catering, menus, documents, pricing and event assignment.', true, 'demo-catering-southern-smoke',
   '{"per_person_from_cents":1800,"service_fee_cents":25000}', '{"booth_size":"10x20","power_required":true,"water_required":true}', 6, 4.8),

  ('Rolling Jerk Co.', 'Food Truck', 'Caribbean-inspired mobile food vendor with event service packages and high-volume festival setup.', 'Jordan Miles', 'events@rollingjerk.example.com', '(904) 555-0102', 'https://rollingjerk.example.com',
   '{"instagram":"@rollingjerkdemo"}', 'Jacksonville, St. Augustine and surrounding areas',
   '{"logo":"demo://rolling-jerk/logo","promo_images":["demo://rolling-jerk/truck","demo://rolling-jerk/plate"],"menu":"demo://rolling-jerk/menu"}',
   '{"w9":"on_file","insurance":"on_file","food_permit":"on_file"}', 'DEMO VENDOR. Sample food-truck profile for testing utilities, arrival windows and vendor communications.', true, 'demo-food-truck-rolling-jerk',
   '{"minimum_event_cents":90000,"average_plate_cents":1600}', '{"booth_size":"truck","power_required":false,"water_required":false}', 5, 4.7),

  ('Sweet Ember Bakery', 'Desserts', 'Dessert vendor offering cupcakes, cookies, mini pies and event dessert tables.', 'Nia Carter', 'orders@sweetember.example.com', '(904) 555-0103', 'https://sweetember.example.com',
   '{"instagram":"@sweetemberdemo"}', 'Jacksonville and Orange Park',
   '{"logo":"demo://sweet-ember/logo","alternate_logo":"demo://sweet-ember/logo-alt","promo_images":["demo://sweet-ember/dessert-table"],"price_sheet":"demo://sweet-ember/pricing"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample dessert business for marketing asset, price-sheet and event-history testing.', true, 'demo-dessert-sweet-ember',
   '{"dessert_table_from_cents":65000,"per_guest_from_cents":850}', '{"booth_size":"10x10","power_required":true,"water_required":false}', 4, 4.9),

  ('Good Vibes Mobile DJ', 'DJ / Entertainment', 'Mobile DJ and MC service for community events, outdoor gatherings and private celebrations.', 'Marcus Reed', 'bookings@goodvibesdj.example.com', '(904) 555-0104', 'https://goodvibesdj.example.com',
   '{"instagram":"@goodvibesdjdemo"}', 'Northeast Florida',
   '{"logo":"demo://good-vibes-dj/logo","promo_images":["demo://good-vibes-dj/setup"],"price_sheet":"demo://good-vibes-dj/pricing"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample entertainment vendor for contracts, schedules and production requirements.', true, 'demo-dj-good-vibes',
   '{"four_hour_package_cents":85000,"additional_hour_cents":12500}', '{"booth_size":"12x12","power_required":true,"water_required":false}', 7, 4.8),

  ('Trail Lens Photo Co.', 'Photographer', 'Outdoor event photography, candid coverage and branded event galleries.', 'Imani Lewis', 'hello@traillens.example.com', '(904) 555-0105', 'https://traillens.example.com',
   '{"instagram":"@traillensdemo"}', 'Florida travel available',
   '{"logo":"demo://trail-lens/logo","promo_images":["demo://trail-lens/gallery-1","demo://trail-lens/gallery-2"],"portfolio":"demo://trail-lens/portfolio"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample creative-services vendor for event assignment, deliverables and marketing usage.', true, 'demo-photo-trail-lens',
   '{"two_hour_cents":45000,"full_day_cents":120000}', '{"booth_size":"none","power_required":false,"water_required":false}', 8, 4.9),

  ('Camp Ready Rentals', 'Rentals', 'Event rental company for tables, chairs, tents, coolers, lighting and outdoor event equipment.', 'Chris Bennett', 'rentals@campready.example.com', '(904) 555-0106', 'https://campready.example.com',
   '{"instagram":"@campreadydemo"}', 'Jacksonville metro',
   '{"logo":"demo://camp-ready/logo","promo_images":["demo://camp-ready/equipment"],"price_sheet":"demo://camp-ready/catalog"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample rental vendor for quotes, procurement, delivery and return workflows.', true, 'demo-rentals-camp-ready',
   '{"chair_cents":800,"table_cents":1800,"tent_10x20_cents":17500}', '{"booth_size":"delivery","power_required":false,"water_required":false}', 9, 4.6),

  ('Wild Fern Event Design', 'Decor', 'Outdoor event styling, signage, themed decor and installation support.', 'Taylor Grant', 'design@wildfern.example.com', '(904) 555-0107', 'https://wildfern.example.com',
   '{"instagram":"@wildferndemo"}', 'North and Central Florida',
   '{"logo":"demo://wild-fern/logo","promo_images":["demo://wild-fern/setup-1","demo://wild-fern/setup-2"],"lookbook":"demo://wild-fern/lookbook"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample decor vendor for mood boards, installation schedules and production coordination.', true, 'demo-decor-wild-fern',
   '{"design_package_from_cents":95000}', '{"booth_size":"installation","power_required":true,"water_required":false}', 5, 4.7),

  ('Sentinel Event Services', 'Security', 'Event staffing for access control, overnight watch, entry support and incident response coordination.', 'Devon Price', 'ops@sentinelevents.example.com', '(904) 555-0108', 'https://sentinelevents.example.com',
   '{"website_label":"Demo security provider"}', 'Northeast and Central Florida',
   '{"logo":"demo://sentinel/logo","price_sheet":"demo://sentinel/rates"}',
   '{"w9":"on_file","insurance":"on_file","license":"on_file"}', 'DEMO VENDOR. Sample security provider. Never treat this profile as a real contracted safety resource.', true, 'demo-security-sentinel',
   '{"hourly_per_staff_cents":4800,"minimum_hours":4}', '{"booth_size":"none","power_required":false,"water_required":false}', 3, 4.5),

  ('Sunline Shuttle Co.', 'Transportation', 'Passenger shuttle service for event parking loops, hotel transfers and scheduled group transportation.', 'Renee Walker', 'events@sunlineshuttle.example.com', '(904) 555-0109', 'https://sunlineshuttle.example.com',
   '{"instagram":"@sunlineshuttledemo"}', 'North Florida',
   '{"logo":"demo://sunline/logo","promo_images":["demo://sunline/shuttle"],"price_sheet":"demo://sunline/rates"}',
   '{"w9":"on_file","insurance":"on_file","operating_license":"on_file"}', 'DEMO VENDOR. Sample transportation provider for route, driver and arrival planning.', true, 'demo-transport-sunline',
   '{"four_hour_shuttle_cents":125000}', '{"booth_size":"vehicle","power_required":false,"water_required":false}', 4, 4.6),

  ('Adventure Spark Experiences', 'Activities', 'Mobile event activities including field games, guided team challenges and family-friendly outdoor programming.', 'Kai Morgan', 'hello@adventurespark.example.com', '(904) 555-0110', 'https://adventurespark.example.com',
   '{"instagram":"@adventuresparkdemo"}', 'Florida',
   '{"logo":"demo://adventure-spark/logo","promo_images":["demo://adventure-spark/games"],"activity_catalog":"demo://adventure-spark/catalog"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample activity provider for schedules, capacity, supplies and assigned leads.', true, 'demo-activities-adventure-spark',
   '{"activity_block_from_cents":70000}', '{"booth_size":"20x20","power_required":false,"water_required":false}', 6, 4.8),

  ('Rooted Goods Market', 'Merchandise', 'Pop-up merchandise vendor featuring outdoor lifestyle goods, apparel and small-batch accessories.', 'Amina Wells', 'market@rootedgoods.example.com', '(904) 555-0111', 'https://rootedgoods.example.com',
   '{"instagram":"@rootedgoodsdemo"}', 'Jacksonville and regional travel',
   '{"logo":"demo://rooted-goods/logo","alternate_logo":"demo://rooted-goods/logo-alt","promo_images":["demo://rooted-goods/display"],"flyer":"demo://rooted-goods/flyer"}',
   '{"w9":"on_file","insurance":"pending"}', 'DEMO VENDOR. Sample merchandise profile intentionally includes one pending document state for UI testing.', true, 'demo-merch-rooted-goods',
   '{"vendor_fee_example_cents":15000}', '{"booth_size":"10x10","power_required":false,"water_required":false}', 2, 4.4),

  ('Pine & Palm Venue Services', 'Venue Services', 'Event-site support including setup coordination, trash stations, restroom servicing and venue-day logistics.', 'Morgan Ellis', 'events@pineandpalm.example.com', '(904) 555-0112', 'https://pineandpalm.example.com',
   '{"website_label":"Demo venue services"}', 'North Florida',
   '{"logo":"demo://pine-palm/logo","promo_images":["demo://pine-palm/site-support"],"service_sheet":"demo://pine-palm/services"}',
   '{"w9":"on_file","insurance":"on_file"}', 'DEMO VENDOR. Sample venue-support record for operational service testing.', true, 'demo-venue-services-pine-palm',
   '{"event_support_from_cents":60000}', '{"booth_size":"service","power_required":false,"water_required":false}', 5, 4.7)
on conflict (demo_key) do update set
  business_name = excluded.business_name,
  category = excluded.category,
  description = excluded.description,
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  website = excluded.website,
  social_links = excluded.social_links,
  service_area = excluded.service_area,
  brand_assets = excluded.brand_assets,
  documents = excluded.documents,
  internal_notes = excluded.internal_notes,
  is_demo = true,
  sample_pricing = excluded.sample_pricing,
  typical_setup = excluded.typical_setup,
  demo_event_count = excluded.demo_event_count,
  rating = excluded.rating,
  updated_at = now();