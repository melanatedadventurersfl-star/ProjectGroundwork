create or replace function public.get_adventure_event_people(target_adventure_id uuid)
returns table(
  profile_id uuid,
  display_name text,
  username text,
  avatar_url text,
  is_connected boolean
)
language sql
security definer
set search_path = public, auth
as $$
  with caller as (
    select auth.uid() as id
  ),
  can_view as (
    select (
      app_private.is_master_account()
      or exists (
        select 1
        from member_passport_stamps mps, caller c
        where mps.profile_id = c.id
          and mps.adventure_id = target_adventure_id
      )
      or exists (
        select 1
        from orders o, caller c
        where o.purchaser_id = c.id
          and o.adventure_id = target_adventure_id
          and o.status = 'paid'::order_status
      )
      or exists (
        select 1
        from order_attendees oa
        join orders o on o.id = oa.order_id
        join caller c on c.id = oa.profile_id
        where o.adventure_id = target_adventure_id
          and o.status = 'paid'::order_status
      )
    ) as ok
  ),
  attendee_ids as (
    select o.purchaser_id as profile_id
    from orders o
    where o.adventure_id = target_adventure_id
      and o.status = 'paid'::order_status

    union

    select oa.profile_id
    from order_attendees oa
    join orders o on o.id = oa.order_id
    where o.adventure_id = target_adventure_id
      and o.status = 'paid'::order_status
      and oa.profile_id is not null

    union

    select mps.profile_id
    from member_passport_stamps mps
    where mps.adventure_id = target_adventure_id
  ),
  visible_attendees as (
    select distinct
      pd.id as profile_id,
      pd.display_name,
      pd.username,
      pd.avatar_url,
      exists (
        select 1
        from member_connections mc, caller c
        where mc.status = 'accepted'
          and (
            (mc.requester_id = c.id and mc.addressee_id = pd.id)
            or (mc.addressee_id = c.id and mc.requester_id = pd.id)
          )
      ) as is_connected
    from attendee_ids ai
    join profile_directory pd on pd.id = ai.profile_id
    cross join can_view cv
    cross join caller c
    where cv.ok
      and pd.id <> c.id
      and pd.status = 'active'::member_status
      and (
        pd.is_searchable
        or exists (
          select 1
          from member_connections mc
          where mc.status = 'accepted'
            and (
              (mc.requester_id = c.id and mc.addressee_id = pd.id)
              or (mc.addressee_id = c.id and mc.requester_id = pd.id)
            )
        )
      )
  )
  select *
  from visible_attendees
  order by is_connected desc, display_name nulls last, username nulls last;
$$;

revoke all on function public.get_adventure_event_people(uuid) from public;
grant execute on function public.get_adventure_event_people(uuid) to authenticated;
