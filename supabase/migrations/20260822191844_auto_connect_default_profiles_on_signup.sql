create table if not exists private.default_connection_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.default_connection_profiles from public, anon, authenticated;

insert into private.default_connection_profiles (profile_id)
select p.id
from public.profiles p
where (
    lower(coalesce(p.display_name, '')) = 'jonathan'
    and p.platform_role = 'founder'
  )
  or (
    lower(coalesce(p.first_name, '')) = 'shannette'
    and lower(coalesce(p.last_name, '')) = 'evans'
  )
on conflict (profile_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
  chosen_display_name text;
begin
  chosen_username := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  )), '');

  chosen_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    chosen_username,
    coalesce(chosen_display_name, chosen_username, 'Adventurer')
  );

  insert into public.member_connections (requester_id, addressee_id, status)
  select new.id, d.profile_id, 'accepted'
  from private.default_connection_profiles d
  where d.profile_id <> new.id
  on conflict do nothing;

  return new;
end;
$$;
