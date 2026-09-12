-- Platform resource organization scope
-- Adds tenant ownership to the existing operational roots without rewriting their
-- legacy RLS policies in the same release.

-- Events keep the existing organization_id -> host_organizations relationship.
-- platform_organization_id is the broader tenant boundary.
alter table public.adventures
  add column if not exists platform_organization_id uuid references public.organizations(id) on delete restrict;
create index if not exists adventures_platform_organization_idx
  on public.adventures(platform_organization_id, starts_at);

update public.adventures a
set platform_organization_id = coalesce(
  (select h.platform_organization_id from public.host_organizations h where h.id = a.organization_id),
  private.active_organization_for_profile(a.created_by),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where a.platform_organization_id is null;

alter table public.adventures alter column platform_organization_id set not null;

create or replace function private.set_adventure_platform_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    select h.platform_organization_id into v_org
    from public.host_organizations h
    where h.id = new.organization_id;
  end if;

  if v_org is not null then
    new.platform_organization_id := v_org;
  elsif new.platform_organization_id is null then
    new.platform_organization_id := private.active_organization_for_profile(new.created_by);
  elsif new.created_by is not null
    and not private.is_organization_member(new.platform_organization_id, new.created_by)
    and not private.is_platform_operator(new.created_by)
  then
    raise exception 'Event creator does not belong to the selected organization';
  end if;

  if new.platform_organization_id is null then
    select id into new.platform_organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_adventure_platform_organization() from public;
drop trigger if exists adventures_set_platform_organization on public.adventures;
create trigger adventures_set_platform_organization
before insert or update of organization_id, created_by, platform_organization_id
on public.adventures
for each row execute function private.set_adventure_platform_organization();

-- Campaigns are the event-operations root.
alter table public.host_campaigns
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
create index if not exists host_campaigns_organization_idx
  on public.host_campaigns(organization_id, starts_at);

update public.host_campaigns c
set organization_id = coalesce(
  (select a.platform_organization_id from public.adventures a where a.id = c.adventure_id),
  private.active_organization_for_profile(c.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where c.organization_id is null;

alter table public.host_campaigns alter column organization_id set not null;

create or replace function private.set_campaign_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_org uuid;
begin
  if new.adventure_id is not null then
    select a.platform_organization_id into v_event_org
    from public.adventures a
    where a.id = new.adventure_id;
  end if;

  if v_event_org is not null then
    new.organization_id := v_event_org;
  elsif new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(new.owner_profile_id);
  elsif new.owner_profile_id is not null
    and not private.is_organization_member(new.organization_id, new.owner_profile_id)
    and not private.is_platform_operator(new.owner_profile_id)
  then
    raise exception 'Campaign owner does not belong to the selected organization';
  end if;

  if new.organization_id is null then
    select id into new.organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_campaign_organization() from public;
drop trigger if exists host_campaigns_set_organization on public.host_campaigns;
create trigger host_campaigns_set_organization
before insert or update of adventure_id, owner_profile_id, organization_id
on public.host_campaigns
for each row execute function private.set_campaign_organization();

-- Campaign children inherit tenant ownership from the campaign. This prevents a child
-- task, communication, finance entry, analytic event, or vendor assignment from being
-- attached to a different tenant than its parent campaign.
alter table public.host_campaign_tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_communications
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_finance_entries
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_analytics_events
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_vendors
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists host_campaign_tasks_organization_idx
  on public.host_campaign_tasks(organization_id, campaign_id);
create index if not exists host_event_communications_organization_idx
  on public.host_event_communications(organization_id, campaign_id);
create index if not exists host_event_finance_entries_organization_idx
  on public.host_event_finance_entries(organization_id, campaign_id);
create index if not exists host_event_analytics_events_organization_idx
  on public.host_event_analytics_events(organization_id, campaign_id);
create index if not exists host_event_vendors_organization_idx
  on public.host_event_vendors(organization_id, campaign_id);

update public.host_campaign_tasks x
set organization_id = c.organization_id
from public.host_campaigns c
where x.campaign_id = c.id and x.organization_id is null;

update public.host_event_communications x
set organization_id = c.organization_id
from public.host_campaigns c
where x.campaign_id = c.id and x.organization_id is null;

update public.host_event_finance_entries x
set organization_id = c.organization_id
from public.host_campaigns c
where x.campaign_id = c.id and x.organization_id is null;

update public.host_event_analytics_events x
set organization_id = c.organization_id
from public.host_campaigns c
where x.campaign_id = c.id and x.organization_id is null;

update public.host_event_vendors x
set organization_id = c.organization_id
from public.host_campaigns c
where x.campaign_id = c.id and x.organization_id is null;

alter table public.host_campaign_tasks alter column organization_id set not null;
alter table public.host_event_communications alter column organization_id set not null;
alter table public.host_event_finance_entries alter column organization_id set not null;
alter table public.host_event_analytics_events alter column organization_id set not null;
alter table public.host_event_vendors alter column organization_id set not null;

create or replace function private.inherit_campaign_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.organization_id into new.organization_id
  from public.host_campaigns c
  where c.id = new.campaign_id;

  if new.organization_id is null then
    raise exception 'Campaign organization could not be resolved';
  end if;

  return new;
end;
$$;

revoke all on function private.inherit_campaign_organization() from public;

drop trigger if exists host_campaign_tasks_inherit_organization on public.host_campaign_tasks;
create trigger host_campaign_tasks_inherit_organization
before insert or update of campaign_id, organization_id on public.host_campaign_tasks
for each row execute function private.inherit_campaign_organization();

drop trigger if exists host_event_communications_inherit_organization on public.host_event_communications;
create trigger host_event_communications_inherit_organization
before insert or update of campaign_id, organization_id on public.host_event_communications
for each row execute function private.inherit_campaign_organization();

drop trigger if exists host_event_finance_entries_inherit_organization on public.host_event_finance_entries;
create trigger host_event_finance_entries_inherit_organization
before insert or update of campaign_id, organization_id on public.host_event_finance_entries
for each row execute function private.inherit_campaign_organization();

drop trigger if exists host_event_analytics_events_inherit_organization on public.host_event_analytics_events;
create trigger host_event_analytics_events_inherit_organization
before insert or update of campaign_id, organization_id on public.host_event_analytics_events
for each row execute function private.inherit_campaign_organization();

drop trigger if exists host_event_vendors_inherit_organization on public.host_event_vendors;
create trigger host_event_vendors_inherit_organization
before insert or update of campaign_id, organization_id on public.host_event_vendors
for each row execute function private.inherit_campaign_organization();

-- Shared business records that are not always attached to a campaign.
alter table public.host_vendor_profiles
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_library_items
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_communication_templates
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_opportunities
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_imports
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.host_event_import_files
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists host_vendor_profiles_organization_idx on public.host_vendor_profiles(organization_id);
create index if not exists host_library_items_organization_idx on public.host_library_items(organization_id);
create index if not exists host_communication_templates_organization_idx on public.host_communication_templates(organization_id);
create index if not exists host_opportunities_organization_idx on public.host_opportunities(organization_id);
create index if not exists host_event_imports_organization_idx on public.host_event_imports(organization_id);
create index if not exists host_event_import_files_organization_idx on public.host_event_import_files(organization_id);

update public.host_vendor_profiles x
set organization_id = coalesce(
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

update public.host_library_items x
set organization_id = coalesce(
  (select a.platform_organization_id from public.adventures a where a.id = x.source_event_id),
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

update public.host_communication_templates x
set organization_id = coalesce(
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

update public.host_opportunities x
set organization_id = coalesce(
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

update public.host_event_imports x
set organization_id = coalesce(
  (select a.platform_organization_id from public.adventures a where a.id = x.adventure_id),
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

update public.host_event_import_files x
set organization_id = coalesce(
  (select i.organization_id from public.host_event_imports i where i.id = x.import_id),
  private.active_organization_for_profile(x.owner_profile_id),
  (select o.id from public.organizations o where o.is_platform_default = true limit 1)
)
where x.organization_id is null;

alter table public.host_vendor_profiles alter column organization_id set not null;
alter table public.host_library_items alter column organization_id set not null;
alter table public.host_communication_templates alter column organization_id set not null;
alter table public.host_opportunities alter column organization_id set not null;
alter table public.host_event_imports alter column organization_id set not null;
alter table public.host_event_import_files alter column organization_id set not null;

create or replace function private.set_profile_owned_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  v_profile := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;

  if new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(v_profile);
  elsif v_profile is not null
    and not private.is_organization_member(new.organization_id, v_profile)
    and not private.is_platform_operator(v_profile)
  then
    raise exception 'Record owner does not belong to the selected organization';
  end if;

  if new.organization_id is null then
    select id into new.organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_profile_owned_organization() from public;

drop trigger if exists host_vendor_profiles_set_organization on public.host_vendor_profiles;
create trigger host_vendor_profiles_set_organization
before insert or update of owner_profile_id, organization_id on public.host_vendor_profiles
for each row execute function private.set_profile_owned_organization('owner_profile_id');

drop trigger if exists host_communication_templates_set_organization on public.host_communication_templates;
create trigger host_communication_templates_set_organization
before insert or update of owner_profile_id, organization_id on public.host_communication_templates
for each row execute function private.set_profile_owned_organization('owner_profile_id');

drop trigger if exists host_opportunities_set_organization on public.host_opportunities;
create trigger host_opportunities_set_organization
before insert or update of owner_profile_id, organization_id on public.host_opportunities
for each row execute function private.set_profile_owned_organization('owner_profile_id');

create or replace function private.set_library_item_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_event_id is not null then
    select a.platform_organization_id into new.organization_id
    from public.adventures a
    where a.id = new.source_event_id;
  end if;

  if new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(new.owner_profile_id);
  elsif new.owner_profile_id is not null
    and not private.is_organization_member(new.organization_id, new.owner_profile_id)
    and not private.is_platform_operator(new.owner_profile_id)
  then
    raise exception 'Library owner does not belong to the selected organization';
  end if;

  if new.organization_id is null then
    select id into new.organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_library_item_organization() from public;
drop trigger if exists host_library_items_set_organization on public.host_library_items;
create trigger host_library_items_set_organization
before insert or update of owner_profile_id, source_event_id, organization_id on public.host_library_items
for each row execute function private.set_library_item_organization();

create or replace function private.set_event_import_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.adventure_id is not null then
    select a.platform_organization_id into new.organization_id
    from public.adventures a
    where a.id = new.adventure_id;
  end if;

  if new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(new.owner_profile_id);
  elsif new.owner_profile_id is not null
    and not private.is_organization_member(new.organization_id, new.owner_profile_id)
    and not private.is_platform_operator(new.owner_profile_id)
  then
    raise exception 'Import owner does not belong to the selected organization';
  end if;

  if new.organization_id is null then
    select id into new.organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_event_import_organization() from public;
drop trigger if exists host_event_imports_set_organization on public.host_event_imports;
create trigger host_event_imports_set_organization
before insert or update of owner_profile_id, adventure_id, organization_id on public.host_event_imports
for each row execute function private.set_event_import_organization();

create or replace function private.set_event_import_file_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.import_id is not null then
    select i.organization_id into new.organization_id
    from public.host_event_imports i
    where i.id = new.import_id;
  end if;

  if new.organization_id is null then
    new.organization_id := private.active_organization_for_profile(new.owner_profile_id);
  end if;

  if new.organization_id is null then
    select id into new.organization_id
    from public.organizations
    where is_platform_default = true
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function private.set_event_import_file_organization() from public;
drop trigger if exists host_event_import_files_set_organization on public.host_event_import_files;
create trigger host_event_import_files_set_organization
before insert or update of import_id, owner_profile_id, organization_id on public.host_event_import_files
for each row execute function private.set_event_import_file_organization();

comment on column public.adventures.platform_organization_id is
  'Platform tenant that owns this event. Existing organization_id remains the public host identity relationship.';
comment on column public.host_campaigns.organization_id is
  'Platform tenant that owns this event operations workspace.';
comment on column public.host_vendor_profiles.organization_id is
  'Platform tenant that owns this vendor record.';

notify pgrst, 'reload schema';
