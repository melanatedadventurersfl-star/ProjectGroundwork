-- Keep organization-owned outing sync safe for both INSERT and UPDATE trigger rows.

create or replace function public.sync_host_outing_to_primary_community()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group uuid;
begin
  if tg_op = 'UPDATE' then
    if old.platform_organization_id is distinct from new.platform_organization_id then
      delete from public.community_outings
      where adventure_id = new.id;
    elsif new.status <> 'published' then
      delete from public.community_outings
      where adventure_id = new.id;
      return new;
    else
      delete from public.community_outings
      where adventure_id = new.id
        and is_primary;
    end if;
  elsif new.status <> 'published' then
    delete from public.community_outings
    where adventure_id = new.id;
    return new;
  else
    delete from public.community_outings
    where adventure_id = new.id
      and is_primary;
  end if;

  if new.status <> 'published' then
    return new;
  end if;

  select o.primary_community_id
    into target_group
  from public.organizations o
  where o.id = new.platform_organization_id;

  if target_group is null then
    return new;
  end if;

  insert into public.community_outings (group_id, adventure_id, shared_by, is_primary)
  values (target_group, new.id, new.created_by, true)
  on conflict (group_id, adventure_id)
  do update set
    is_primary = true,
    shared_by = excluded.shared_by;

  return new;
end;
$$;
