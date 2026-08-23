-- Keep read-only community profiles in parity with the owner's profile data model.
-- In particular, adventure count must use the same member_journey source that powers
-- the owner profile so rank does not diverge between self and Trailmate views.

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
  featured_badges jsonb := '[]'::jsonb;
  featured_stamps jsonb := '[]'::jsonb;
  photo_albums jsonb := '[]'::jsonb;
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
    select count(*)::integer
      into adventure_total
      from public.member_journey mj
      where mj.profile_id = target_profile;
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

  if can_view and coalesce(p.badges_visible, true) then
    select coalesce(jsonb_agg(row_data order by earned_at desc), '[]'::jsonb)
      into featured_badges
      from (
        select jsonb_build_object(
          'badge_id', mb.badge_id,
          'title', b.title,
          'description', b.description,
          'icon_name', b.icon_name,
          'category', b.category,
          'earned_at', mb.earned_at
        ) as row_data,
        mb.earned_at
        from public.member_badges mb
        join public.badges b on b.id = mb.badge_id
        where mb.profile_id = target_profile
        order by mb.earned_at desc
        limit 6
      ) badges;
  end if;

  if can_view then
    select coalesce(jsonb_agg(row_data order by earned_at desc), '[]'::jsonb)
      into featured_stamps
      from (
        select jsonb_build_object(
          'stamp_id', mps.stamp_id,
          'code', ps.code,
          'title', ps.title,
          'description', ps.description,
          'icon_name', ps.icon_name,
          'earned_at', mps.earned_at,
          'adventure_id', mps.adventure_id
        ) as row_data,
        mps.earned_at
        from public.member_passport_stamps mps
        join public.passport_stamps ps on ps.id = mps.stamp_id
        where mps.profile_id = target_profile
        order by mps.earned_at desc
        limit 6
      ) stamps;
  end if;

  if can_view then
    select coalesce(jsonb_agg(album order by latest_at desc), '[]'::jsonb)
      into photo_albums
      from (
        select jsonb_build_object(
          'adventure_id', amp.adventure_id,
          'title', coalesce(a.title, 'Adventure photos'),
          'photo_count', count(*)::integer,
          'cover_url', (array_agg(amp.image_url order by amp.created_at desc))[1]
        ) as album,
        max(amp.created_at) as latest_at
        from public.adventure_memory_photos amp
        left join public.adventures a on a.id = amp.adventure_id
        where amp.profile_id = target_profile
          and amp.moderation_status::text = 'approved'
          and amp.visibility::text in ('group', 'public')
        group by amp.adventure_id, a.title
      ) albums;
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
    'post_count', post_total,
    'featured_badges', featured_badges,
    'featured_stamps', featured_stamps,
    'photo_albums', photo_albums
  );
end;
$$;

revoke all on function public.get_public_member_profile(uuid) from public;
grant execute on function public.get_public_member_profile(uuid) to authenticated;
