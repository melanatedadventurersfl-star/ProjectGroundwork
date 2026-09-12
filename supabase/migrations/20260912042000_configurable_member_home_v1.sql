-- Configurable Member Home V1
-- Preserve the current Go Melanated Trailhead as the outdoor/adventure variant
-- while new community experiences default to the reusable community home.

update public.organization_experiences e
set navigation = e.navigation || jsonb_build_object('home_variant', 'outdoor_adventure')
from public.organizations o
where e.organization_id = o.id
  and o.slug = 'go-melanated'
  and e.experience_key = 'primary';

update public.experience_blueprints
set default_settings = default_settings || jsonb_build_object('home_variant', 'community')
where code = 'community';
