insert into public.badges (code, title, description, icon_name, category)
values ('group-explorer', 'Group Explorer', 'Joined your first community group.', 'people', 'community')
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  category = excluded.category;

create or replace function public.award_group_explorer_badge(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.community_group_members cgm
    where cgm.profile_id = target_profile
  ) then
    insert into public.member_badges (profile_id, badge_id, evidence)
    select target_profile, b.id, jsonb_build_object('source', 'first_group_join')
    from public.badges b
    where b.code = 'group-explorer'
    on conflict (profile_id, badge_id) do nothing;
  end if;
end;
$$;

create or replace function public.on_community_group_member_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_group_explorer_badge(new.profile_id);
  return new;
end;
$$;

drop trigger if exists community_group_member_badges on public.community_group_members;
create trigger community_group_member_badges
after insert on public.community_group_members
for each row execute function public.on_community_group_member_badges();

insert into public.member_badges (profile_id, badge_id, earned_at, evidence)
select distinct
  cgm.profile_id,
  b.id,
  min(cgm.joined_at) over (partition by cgm.profile_id),
  jsonb_build_object('source', 'group_membership_backfill')
from public.community_group_members cgm
join public.badges b on b.code = 'group-explorer'
on conflict (profile_id, badge_id) do nothing;
