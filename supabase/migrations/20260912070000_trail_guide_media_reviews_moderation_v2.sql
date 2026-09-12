alter table public.trail_guide_hero_candidates
  add column if not exists category text,
  add column if not exists representativeness_score numeric(5,4) not null default 0.5 check (representativeness_score between 0 and 1),
  add column if not exists hero_eligible boolean not null default true,
  add column if not exists gallery_eligible boolean not null default true;

alter table public.trail_guide_photos
  add column if not exists submission_id text;

update public.trail_guide_photos
set submission_id = id::text
where submission_id is null;

alter table public.trail_guide_photos
  alter column submission_id set default gen_random_uuid()::text,
  alter column submission_id set not null;

alter table public.trail_guide_photos
  drop constraint if exists trail_guide_photos_category_check;

alter table public.trail_guide_photos
  add constraint trail_guide_photos_category_check
  check (category in ('campsite','bathroom','beach','trail','rv_site','tent_site','facilities','activities','landscape','wildlife','other'));

create index if not exists trail_guide_photos_submission_idx
  on public.trail_guide_photos (submission_id, moderation_status, created_at desc);

create index if not exists trail_guide_hero_candidates_gallery_idx
  on public.trail_guide_hero_candidates (place_id, status, gallery_eligible, hero_eligible, is_preferred desc, hero_score desc);

update public.trail_guide_hero_candidates
set category = 'wildlife',
    representativeness_score = 0.28,
    hero_eligible = false,
    gallery_eligible = true,
    hero_score = least(hero_score, 0.58),
    classification_note = 'Exact Huguenot wildlife image. Kept in the gallery but excluded from automatic cover selection.',
    updated_at = now()
where place_id = 'huguenot-memorial-park'
  and image_url = 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Shorebirds_at_Huguenot_Park.jpg';

