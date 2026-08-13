revoke all on function public.ensure_adventure_group(uuid) from public;
revoke all on function public.sync_paid_order_experience() from public;

create or replace function public.attach_local_event_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
begin
  if new.group_id is not null then
    return new;
  end if;

  insert into public.community_groups (
    name,
    description,
    kind,
    city,
    state,
    image_url,
    visibility,
    created_by
  ) values (
    new.title,
    'Coordinate plans, questions, updates, and photos for this local event.',
    'local',
    new.city,
    new.state,
    new.image_url,
    'public',
    new.host_id
  )
  returning id into new_group_id;

  new.group_id := new_group_id;

  insert into public.community_group_members (group_id, profile_id, role)
  values (new_group_id, new.host_id, 'host')
  on conflict (group_id, profile_id) do update set role = 'host';

  return new;
end;
$$;

revoke all on function public.attach_local_event_group() from public;

drop trigger if exists local_events_attach_group on public.local_events;
create trigger local_events_attach_group
before insert on public.local_events
for each row execute function public.attach_local_event_group();

-- Starter interest spaces. These are intentionally broad so Groups stays useful
-- without becoming a full social network.
insert into public.community_groups (name, description, kind, visibility)
select values_to_add.name, values_to_add.description, 'interest', 'public'
from (
  values
    ('Camping', 'Camp setups, first nights outside, campsite tips, and weekend plans.'),
    ('Hiking', 'Trail talk, beginner questions, route ideas, and hiking meetups.'),
    ('Water Adventures', 'Kayaking, paddling, springs, beaches, and getting comfortable on the water.'),
    ('Family Adventures', 'Outdoor experiences, planning, and tips for families adventuring together.'),
    ('Beginner Outdoors', 'A low-pressure space for first trips, first gear questions, and building confidence outside.')
) as values_to_add(name, description)
where not exists (
  select 1 from public.community_groups g
  where g.kind = 'interest' and lower(g.name) = lower(values_to_add.name)
);

-- Existing local events receive a group if they predate the trigger.
do $$
declare
  event_row public.local_events;
  generated_group_id uuid;
begin
  for event_row in select * from public.local_events where group_id is null loop
    insert into public.community_groups (
      name, description, kind, city, state, image_url, visibility, created_by
    ) values (
      event_row.title,
      'Coordinate plans, questions, updates, and photos for this local event.',
      'local',
      event_row.city,
      event_row.state,
      event_row.image_url,
      'public',
      event_row.host_id
    ) returning id into generated_group_id;

    update public.local_events set group_id = generated_group_id where id = event_row.id;
    insert into public.community_group_members (group_id, profile_id, role)
    values (generated_group_id, event_row.host_id, 'host')
    on conflict (group_id, profile_id) do update set role = 'host';
  end loop;
end $$;
