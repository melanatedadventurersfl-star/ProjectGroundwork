create or replace function public.creator_get_member_insights(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  result jsonb;
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Member not found';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'email', p.email,
      'phone_number', p.phone_number,
      'avatar_url', p.avatar_url,
      'status', p.status,
      'platform_role', p.platform_role,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'onboarding_completed_at', p.onboarding_completed_at,
      'onboarding_step', p.onboarding_step
    ),
    'auth', jsonb_build_object(
      'last_sign_in_at', u.last_sign_in_at,
      'auth_created_at', u.created_at,
      'email_confirmed_at', u.email_confirmed_at,
      'phone_confirmed_at', u.phone_confirmed_at,
      'providers', coalesce((select jsonb_agg(distinct i.provider) from auth.identities i where i.user_id = p.id), '[]'::jsonb)
    ),
    'preferences', jsonb_build_object(
      'home_city', p.home_city,
      'home_state', p.home_state,
      'discovery_radius_miles', p.discovery_radius_miles,
      'experience_level', p.experience_level,
      'interests', to_jsonb(coalesce(p.interests, array[]::text[])),
      'communication_preferences', coalesce(p.communication_preferences, '{}'::jsonb),
      'pronouns', p.pronouns,
      'age_range', p.age_range,
      'occupation', p.occupation,
      'accessibility_needs', p.accessibility_needs,
      'dietary_needs', p.dietary_needs,
      'profile_is_private', p.profile_is_private,
      'is_searchable', p.is_searchable
    ),
    'community', jsonb_build_object(
      'posts_count', (select count(*) from public.community_posts cp where cp.author_id = p.id),
      'last_post_at', (select max(cp.created_at) from public.community_posts cp where cp.author_id = p.id),
      'comments_count', (select count(*) from public.community_comments cc where cc.author_id = p.id),
      'last_comment_at', (select max(cc.created_at) from public.community_comments cc where cc.author_id = p.id),
      'reactions_count', (select count(*) from public.community_reactions cr where cr.profile_id = p.id),
      'last_reaction_at', (select max(cr.created_at) from public.community_reactions cr where cr.profile_id = p.id),
      'group_count', (select count(*) from public.community_group_members cgm where cgm.profile_id = p.id),
      'groups', coalesce((select jsonb_agg(jsonb_build_object('id', cg.id, 'name', cg.name, 'kind', cg.kind, 'city', cg.city, 'state', cg.state, 'joined_at', cgm.joined_at) order by cgm.joined_at desc) from public.community_group_members cgm join public.community_groups cg on cg.id = cgm.group_id where cgm.profile_id = p.id), '[]'::jsonb),
      'connections_count', (select count(*) from public.member_connections mc where mc.status = 'accepted' and (mc.requester_id = p.id or mc.addressee_id = p.id))
    ),
    'adventures', jsonb_build_object(
      'saved_count', (select count(*) from public.saved_adventures sa where sa.profile_id = p.id),
      'last_saved_at', (select max(sa.created_at) from public.saved_adventures sa where sa.profile_id = p.id),
      'rsvp_count', (select count(*) from public.adventure_rsvps ar where ar.profile_id = p.id),
      'last_rsvp_at', (select max(ar.updated_at) from public.adventure_rsvps ar where ar.profile_id = p.id),
      'paid_order_count', (select count(*) from public.orders o where o.purchaser_id = p.id and o.status = 'paid'),
      'last_paid_at', (select max(o.paid_at) from public.orders o where o.purchaser_id = p.id and o.status = 'paid'),
      'recent_adventures', coalesce((select jsonb_agg(x.obj order by x.sort_at desc) from (select jsonb_build_object('id', a.id, 'title', a.title, 'starts_at', a.starts_at, 'city', a.city, 'state', a.state, 'rsvp_status', ar.status) as obj, a.starts_at as sort_at from public.adventure_rsvps ar join public.adventures a on a.id = ar.adventure_id where ar.profile_id = p.id order by a.starts_at desc limit 5) x), '[]'::jsonb)
    ),
    'recognition', jsonb_build_object(
      'badge_count', (select count(*) from public.member_badges mb where mb.profile_id = p.id),
      'stamp_count', (select count(*) from public.member_passport_stamps ms where ms.profile_id = p.id),
      'badges', coalesce((select jsonb_agg(jsonb_build_object('title', b.title, 'category', b.category, 'earned_at', mb.earned_at) order by mb.earned_at desc) from public.member_badges mb join public.badges b on b.id = mb.badge_id where mb.profile_id = p.id), '[]'::jsonb),
      'stamps', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'category', s.category, 'earned_at', ms.earned_at) order by ms.earned_at desc) from public.member_passport_stamps ms join public.passport_stamps s on s.id = ms.stamp_id where ms.profile_id = p.id), '[]'::jsonb)
    ),
    'support', jsonb_build_object(
      'request_count', (select count(*) from public.support_requests sr where sr.profile_id = p.id),
      'open_request_count', (select count(*) from public.support_requests sr where sr.profile_id = p.id and sr.status not in ('resolved','closed')),
      'last_request_at', (select max(sr.created_at) from public.support_requests sr where sr.profile_id = p.id)
    ),
    'last_activity_at', greatest(
      u.last_sign_in_at,
      (select max(cp.created_at) from public.community_posts cp where cp.author_id = p.id),
      (select max(cc.created_at) from public.community_comments cc where cc.author_id = p.id),
      (select max(cr.created_at) from public.community_reactions cr where cr.profile_id = p.id),
      (select max(sa.created_at) from public.saved_adventures sa where sa.profile_id = p.id),
      (select max(ar.updated_at) from public.adventure_rsvps ar where ar.profile_id = p.id),
      (select max(o.updated_at) from public.orders o where o.purchaser_id = p.id)
    )
  ) into result
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_profile_id;

  return result;
end;
$$;

revoke execute on function public.creator_get_member_insights(uuid) from public;
revoke execute on function public.creator_get_member_insights(uuid) from anon;
grant execute on function public.creator_get_member_insights(uuid) to authenticated;
