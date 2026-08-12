alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists sms_consent_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_phone_number_check;

alter table public.profiles
  add constraint profiles_phone_number_check
  check (phone_number is null or phone_number ~ '^\+1[0-9]{10}$');

alter table public.households
  add column if not exists invite_code text;

update public.households
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.households
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  alter column invite_code set not null;

create unique index if not exists households_invite_code_key
  on public.households (invite_code);

create or replace function public.complete_member_onboarding_v2(
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_home_city text,
  p_home_state text,
  p_discovery_radius_miles integer,
  p_experience_level text,
  p_interests text[],
  p_communication_preferences jsonb,
  p_phone_number text,
  p_sms_consent boolean,
  p_accessibility_needs text,
  p_dietary_needs text,
  p_support_notes text,
  p_household_action text default 'skip',
  p_household_name text default null,
  p_household_invite_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_phone text := nullif(trim(p_phone_number), '');
  v_sms_enabled boolean := coalesce((p_communication_preferences ->> 'sms')::boolean, false);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_first_name), '') is null
     or nullif(trim(p_last_name), '') is null
     or nullif(trim(p_display_name), '') is null then
    raise exception 'Name information is required';
  end if;

  if nullif(trim(p_home_city), '') is null
     or trim(p_home_state) !~ '^[A-Z]{2}$' then
    raise exception 'A valid city and state are required';
  end if;

  if p_discovery_radius_miles not between 5 and 500 then
    raise exception 'Local adventure range is invalid';
  end if;

  if v_sms_enabled then
    if v_phone is null or v_phone !~ '^\+1[0-9]{10}$' then
      raise exception 'A valid US phone number is required for text messages';
    end if;
    if not coalesce(p_sms_consent, false) then
      raise exception 'SMS consent is required for text messages';
    end if;
  end if;

  update public.profiles
  set first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      display_name = nullif(trim(p_display_name), ''),
      home_city = nullif(trim(p_home_city), ''),
      home_state = upper(trim(p_home_state)),
      discovery_radius_miles = p_discovery_radius_miles,
      experience_level = p_experience_level,
      interests = coalesce(p_interests, '{}'),
      communication_preferences = coalesce(p_communication_preferences, '{}'::jsonb),
      phone_number = v_phone,
      sms_consent_at = case
        when v_sms_enabled and coalesce(p_sms_consent, false) then coalesce(sms_consent_at, now())
        else null
      end,
      accessibility_needs = nullif(trim(p_accessibility_needs), ''),
      dietary_needs = nullif(trim(p_dietary_needs), ''),
      support_notes = nullif(trim(p_support_notes), ''),
      onboarding_step = 6,
      onboarding_completed_at = now(),
      status = case when status = 'pending' then 'active' else status end
  where id = v_user_id;

  if p_household_action = 'create' then
    if nullif(trim(p_household_name), '') is null then
      raise exception 'Household name is required';
    end if;

    insert into public.households (name, created_by)
    values (trim(p_household_name), v_user_id)
    returning id into v_household_id;

    insert into public.household_members (
      household_id, profile_id, role, can_manage_bookings, can_manage_readiness
    ) values (
      v_household_id, v_user_id, 'owner', true, true
    );
  elsif p_household_action = 'join' then
    if nullif(trim(p_household_invite_code), '') is null then
      raise exception 'Household invite code is required';
    end if;

    select id into v_household_id
    from public.households
    where invite_code = upper(trim(p_household_invite_code));

    if v_household_id is null then
      raise exception 'Household invite code not found';
    end if;

    insert into public.household_members (
      household_id, profile_id, role, can_manage_bookings, can_manage_readiness
    ) values (
      v_household_id, v_user_id, 'adult', false, false
    ) on conflict (household_id, profile_id) do nothing;
  elsif p_household_action <> 'skip' then
    raise exception 'Household action is invalid';
  end if;

  return v_household_id;
end;
$$;

revoke all on function public.complete_member_onboarding_v2(
  text, text, text, text, text, integer, text, text[], jsonb, text, boolean, text, text, text, text, text, text
) from public, anon;

grant execute on function public.complete_member_onboarding_v2(
  text, text, text, text, text, integer, text, text[], jsonb, text, boolean, text, text, text, text, text, text
) to authenticated;
