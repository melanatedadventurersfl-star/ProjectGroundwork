-- Onboarding rewards: every member starts at the Trailhead, and members who
-- complete (not skip) the guided tutorial earn a permanent passport stamp.

insert into public.badges (code, title, description, icon_name, category)
values (
  'trailhead',
  'Trailhead',
  'Joined the Melanated Adventurers community and started your journey.',
  'trailhead',
  'onboarding'
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  category = excluded.category;

insert into public.passport_stamps (code, title, description, icon_name, category)
values (
  'tutorial-complete',
  'Trail Ready',
  'Completed the Melanated Adventurers guided tutorial and learned the lay of the land.',
  'compass',
  'onboarding'
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon_name = excluded.icon_name,
  category = excluded.category;

-- The original passport stamp key included adventure_id, which made that column
-- implicitly NOT NULL. Onboarding stamps are not tied to an adventure, so give
-- earned stamps their own row id while preserving event-stamp uniqueness.
alter table public.member_passport_stamps
  drop constraint if exists member_passport_stamps_pkey;

alter table public.member_passport_stamps
  add column if not exists id uuid default gen_random_uuid();

update public.member_passport_stamps
set id = gen_random_uuid()
where id is null;

alter table public.member_passport_stamps
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column adventure_id drop not null;

alter table public.member_passport_stamps
  add primary key (id);

create unique index if not exists member_passport_stamps_event_unique
  on public.member_passport_stamps (profile_id, stamp_id, adventure_id);

create unique index if not exists member_passport_stamps_non_adventure_unique
  on public.member_passport_stamps (profile_id, stamp_id)
  where adventure_id is null;

create or replace function public.award_trailhead_badge(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_badges (profile_id, badge_id, earned_at, evidence)
  select
    p.id,
    b.id,
    p.created_at,
    jsonb_build_object('source', 'account_creation')
  from public.profiles p
  join public.badges b on b.code = 'trailhead'
  where p.id = target_profile
  on conflict (profile_id, badge_id) do nothing;
end;
$$;

create or replace function public.on_profile_created_award_trailhead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_trailhead_badge(new.id);
  return new;
end;
$$;

drop trigger if exists profile_created_award_trailhead on public.profiles;
create trigger profile_created_award_trailhead
after insert on public.profiles
for each row execute function public.on_profile_created_award_trailhead();

-- Backfill the joining badge for members who existed before this reward shipped.
insert into public.member_badges (profile_id, badge_id, earned_at, evidence)
select
  p.id,
  b.id,
  p.created_at,
  jsonb_build_object('source', 'account_creation_backfill')
from public.profiles p
join public.badges b on b.code = 'trailhead'
on conflict (profile_id, badge_id) do nothing;

create or replace function public.award_tutorial_completion_stamp()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile uuid := auth.uid();
  tutorial_stamp uuid;
begin
  if target_profile is null then
    raise exception 'Authentication required';
  end if;

  select id into tutorial_stamp
  from public.passport_stamps
  where code = 'tutorial-complete';

  if tutorial_stamp is null then
    raise exception 'Tutorial completion stamp is not configured';
  end if;

  insert into public.member_passport_stamps (
    profile_id,
    stamp_id,
    adventure_id,
    earned_at,
    evidence
  )
  values (
    target_profile,
    tutorial_stamp,
    null,
    now(),
    jsonb_build_object('source', 'guided_tutorial_completion')
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.award_tutorial_completion_stamp() from public;
grant execute on function public.award_tutorial_completion_stamp() to authenticated;
