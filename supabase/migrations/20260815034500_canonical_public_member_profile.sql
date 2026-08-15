create or replace function public.get_public_member_profile(target_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  p public.profiles%rowtype;
  connected boolean := false;
  is_self boolean := false;
  can_see_full boolean := false;
  adventure_count integer := 0;
  stamp_count integer := 0;
  badge_count integer := 0;
  post_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into p from public.profiles where id = target_profile;
  if p.id is null or p.status = 'suspended'::public.member_status then
    raise exception 'Profile not found';
  end if;

  is_self := auth.uid() = target_profile;
  select exists (
    select 1 from public.member_connections mc
    where mc.status = 'accepted'
      and ((mc.requester_id = auth.uid() and mc.addressee_id = target_profile)
        or (mc.addressee_id = auth.uid() and mc.requester_id = target_profile))
  ) into connected;

  can_see_full := is_self or connected or not p.profile_is_private;

  if can_see_full and p.adventures_visible then
    select count(distinct mps.adventure_id)::int into adventure_count
    from public.member_passport_stamps mps
    where mps.profile_id = target_profile and mps.adventure_id is not null;

    select count(*)::int into stamp_count
    from public.member_passport_stamps mps
    where mps.profile_id = target_profile;
  end if;

  if can_see_full and p.badges_visible then
    select count(*)::int into badge_count
    from public.member_badges mb
    where mb.profile_id = target_profile;
  end if;

  if can_see_full then
    select count(*)::int into post_count
    from public.community_posts cp
    where cp.author_id = target_profile and cp.status = 'published';
  end if;

  return jsonb_build_object(
    'id', p.id,
    'display_name', coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Member'),
    'username', p.username,
    'avatar_url', p.avatar_url,
    'bio', case when can_see_full then p.bio else null end,
    'home_city', case when p.city_visible then p.home_city else null end,
    'home_state', case when p.city_visible then p.home_state else null end,
    'profile_is_private', p.profile_is_private,
    'platform_role', p.platform_role,
    'event_host_level', p.event_host_level,
    'interests', case when can_see_full and p.interests_visible then p.interests else null end,
    'pronouns', case when can_see_full and p.pronouns_visible then p.pronouns else null end,
    'created_at', p.created_at,
    'can_see_full_profile', can_see_full,
    'adventures_visible', can_see_full and p.adventures_visible,
    'badges_visible', can_see_full and p.badges_visible,
    'interests_visible', can_see_full and p.interests_visible,
    'trail_family_visible', can_see_full and p.trail_family_visible,
    'adventure_count', adventure_count,
    'stamp_count', stamp_count,
    'badge_count', badge_count,
    'post_count', post_count
  );
end;
$$;

revoke all on function public.get_public_member_profile(uuid) from public, anon;
grant execute on function public.get_public_member_profile(uuid) to authenticated, service_role;
