-- Groundwork uses the tenant experience shell. Stored module routes from the
-- platform-default application must never be used as fallback navigation.

with target_experience as (
  select oe.id
  from public.organization_experiences oe
  join public.organizations o on o.id = oe.organization_id
  where o.slug = 'groundwork-test-company'
    and oe.experience_key = 'primary'
)
update public.organization_experience_modules module
set route_key = null,
    updated_at = now()
where module.experience_id in (select id from target_experience)
  and module.route_key is not null;
