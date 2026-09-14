-- Keep the controlled Groundwork tenant free of routes that belong to the
-- platform-default member application. Resolve the target by stable
-- organization slug rather than a generated UUID.

with target_experience as (
  select oe.id
  from public.organization_experiences oe
  join public.organizations o on o.id = oe.organization_id
  where o.slug = 'groundwork-test-company'
    and oe.experience_key = 'primary'
)
update public.organization_experience_modules module
set
  route_key = null,
  enabled = case
    when module.module_code = 'memberships' then false
    else module.enabled
  end,
  updated_at = now()
where module.experience_id in (select id from target_experience)
  and module.module_code in (
    'events',
    'profiles',
    'memberships',
    'menu',
    'saved',
    'search',
    'directory'
  );
