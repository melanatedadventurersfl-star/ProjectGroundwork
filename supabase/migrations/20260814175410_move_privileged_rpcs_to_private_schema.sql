-- Keep privileged implementations out of the exposed public RPC schema.

create or replace function app_private.is_adventure_staff(target_adventure uuid)
returns boolean language sql stable security definer set search_path = public, app_private as $$
  select auth.uid() is not null and exists (
    select 1 from public.adventure_staff_assignments asa
    where asa.adventure_id = target_adventure and asa.profile_id = auth.uid()
  );
$$;
create or replace function app_private.is_group_member(target_group_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private as $$
  select auth.uid() is not null and exists (
    select 1 from public.community_group_members gm
    where gm.group_id = target_group_id and gm.profile_id = auth.uid()
  );
$$;
create or replace function app_private.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id and hm.profile_id = auth.uid()
  );
$$;
create or replace function app_private.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private as $$
  select auth.uid() is not null and exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id and hm.profile_id = auth.uid() and hm.role = 'owner'
  );
$$;
create or replace function app_private.is_paid_adventure_attendee(target_adventure uuid, target_profile uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, app_private as $$
  select case
    when auth.uid() is null then false
    when target_profile <> auth.uid() and not app_private.is_master_account() then false
    else exists (
      select 1 from public.orders o
      where o.adventure_id = target_adventure
        and o.status = 'paid'::public.order_status
        and (o.purchaser_id = target_profile or exists (
          select 1 from public.order_attendees oa
          where oa.order_id = o.id and oa.profile_id = target_profile
        ))
    )
  end;
$$;

revoke all on function app_private.is_adventure_staff(uuid), app_private.is_group_member(uuid), app_private.is_household_member(uuid), app_private.is_household_owner(uuid), app_private.is_paid_adventure_attendee(uuid,uuid) from public, anon;
grant execute on function app_private.is_adventure_staff(uuid), app_private.is_group_member(uuid), app_private.is_household_member(uuid), app_private.is_household_owner(uuid), app_private.is_paid_adventure_attendee(uuid,uuid) to authenticated, service_role;

create or replace function public.is_adventure_staff(target_adventure uuid)
returns boolean language sql stable set search_path = app_private, public as $$ select app_private.is_adventure_staff(target_adventure); $$;
create or replace function public.is_group_member(target_group_id uuid)
returns boolean language sql stable set search_path = app_private, public as $$ select app_private.is_group_member(target_group_id); $$;
create or replace function public.is_household_member(target_household_id uuid)
returns boolean language sql stable set search_path = app_private, public as $$ select app_private.is_household_member(target_household_id); $$;
create or replace function public.is_household_owner(target_household_id uuid)
returns boolean language sql stable set search_path = app_private, public as $$ select app_private.is_household_owner(target_household_id); $$;
create or replace function public.is_paid_adventure_attendee(target_adventure uuid, target_profile uuid default auth.uid())
returns boolean language sql stable set search_path = app_private, public as $$ select app_private.is_paid_adventure_attendee(target_adventure, target_profile); $$;
revoke all on function public.is_adventure_staff(uuid), public.is_group_member(uuid), public.is_household_member(uuid), public.is_household_owner(uuid), public.is_paid_adventure_attendee(uuid,uuid) from public, anon;
grant execute on function public.is_adventure_staff(uuid), public.is_group_member(uuid), public.is_household_member(uuid), public.is_household_owner(uuid), public.is_paid_adventure_attendee(uuid,uuid) to authenticated, service_role;

create or replace function app_private.complete_member_onboarding_v2(
  p_first_name text, p_last_name text, p_display_name text, p_home_city text, p_home_state text,
  p_discovery_radius_miles integer, p_experience_level text, p_interests text[], p_communication_preferences jsonb,
  p_phone_number text, p_sms_consent boolean, p_accessibility_needs text, p_dietary_needs text, p_support_notes text,
  p_household_action text default 'skip', p_household_name text default null, p_household_invite_code text default null
)
returns uuid language plpgsql security definer set search_path = public, app_private as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_phone text := nullif(trim(p_phone_number), '');
  v_sms_enabled boolean := coalesce((p_communication_preferences ->> 'sms')::boolean, false);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null or nullif(trim(p_display_name), '') is null then raise exception 'Name information is required'; end if;
  if nullif(trim(p_home_city), '') is null or trim(p_home_state) !~ '^[A-Z]{2}$' then raise exception 'A valid city and state are required'; end if;
  if p_discovery_radius_miles not between 5 and 500 then raise exception 'Local adventure range is invalid'; end if;
  if v_sms_enabled then
    if v_phone is null or v_phone !~ '^\\+1[0-9]{10}$' then raise exception 'A valid US phone number is required for text messages'; end if;
    if not coalesce(p_sms_consent, false) then raise exception 'SMS consent is required for text messages'; end if;
  end if;

  update public.profiles set
    first_name = nullif(trim(p_first_name), ''), last_name = nullif(trim(p_last_name), ''), display_name = nullif(trim(p_display_name), ''),
    home_city = nullif(trim(p_home_city), ''), home_state = upper(trim(p_home_state)), discovery_radius_miles = p_discovery_radius_miles,
    experience_level = p_experience_level, interests = coalesce(p_interests, '{}'), communication_preferences = coalesce(p_communication_preferences, '{}'::jsonb),
    phone_number = v_phone,
    sms_consent_at = case when v_sms_enabled and coalesce(p_sms_consent, false) then coalesce(sms_consent_at, now()) else null end,
    accessibility_needs = nullif(trim(p_accessibility_needs), ''), dietary_needs = nullif(trim(p_dietary_needs), ''), support_notes = nullif(trim(p_support_notes), ''),
    onboarding_step = 6, onboarding_completed_at = now(), status = case when status = 'pending' then 'active' else status end
  where id = v_user_id;

  if p_household_action = 'create' then
    if nullif(trim(p_household_name), '') is null then raise exception 'Household name is required'; end if;
    insert into public.households (name, created_by) values (trim(p_household_name), v_user_id) returning id into v_household_id;
    insert into public.household_members (household_id, profile_id, role, can_manage_bookings, can_manage_readiness)
    values (v_household_id, v_user_id, 'owner', true, true);
  elsif p_household_action = 'join' then
    if nullif(trim(p_household_invite_code), '') is null then raise exception 'Household invite code is required'; end if;
    select id into v_household_id from public.households where invite_code = upper(trim(p_household_invite_code));
    if v_household_id is null then raise exception 'Household invite code not found'; end if;
    insert into public.household_members (household_id, profile_id, role, can_manage_bookings, can_manage_readiness)
    values (v_household_id, v_user_id, 'adult', false, false)
    on conflict (household_id, profile_id) do nothing;
  elsif p_household_action <> 'skip' then
    raise exception 'Household action is invalid';
  end if;
  return v_household_id;
end;
$$;
revoke all on function app_private.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) from public, anon;
grant execute on function app_private.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) to authenticated, service_role;

