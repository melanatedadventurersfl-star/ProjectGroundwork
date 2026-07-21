alter table public.profiles
  add column if not exists discovery_radius_miles integer not null default 50,
  add column if not exists experience_level text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists communication_preferences jsonb not null default '{"push":true,"email":true,"sms":false}'::jsonb,
  add column if not exists accessibility_needs text,
  add column if not exists dietary_needs text,
  add column if not exists support_notes text,
  add column if not exists onboarding_step integer not null default 1;

alter table public.profiles
  add constraint profiles_discovery_radius_check
  check (discovery_radius_miles between 5 and 500);

alter table public.profiles
  add constraint profiles_experience_level_check
  check (experience_level is null or experience_level in ('new', 'beginner', 'intermediate', 'experienced'));

create or replace function public.complete_member_onboarding(
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_home_city text,
  p_home_state text,
  p_discovery_radius_miles integer,
  p_experience_level text,
  p_interests text[],
  p_communication_preferences jsonb,
  p_accessibility_needs text,
  p_dietary_needs text,
  p_support_notes text,
  p_household_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      display_name = nullif(trim(p_display_name), ''),
      home_city = nullif(trim(p_home_city), ''),
      home_state = nullif(trim(p_home_state), ''),
      discovery_radius_miles = p_discovery_radius_miles,
      experience_level = p_experience_level,
      interests = coalesce(p_interests, '{}'),
      communication_preferences = coalesce(p_communication_preferences, '{}'::jsonb),
      accessibility_needs = nullif(trim(p_accessibility_needs), ''),
      dietary_needs = nullif(trim(p_dietary_needs), ''),
      support_notes = nullif(trim(p_support_notes), ''),
      onboarding_step = 6,
      onboarding_completed_at = now(),
      status = case when status = 'pending' then 'active' else status end
  where id = v_user_id;

  if nullif(trim(p_household_name), '') is not null then
    insert into public.households (name, created_by)
    values (trim(p_household_name), v_user_id)
    returning id into v_household_id;

    insert into public.household_members (
      household_id, profile_id, role, can_manage_bookings, can_manage_readiness
    ) values (
      v_household_id, v_user_id, 'owner', true, true
    );
  end if;

  return v_household_id;
end;
$$;

grant execute on function public.complete_member_onboarding(
  text, text, text, text, text, integer, text, text[], jsonb, text, text, text, text
) to authenticated;
