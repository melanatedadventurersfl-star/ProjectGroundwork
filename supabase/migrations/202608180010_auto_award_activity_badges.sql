create or replace function public.refresh_activity_badges(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_badges (profile_id, badge_id, evidence)
  select distinct
    target_profile,
    b.id,
    jsonb_build_object(
      'source', 'qualifying_adventure',
      'badge_code', b.code
    )
  from public.badges b
  where
    (b.code = 'camp-crew' and exists (
      select 1
      from public.member_passport_stamps mps
      join public.adventures a on a.id = mps.adventure_id
      where mps.profile_id = target_profile
        and lower(coalesce(a.category,'') || ' ' || coalesce(a.title,'') || ' ' || coalesce(a.summary,'')) ~ '(camp|camping|campground)'
    ))
    or
    (b.code = 'water-wayfinder' and exists (
      select 1
      from public.member_passport_stamps mps
      join public.adventures a on a.id = mps.adventure_id
      where mps.profile_id = target_profile
        and lower(coalesce(a.category,'') || ' ' || coalesce(a.title,'') || ' ' || coalesce(a.summary,'')) ~ '(kayak|canoe|paddle|rafting|river|lake|water|swim|snorkel|surf)'
    ))
  on conflict (profile_id, badge_id) do nothing;
end;
$$;

create or replace function public.on_member_event_stamp_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_adventure_milestone_badges(new.profile_id);
  perform public.refresh_activity_badges(new.profile_id);
  return new;
end;
$$;