create or replace function public.complete_member_onboarding_v2(
  p_first_name text, p_last_name text, p_display_name text, p_home_city text, p_home_state text,
  p_discovery_radius_miles integer, p_experience_level text, p_interests text[], p_communication_preferences jsonb,
  p_phone_number text, p_sms_consent boolean, p_accessibility_needs text, p_dietary_needs text, p_support_notes text,
  p_household_action text default 'skip', p_household_name text default null, p_household_invite_code text default null
)
returns uuid language sql set search_path = app_private, public as $$
  select app_private.complete_member_onboarding_v2(
    p_first_name,p_last_name,p_display_name,p_home_city,p_home_state,p_discovery_radius_miles,p_experience_level,p_interests,
    p_communication_preferences,p_phone_number,p_sms_consent,p_accessibility_needs,p_dietary_needs,p_support_notes,
    p_household_action,p_household_name,p_household_invite_code
  );
$$;
revoke all on function public.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) from public, anon;
grant execute on function public.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) to authenticated, service_role;

create or replace function app_private.create_household(household_name text)
returns uuid language plpgsql security definer set search_path = public, app_private as $$
declare new_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(household_name), '') is null then raise exception 'Household name is required'; end if;
  insert into public.households (name, created_by) values (trim(household_name), auth.uid()) returning id into new_household_id;
  insert into public.household_members (household_id, profile_id, role, can_manage_bookings, can_manage_readiness)
  values (new_household_id, auth.uid(), 'owner', true, true);
  return new_household_id;
end;
$$;
revoke all on function app_private.create_household(text) from public, anon;
grant execute on function app_private.create_household(text) to authenticated, service_role;
create or replace function public.create_household(household_name text)
returns uuid language sql set search_path = app_private, public as $$ select app_private.create_household(household_name); $$;
revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated, service_role;

