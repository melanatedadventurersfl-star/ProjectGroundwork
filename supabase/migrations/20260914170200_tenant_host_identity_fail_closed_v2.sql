-- Tenant Host Identity Fail-Closed V2
-- Reconcile only deterministic historical ownership links, then require every
-- future host identity write to carry an explicit platform organization.

-- Legacy host identities created before platform organizations have a direct,
-- deterministic ownership link through organizations.legacy_host_organization_id.
update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where o.legacy_host_organization_id = h.id
  and h.platform_organization_id is distinct from o.id;

-- Organizations can also declare their primary public host identity directly.
update public.host_organizations h
set platform_organization_id = o.id
from public.organizations o
where o.primary_host_organization_id = h.id
  and h.platform_organization_id is distinct from o.id;

-- Do not infer tenant ownership from the creator's currently selected organization
-- or from the platform default. Callers must provide platform_organization_id.
create or replace function private.sync_host_organization_platform()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  v_profile := coalesce(new.created_by, auth.uid());

  if new.platform_organization_id is null then
    raise exception 'A platform organization is required for every host profile';
  end if;

  if v_profile is not null
    and not private.is_organization_member(new.platform_organization_id, v_profile)
    and not private.is_platform_operator(v_profile)
  then
    raise exception 'Host profile owner does not belong to the selected organization';
  end if;

  return new;
end;
$$;

revoke all on function private.sync_host_organization_platform() from public;

comment on function private.sync_host_organization_platform() is
  'Validates explicit host-profile tenant ownership. Never infers ownership from active tenant or platform default.';
