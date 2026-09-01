create or replace function app_private.sync_host_campaign_task_dependencies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'complete' and old.status is distinct from 'complete' then
    update public.host_campaign_tasks dependent
    set status = 'not_started',
        updated_at = now(),
        updated_by = (select auth.uid())
    where dependent.campaign_id = new.campaign_id
      and dependent.status = 'blocked'
      and exists (
        select 1
        from public.host_campaign_task_dependencies rel
        where rel.task_id = dependent.id
          and rel.depends_on_task_id = new.id
      )
      and not exists (
        select 1
        from public.host_campaign_task_dependencies rel
        join public.host_campaign_tasks blocker on blocker.id = rel.depends_on_task_id
        where rel.task_id = dependent.id
          and blocker.status <> 'complete'
      );
  elsif old.status = 'complete' and new.status <> 'complete' then
    update public.host_campaign_tasks dependent
    set status = 'blocked',
        updated_at = now(),
        updated_by = (select auth.uid())
    where dependent.campaign_id = new.campaign_id
      and exists (
        select 1
        from public.host_campaign_task_dependencies rel
        where rel.task_id = dependent.id
          and rel.depends_on_task_id = new.id
      );
  end if;
  return new;
end;
$$;

revoke execute on function app_private.sync_host_campaign_task_dependencies() from public;
revoke execute on function app_private.sync_host_campaign_task_dependencies() from anon, authenticated;

drop trigger if exists host_campaign_task_dependency_transition on public.host_campaign_tasks;
create trigger host_campaign_task_dependency_transition
after update of status on public.host_campaign_tasks
for each row
when (old.status is distinct from new.status)
execute function app_private.sync_host_campaign_task_dependencies();
