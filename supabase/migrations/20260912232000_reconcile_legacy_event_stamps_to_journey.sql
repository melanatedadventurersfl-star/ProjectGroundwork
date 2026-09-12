with candidate_matches as (
  select
    mps.id as member_stamp_id,
    a.id as adventure_id,
    count(*) over (partition by mps.id) as match_count
  from public.member_passport_stamps mps
  join public.passport_stamps ps on ps.id = mps.stamp_id
  join public.adventures a
    on a.status = 'completed'
   and (
      ps.code = ('official-event-' || a.id::text)
      or (
        ps.code like 'legacy-event-%'
        and regexp_replace(lower(ps.title), '[^a-z0-9]+', '', 'g') = regexp_replace(lower(a.title), '[^a-z0-9]+', '', 'g')
      )
   )
  where mps.adventure_id is null
), unique_matches as (
  select member_stamp_id, adventure_id
  from candidate_matches
  where match_count = 1
)
update public.member_passport_stamps mps
set adventure_id = u.adventure_id
from unique_matches u
where mps.id = u.member_stamp_id;