create or replace function public.refresh_trail_guide_hero_selection(target_place_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_id uuid;
  selected_score numeric;
  selected_preferred boolean;
begin
  select id, hero_score, is_preferred
  into selected_id, selected_score, selected_preferred
  from public.trail_guide_hero_candidates
  where place_id = target_place_id
    and status = 'approved'
    and hero_eligible = true
  order by is_preferred desc, is_generic asc, hero_score desc, representativeness_score desc, updated_at desc
  limit 1;

  update public.trail_guide_place_profiles
  set hero_candidate_id = selected_id,
      hero_confidence = coalesce(selected_score, 0),
      hero_selection_mode = case when coalesce(selected_preferred, false) then 'manual' else 'automatic' end,
      hero_selection_reason = case
        when selected_id is null then 'No approved hero-eligible destination image is available.'
        when selected_preferred then 'Admin-selected preferred cover.'
        else 'Highest-scoring approved hero-eligible destination image.'
      end,
      hero_last_reviewed_at = now(),
      updated_at = now()
  where place_id = target_place_id;

  return selected_id;
end;
$$;

revoke all on function public.refresh_trail_guide_hero_selection(text) from public, anon, authenticated;
grant execute on function public.refresh_trail_guide_hero_selection(text) to service_role;

create or replace function public.sync_trail_guide_photo_hero_candidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  suitability numeric := 0.60;
  representativeness numeric := 0.60;
  freshness numeric := 0.85;
  computed_score numeric;
  can_be_hero boolean := true;
begin
  suitability := case new.category
    when 'beach' then 0.94
    when 'landscape' then 0.92
    when 'campsite' then 0.93
    when 'rv_site' then 0.90
    when 'tent_site' then 0.91
    when 'trail' then 0.86
    when 'activities' then 0.72
    when 'wildlife' then 0.54
    when 'facilities' then 0.46
    when 'bathroom' then 0.22
    else 0.52
  end;

  representativeness := case new.category
    when 'campsite' then 0.96
    when 'beach' then 0.94
    when 'landscape' then 0.92
    when 'rv_site' then 0.91
    when 'tent_site' then 0.91
    when 'trail' then 0.84
    when 'activities' then 0.68
    when 'wildlife' then 0.42
    when 'facilities' then 0.38
    when 'bathroom' then 0.18
    else 0.48
  end;

  can_be_hero := new.category not in ('bathroom','facilities','wildlife');

  freshness := case
    when new.visit_date is null then 0.78
    when new.visit_date >= current_date - interval '18 months' then 1.00
    when new.visit_date >= current_date - interval '36 months' then 0.82
    else 0.62
  end;

  computed_score := least(1, greatest(0,
    (0.32 * suitability) +
    (0.28 * representativeness) +
    (0.18 * 0.76) +
    (0.14 * 0.68) +
    (0.08 * freshness)
  ));

  if new.moderation_status = 'approved' and new.feature_eligible = true then
    insert into public.trail_guide_hero_candidates (
      place_id, source_type, source_name, storage_path, photo_id, credit, tags, category,
      destination_match_score, representativeness_score, source_trust_score, quality_score, recency_score,
      hero_score, status, is_preferred, is_generic, hero_eligible, gallery_eligible,
      classification_note, classified_at, last_scored_at, updated_at
    ) values (
      new.place_id, 'camper', 'Go Melanated camper', new.storage_path, new.id, null,
      array[new.category], new.category,
      suitability, representativeness, 0.76, 0.68, freshness,
      computed_score, 'approved', false, false, can_be_hero, true,
      'Auto-classified from the member-selected Trail Guide photo category.',
      now(), now(), now()
    )
    on conflict (photo_id) do update set
      place_id = excluded.place_id,
      storage_path = excluded.storage_path,
      tags = excluded.tags,
      category = excluded.category,
      destination_match_score = excluded.destination_match_score,
      representativeness_score = excluded.representativeness_score,
      source_trust_score = excluded.source_trust_score,
      quality_score = excluded.quality_score,
      recency_score = excluded.recency_score,
      hero_score = excluded.hero_score,
      status = 'approved',
      is_generic = false,
      hero_eligible = excluded.hero_eligible,
      gallery_eligible = true,
      classification_note = excluded.classification_note,
      classified_at = now(),
      last_scored_at = now(),
      updated_at = now();
  else
    update public.trail_guide_hero_candidates
    set status = 'rejected', is_preferred = false, updated_at = now()
    where photo_id = new.id;
  end if;

  perform public.refresh_trail_guide_hero_selection(new.place_id);
  return new;
end;
$$;

revoke all on function public.sync_trail_guide_photo_hero_candidate() from public, anon, authenticated;

create or replace function public.notify_admins_of_trail_guide_photo_submission()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_place_name text;
  v_member_name text;
  v_count integer;
begin
  select coalesce(display_name, new.place_id)
  into v_place_name
  from public.trail_guide_place_profiles
  where place_id = new.place_id;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'A member')
  into v_member_name
  from public.profiles
  where id = new.profile_id;

  select count(*) into v_count
  from public.trail_guide_photos
  where submission_id = new.submission_id;

  insert into public.notifications (
    recipient_id, kind, priority, title, body, action_url, dedupe_key
  )
  select
    admin_profile.id,
    'community'::public.notification_kind,
    'high'::public.notification_priority,
    case when v_count = 1 then 'New Trail Guide Photo Awaiting Review'
         else v_count::text || ' New Trail Guide Photos Awaiting Review' end,
    coalesce(v_place_name, new.place_id) || case when new.campsite_label is not null then ' · Campsite ' || new.campsite_label else '' end || ' · Submitted by ' || coalesce(v_member_name, 'A member'),
    '/admin/trail-guide-moderation?submissionId=' || new.submission_id,
    'trail-guide-photo-submission-admin:' || new.submission_id || ':' || admin_profile.id::text
  from (
    select p.id
    from public.profiles p
    where p.platform_role = 'admin'
      and p.status = 'active'
    union
    select m.profile_id as id
    from app_private.master_account m
    where m.singleton = true
  ) admin_profile
  on conflict (recipient_id, dedupe_key) do update set
    title = excluded.title,
    body = excluded.body,
    action_url = excluded.action_url,
    priority = excluded.priority,
    read_at = null,
    created_at = now();

  return new;
