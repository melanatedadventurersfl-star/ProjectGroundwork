create index if not exists host_campaign_tasks_assignee_profile_id_idx
  on public.host_campaign_tasks (assignee_profile_id)
  where assignee_profile_id is not null;

update public.host_campaign_tasks t
set assignee_profile_id = c.owner_profile_id,
    updated_at = now()
from public.host_campaigns c
join public.profiles p on p.id = c.owner_profile_id
where t.campaign_id = c.id
  and t.assignee_profile_id is null
  and lower(btrim(t.owner_label)) = lower(btrim(coalesce(p.display_name, p.first_name, p.username, '')));
