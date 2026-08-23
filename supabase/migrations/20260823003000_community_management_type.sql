-- Distinguish Go Melanated-run communities from member-led communities.

alter table public.community_groups
  add column if not exists management_type text not null default 'member_led'
  check (management_type in ('official', 'member_led'));

-- Adventure-linked spaces are created from Go Melanated Adventures.
update public.community_groups
set management_type = 'official'
where kind = 'adventure';

-- These starter interest communities were seeded by Go Melanated.
update public.community_groups
set management_type = 'official'
where kind = 'interest'
  and lower(name) in (
    'camping',
    'hiking',
    'water adventures',
    'family adventures',
    'beginner outdoors'
  );

-- Local/event-created communities remain member-led by default.
