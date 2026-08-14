alter table public.profiles
add column if not exists cover_url text;

comment on column public.profiles.cover_url is 'Optional member-selected Trailhead/profile cover image URL. Null uses the app default scenic cover.';
