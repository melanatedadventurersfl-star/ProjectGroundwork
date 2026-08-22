-- Ensure stamp-earned adventures appear in the member journey, including seeded/test stamps
-- that do not have a matching paid order. This keeps Add Memory populated when launched
-- from a collected stamp.

create or replace view public.member_journey as
with order_experiences as (
  select
    o.purchaser_id as profile_id,
    o.adventure_id,
    coalesce(max(aci.checked_in_at), o.paid_at) as experienced_at
  from public.orders o
  join public.adventures a on a.id = o.adventure_id
  left join public.order_attendees oa on oa.order_id = o.id
  left join public.adventure_check_ins aci on aci.attendee_id = oa.id and aci.adventure_id = a.id
  where o.status = 'paid'::public.order_status
    and (a.ends_at < now() or aci.checked_in_at is not null)
  group by o.id, o.purchaser_id, o.adventure_id, o.paid_at
),
stamp_experiences as (
  select
    mps.profile_id,
    mps.adventure_id,
    max(mps.earned_at) as experienced_at
  from public.member_passport_stamps mps
  where mps.adventure_id is not null
  group by mps.profile_id, mps.adventure_id
),
experience_rollup as (
  select profile_id, adventure_id, max(experienced_at) as experienced_at
  from (
    select * from order_experiences
    union all
    select * from stamp_experiences
  ) combined
  group by profile_id, adventure_id
)
select
  e.profile_id,
  a.id as adventure_id,
  a.title,
  a.category,
  a.city,
  a.state,
  a.starts_at,
  a.ends_at,
  e.experienced_at,
  r.rating,
  r.highlight,
  r.reflection,
  r.visibility,
  count(distinct mps.stamp_id)::integer as stamp_count
from experience_rollup e
join public.adventures a on a.id = e.adventure_id
left join public.adventure_reflections r
  on r.profile_id = e.profile_id and r.adventure_id = a.id
left join public.member_passport_stamps mps
  on mps.profile_id = e.profile_id and mps.adventure_id = a.id
group by
  e.profile_id,
  a.id,
  e.experienced_at,
  r.rating,
  r.highlight,
  r.reflection,
  r.visibility;
