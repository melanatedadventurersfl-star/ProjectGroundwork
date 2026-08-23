create or replace function public.can_create_group_campfire(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.community_groups cg
      where cg.id = target_group_id
        and cg.kind = 'local'
    )
    and (
      app_private.is_master_account()
      or exists (
        select 1
        from public.community_group_members cgm
        where cgm.group_id = target_group_id
          and cgm.profile_id = auth.uid()
          and cgm.role in ('host', 'leader', 'moderator')
      )
    );
$$;

revoke all on function public.can_create_group_campfire(uuid) from public, anon;
grant execute on function public.can_create_group_campfire(uuid) to authenticated, service_role;
