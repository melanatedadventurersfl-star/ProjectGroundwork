create schema if not exists app_private;

create or replace function app_private.is_adventure_creator(target_adventure_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adventures a
    where a.id = target_adventure_id
      and a.created_by = auth.uid()
  );
$$;

revoke all on function app_private.is_adventure_creator(uuid) from public;
grant execute on function app_private.is_adventure_creator(uuid) to authenticated;

drop policy if exists "Adventure creators manage community access" on public.adventure_community_access;
drop policy if exists "Adventure creators insert community access" on public.adventure_community_access;
drop policy if exists "Adventure creators update community access" on public.adventure_community_access;
drop policy if exists "Adventure creators delete community access" on public.adventure_community_access;

create policy "Adventure creators insert community access"
on public.adventure_community_access for insert to authenticated
with check (app_private.is_adventure_creator(adventure_id));

create policy "Adventure creators update community access"
on public.adventure_community_access for update to authenticated
using (app_private.is_adventure_creator(adventure_id))
with check (app_private.is_adventure_creator(adventure_id));

create policy "Adventure creators delete community access"
on public.adventure_community_access for delete to authenticated
using (app_private.is_adventure_creator(adventure_id));

drop policy if exists "Private event access is readable" on public.adventure_private_access;
drop policy if exists "Event creators manage private access" on public.adventure_private_access;
drop policy if exists "Event creators insert private access" on public.adventure_private_access;
drop policy if exists "Event creators update private access" on public.adventure_private_access;
drop policy if exists "Event creators delete private access" on public.adventure_private_access;

create policy "Private event access is readable"
on public.adventure_private_access for select to authenticated
using (
  profile_id = auth.uid()
  or app_private.is_adventure_creator(adventure_id)
);

create policy "Event creators insert private access"
on public.adventure_private_access for insert to authenticated
with check (
  granted_by = auth.uid()
  and app_private.is_adventure_creator(adventure_id)
);

create policy "Event creators update private access"
on public.adventure_private_access for update to authenticated
using (app_private.is_adventure_creator(adventure_id))
with check (
  granted_by = auth.uid()
  and app_private.is_adventure_creator(adventure_id)
);

create policy "Event creators delete private access"
on public.adventure_private_access for delete to authenticated
using (app_private.is_adventure_creator(adventure_id));