create or replace function app_private.recalculate_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public, app_private as $$
declare result public.orders;
begin
  if not exists (select 1 from public.orders where id = p_order_id and purchaser_id = auth.uid()) then raise exception 'Order not found'; end if;
  update public.orders o
  set subtotal_cents = coalesce((select sum(line_total_cents) from public.order_items where order_id = p_order_id),0),
      total_cents = coalesce((select sum(line_total_cents) from public.order_items where order_id = p_order_id),0)
  where o.id = p_order_id returning * into result;
  return result;
end;
$$;
revoke all on function app_private.recalculate_order(uuid) from public, anon;
grant execute on function app_private.recalculate_order(uuid) to authenticated, service_role;
create or replace function public.recalculate_order(p_order_id uuid)
returns public.orders language sql set search_path = app_private, public as $$ select app_private.recalculate_order(p_order_id); $$;
revoke all on function public.recalculate_order(uuid) from public, anon;
grant execute on function public.recalculate_order(uuid) to authenticated, service_role;

create or replace function app_private.hold_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public, app_private as $$
declare result public.orders;
begin
  perform app_private.recalculate_order(p_order_id);
  if not exists (select 1 from public.orders where id = p_order_id and purchaser_id = auth.uid() and status in ('draft','held')) then raise exception 'Order unavailable'; end if;
  update public.orders set status='held', hold_expires_at=now()+interval '15 minutes' where id=p_order_id returning * into result;
  return result;
end;
$$;
revoke all on function app_private.hold_order(uuid) from public, anon;
grant execute on function app_private.hold_order(uuid) to authenticated, service_role;
create or replace function public.hold_order(p_order_id uuid)
returns public.orders language sql set search_path = app_private, public as $$ select app_private.hold_order(p_order_id); $$;
revoke all on function public.hold_order(uuid) from public, anon;
grant execute on function public.hold_order(uuid) to authenticated, service_role;

create or replace function app_private.seed_member_readiness(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare target_order public.orders;
begin
  select * into target_order from public.orders where id = p_order_id and purchaser_id = auth.uid();
  if target_order.id is null then raise exception 'Order not found'; end if;
  insert into public.member_readiness_items (profile_id, order_id, adventure_id, requirement_id, category, title, description, due_at, is_required, blocks_check_in)
  select auth.uid(), target_order.id, target_order.adventure_id, r.id, r.category, r.title, r.description, r.due_at, r.is_required, r.blocks_check_in
  from public.adventure_requirements r where r.adventure_id = target_order.adventure_id
  on conflict (profile_id, order_id, requirement_id) do nothing;
end;
$$;
revoke all on function app_private.seed_member_readiness(uuid) from public, anon;
grant execute on function app_private.seed_member_readiness(uuid) to authenticated, service_role;
create or replace function public.seed_member_readiness(p_order_id uuid)
returns void language sql set search_path = app_private, public as $$ select app_private.seed_member_readiness(p_order_id); $$;
revoke all on function public.seed_member_readiness(uuid) from public, anon;
grant execute on function public.seed_member_readiness(uuid) to authenticated, service_role;

create or replace function app_private.fan_out_announcement(announcement_uuid uuid)
returns integer language plpgsql security definer set search_path = public, app_private as $$
declare created_count integer; target public.announcements;
begin
  select * into target from public.announcements where id = announcement_uuid;
  if target.id is null then raise exception 'Announcement not found'; end if;
  if target.created_by <> auth.uid() and not app_private.is_adventure_staff(target.adventure_id) and not app_private.is_master_account() then raise exception 'Not authorized'; end if;
  insert into public.notifications (recipient_id, adventure_id, announcement_id, kind, priority, title, body, action_url, dedupe_key)
  select distinct o.purchaser_id, target.adventure_id, target.id, target.kind, target.priority, target.title, target.body, target.action_url,
    'announcement:' || target.id::text || ':' || o.purchaser_id::text
  from public.orders o where o.adventure_id = target.adventure_id and o.status = 'paid'
  on conflict (recipient_id, dedupe_key) do nothing;
  get diagnostics created_count = row_count;
  return created_count;
end;
$$;
revoke all on function app_private.fan_out_announcement(uuid) from public, anon;
grant execute on function app_private.fan_out_announcement(uuid) to authenticated, service_role;
create or replace function public.fan_out_announcement(announcement_uuid uuid)
returns integer language sql set search_path = app_private, public as $$ select app_private.fan_out_announcement(announcement_uuid); $$;
revoke all on function public.fan_out_announcement(uuid) from public, anon;
grant execute on function public.fan_out_announcement(uuid) to authenticated, service_role;
