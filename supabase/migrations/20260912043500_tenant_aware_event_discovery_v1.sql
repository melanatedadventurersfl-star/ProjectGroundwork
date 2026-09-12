-- Tenant Aware Event Discovery V1
-- Preserve Go Melanated's outdoor discovery experience while new Community
-- experiences default to organization-scoped event discovery.

update public.organization_experiences e
set navigation = e.navigation || jsonb_build_object('events_variant', 'outdoor_adventure')
from public.organizations o
where e.organization_id = o.id
  and o.slug = 'go-melanated'
  and e.experience_key = 'primary';

update public.experience_blueprints
set default_settings = default_settings || jsonb_build_object('events_variant', 'community')
where code = 'community';
