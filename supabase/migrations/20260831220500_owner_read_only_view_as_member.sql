create table if not exists app_private.owner_view_as_users (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table if not exists app_private.owner_view_as_audit (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

insert into app_private.owner_view_as_users (profile_id)
select profile_id from app_private.master_account
on conflict (profile_id) do nothing;

insert into app_private.owner_view_as_users (profile_id)
select id from public.profiles
where lower(email) = lower('ms.evans1521@gmail.com')
on conflict (profile_id) do nothing;

create or replace function public.can_view_as_member()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from app_private.owner_view_as_users o
      where o.profile_id = auth.uid()
    );
$$;

revoke all on function public.can_view_as_member() from public, anon;
grant execute on function public.can_view_as_member() to authenticated;

create or replace function public.owner_search_view_as_members(
  p_query text default '',
  p_limit integer default 30
)
returns table (
  profile_id uuid,
  display_name text,
  username text,
  avatar_url text,
  home_city text,
  home_state text
)
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
begin
  if not public.can_view_as_member() then
    raise exception 'Owner view-as access required';
  end if;

  return query
  select p.id, p.display_name, p.username, p.avatar_url, p.home_city, p.home_state
  from public.profiles p
  where p.id <> auth.uid()
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or lower(coalesce(p.display_name, '')) like '%' || lower(btrim(p_query)) || '%'
      or lower(coalesce(p.username, '')) like '%' || lower(btrim(p_query)) || '%'
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.owner_search_view_as_members(text, integer) from public, anon;
grant execute on function public.owner_search_view_as_members(text, integer) to authenticated;

create or replace function public.owner_get_member_preview(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  result jsonb;
begin
  if not public.can_view_as_member() then
    raise exception 'Owner view-as access required';
  end if;

  if p_profile_id is null or not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Member not found';
  end if;

  insert into app_private.owner_view_as_audit (viewer_profile_id, target_profile_id)
  values (auth.uid(), p_profile_id);

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'cover_url', p.cover_url,
      'home_city', p.home_city,
      'home_state', p.home_state,
      'discovery_radius_miles', p.discovery_radius_miles,
      'experience_level', p.experience_level,
      'interests', to_jsonb(coalesce(p.interests, array[]::text[]))
    ),
    'trail', jsonb_build_object(
      'adventure_count', (select count(*) from public.member_journey mj where mj.profile_id = p.id),
      'unique_places', (select count(distinct concat_ws('|', coalesce(mj.city, ''), coalesce(mj.state, ''))) from public.member_journey mj where mj.profile_id = p.id),
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'adventure_id', x.adventure_id,
          'title', x.title,
          'city', x.city,
          'state', x.state,
          'starts_at', x.starts_at,
          'experienced_at', x.experienced_at
        ) order by x.starts_at desc)
        from (
          select mj.adventure_id, mj.title, mj.city, mj.state, mj.starts_at, mj.experienced_at
          from public.member_journey mj
          where mj.profile_id = p.id
          order by mj.starts_at desc
          limit 5
        ) x
      ), '[]'::jsonb)
    ),
    'recognition', jsonb_build_object(
      'badge_count', (select count(*) from public.member_badges mb where mb.profile_id = p.id),
      'stamp_count', (select count(*) from public.member_passport_stamps ms where ms.profile_id = p.id),
      'badges', coalesce((
        select jsonb_agg(jsonb_build_object('title', x.title, 'category', x.category, 'earned_at', x.earned_at) order by x.earned_at desc)
        from (
          select b.title, b.category, mb.earned_at
          from public.member_badges mb
          join public.badges b on b.id = mb.badge_id
          where mb.profile_id = p.id
          order by mb.earned_at desc
          limit 6
        ) x
      ), '[]'::jsonb)
    ),
    'community', jsonb_build_object(
      'group_count', (select count(*) from public.community_group_members gm where gm.profile_id = p.id),
      'connection_count', (
        select count(*)
        from public.member_connections mc
        where mc.status = 'accepted'
          and (mc.requester_id = p.id or mc.addressee_id = p.id)
      )
    ),
    'local_context', jsonb_build_object(
      'upcoming', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'title', x.title,
          'city', x.city,
          'state', x.state,
          'starts_at', x.starts_at,
          'category', x.category
        ) order by x.starts_at)
        from (
          select a.id, a.title, a.city, a.state, a.starts_at, a.category
          from public.adventures a
          where a.ends_at >= now()
            and a.status in ('scheduled', 'published', 'sold_out')
            and p.home_state is not null
            and a.state = p.home_state
          order by case when p.home_city is not null and a.city = p.home_city then 0 else 1 end, a.starts_at
          limit 5
        ) x
      ), '[]'::jsonb)
    )
  ) into result
  from public.profiles p
  where p.id = p_profile_id;

  return result;
end;
$$;

revoke all on function public.owner_get_member_preview(uuid) from public, anon;
grant execute on function public.owner_get_member_preview(uuid) to authenticated;