end;
$$;

revoke all on function public.notify_admins_of_trail_guide_photo_submission() from public, anon, authenticated;
grant execute on function public.notify_admins_of_trail_guide_photo_submission() to service_role;

drop trigger if exists trail_guide_photo_admin_notification on public.trail_guide_photos;
create trigger trail_guide_photo_admin_notification
after insert on public.trail_guide_photos
for each row execute function public.notify_admins_of_trail_guide_photo_submission();

create or replace function public.notify_member_of_trail_guide_photo_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_place_name text;
begin
  if old.moderation_status is not distinct from new.moderation_status
     or new.moderation_status not in ('approved','rejected') then
    return new;
  end if;

  select coalesce(display_name, new.place_id)
  into v_place_name
  from public.trail_guide_place_profiles
  where place_id = new.place_id;

  insert into public.notifications (
    recipient_id, kind, priority, title, body, action_url, dedupe_key
  ) values (
    new.profile_id,
    'community'::public.notification_kind,
    'normal'::public.notification_priority,
    case when new.moderation_status = 'approved'
      then 'Your ' || coalesce(v_place_name, 'Trail Guide') || ' Photo Was Approved'
      else 'Your ' || coalesce(v_place_name, 'Trail Guide') || ' Photo Wasn''t Approved' end,
    case when new.moderation_status = 'approved'
      then 'Your photo is now visible to other campers.'
      else 'Reason: ' || coalesce(nullif(trim(new.moderation_reason), ''), 'The photo did not meet Trail Guide moderation requirements.') end,
    '/trail-guide/' || new.place_id || '?focus=photos',
    'trail-guide-photo-moderation:' || new.id::text || ':' || new.moderation_status
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  if not exists (
    select 1 from public.trail_guide_photos p
    where p.submission_id = new.submission_id
      and p.moderation_status = 'pending'
  ) then
    update public.notifications
    set read_at = coalesce(read_at, now())
    where dedupe_key like 'trail-guide-photo-submission-admin:' || new.submission_id || ':%';
  end if;

  return new;
end;
$$;

revoke all on function public.notify_member_of_trail_guide_photo_moderation() from public, anon, authenticated;
grant execute on function public.notify_member_of_trail_guide_photo_moderation() to service_role;

drop trigger if exists trail_guide_photo_member_moderation_notification on public.trail_guide_photos;
create trigger trail_guide_photo_member_moderation_notification
after update of moderation_status on public.trail_guide_photos
for each row execute function public.notify_member_of_trail_guide_photo_moderation();

insert into public.notifications (
  recipient_id, kind, priority, title, body, action_url, dedupe_key
)
select
  admin_profile.id,
  'community'::public.notification_kind,
  'high'::public.notification_priority,
  'New Trail Guide Photo Awaiting Review',
  coalesce(pp.display_name, p.place_id) || case when p.campsite_label is not null then ' · Campsite ' || p.campsite_label else '' end || ' · Submitted by ' || coalesce(nullif(trim(member.display_name), ''), nullif(trim(member.username), ''), 'A member'),
  '/admin/trail-guide-moderation?submissionId=' || p.submission_id,
  'trail-guide-photo-submission-admin:' || p.submission_id || ':' || admin_profile.id::text
from public.trail_guide_photos p
left join public.trail_guide_place_profiles pp on pp.place_id = p.place_id
left join public.profiles member on member.id = p.profile_id
cross join lateral (
  select a.id
  from (
    select pr.id from public.profiles pr where pr.platform_role = 'admin' and pr.status = 'active'
    union
    select m.profile_id from app_private.master_account m where m.singleton = true
  ) a
) admin_profile
where p.moderation_status = 'pending'
on conflict (recipient_id, dedupe_key) do nothing;

select public.refresh_trail_guide_hero_selection(place_id)
from public.trail_guide_place_profiles;
