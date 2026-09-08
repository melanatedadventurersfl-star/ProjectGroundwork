-- Keep the signup-only username internal. A member-facing display name should come
-- from onboarding unless the signup flow explicitly provides one.
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
    coalesce(chosen_display_name, 'Adventurer')
  );

  insert into public.member_connections (requester_id, addressee_id, status)
  select new.id, d.profile_id, 'accepted'
  from private.default_connection_profiles d
  where d.profile_id <> new.id
  on conflict do nothing;

  return new;
end;
$$;

-- Repair incomplete signups that already exposed the generated username as the
-- display name. Preserve completed profiles and any custom display name.
update public.profiles
set display_name = coalesce(
  nullif(trim(concat_ws(' ', first_name, last_name)), ''),
  'Adventurer'
)
where onboarding_completed_at is null
  and nullif(trim(username), '') is not null
  and trim(coalesce(display_name, '')) = trim(username);
