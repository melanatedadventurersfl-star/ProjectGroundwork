create or replace function public.get_public_member_profile(target_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  p public.profiles%rowtype;
  connected boolean := false;
  can_view boolean := false;
  adventure_total integer := 0;
  stamp_total integer := 0;
  badge_total integer := 0;
  post_total integer := 0;
begin
  if viewer is null then
    raise exception 'Sign in required.';
  end if;

  select * into p
  from public.profiles
  where id = target_profile;

  if not found then
    return null;
  end if;

  if viewer <> target_profile then
    select exists (
      select 1
      from public.member_connections mc
      where mc.status::text = 'accepted'
        and ((mc.requester_id = viewer and mc.addressee_id = target_profile)
          or (mc.requester_id = target_profile and mc.addressee_id = viewer))
    ) into connected;
  end if;

  can_view := viewer = target_profile or not coalesce(p.profile_is_private, false) or connected;

  if can_view and coalesce(p.adventures_visible, true) then
    select count(distinct ac.adventure_id)::integer
      into adventure_total
      from public.adventure_check_ins ac
      where ac.attendee_id = target_profile;
  end if;

  if can_view then
    select count(*)::integer into stamp_total
      from public.member_passport_stamps mps
      where mps.profile_id = target_profile;
  end if;

  if can_view and coalesce(p.badges_visible, true) then
    select count(*)::integer into badge_total
      from public.member_badges mb
      where mb.profile_id = target_profile;
  end if;

  if can_view then
    select count(*)::integer into post_total
      from public.community_posts cp
      where cp.author_id = target_profile
        and cp.status::text = 'published';
  end if;

  return jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'cover_url', case when can_view then p.cover_url else null end,
    'bio', case when can_view then p.bio else null end,
    'home_city', case when can_view and coalesce(p.city_visible, true) then p.home_city else null end,
    'home_state', case when can_view and coalesce(p.city_visible, true) then p.home_state else null end,
    'profile_is_private', coalesce(p.profile_is_private, false),
    'platform_role', coalesce(p.platform_role, 'member'),
    'event_host_level', coalesce(p.event_host_level, 'member'),
    'interests', case when can_view and coalesce(p.interests_visible, true) then to_jsonb(p.interests) else 'null'::jsonb end,
    'pronouns', case when can_view and coalesce(p.pronouns_visible, true) then p.pronouns else null end,
    'created_at', p.created_at,
    'can_see_full_profile', can_view,
    'adventures_visible', coalesce(p.adventures_visible, true),
    'badges_visible', coalesce(p.badges_visible, true),
    'interests_visible', coalesce(p.interests_visible, true),
    'trail_family_visible', coalesce(p.trail_family_visible, true),
    'adventure_count', adventure_total,
    'stamp_count', stamp_total,
    'badge_count', badge_total,
    'post_count', post_total
  );
end;
$$;

revoke all on function public.get_public_member_profile(uuid) from public;
grant execute on function public.get_public_member_profile(uuid) to authenticated;
