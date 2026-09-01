-- Platform-level new member review queue. This is intentionally separate from
-- Host Center, which only owns activity tied to a host's events or groups.

create table public.member_signup_reviews (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint member_signup_review_pair check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  )
);

alter table public.member_signup_reviews enable row level security;
revoke all on table public.member_signup_reviews from public, anon, authenticated;

create index member_signup_reviews_unreviewed_idx
  on public.member_signup_reviews (created_at desc)
  where reviewed_at is null;

create or replace function public.queue_new_member_for_admin_review()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  insert into public.member_signup_reviews (profile_id, created_at)
  values (new.id, new.created_at)
  on conflict (profile_id) do nothing;

  insert into public.notifications (
    recipient_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    admin_profile.id,
    'system'::public.notification_kind,
    'normal'::public.notification_priority,
    coalesce(nullif(trim(new.display_name), ''), 'A new member') || ' joined Go Melanated',
    case
      when new.home_city is not null and new.home_state is not null
        then new.home_city || ', ' || new.home_state || ' · Review member details'
      else 'Review member details and onboarding status'
    end,
    '/admin/new-members/' || new.id::text,
    'member-joined:' || new.id::text || ':' || admin_profile.id::text
  from (
    select p.id
    from public.profiles p
    where p.platform_role in ('admin', 'founder')
      and p.status = 'active'
    union
    select m.profile_id
    from app_private.master_account m
    where m.singleton = true
  ) admin_profile
  where admin_profile.id <> new.id
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_new_member_for_admin_review() from public, anon, authenticated;
grant execute on function public.queue_new_member_for_admin_review() to service_role;

drop trigger if exists queue_new_member_for_admin_review on public.profiles;
create trigger queue_new_member_for_admin_review
after insert on public.profiles
for each row execute function public.queue_new_member_for_admin_review();

-- Capture only recent signups at launch so the first queue includes members who
-- joined shortly before deployment without treating the full member base as new.
insert into public.member_signup_reviews (profile_id, created_at)
select p.id, p.created_at
from public.profiles p
where p.created_at >= now() - interval '7 days'
on conflict (profile_id) do nothing;

create or replace function public.admin_list_new_members()
returns table (
  profile_id uuid,
  display_name text,
  username text,
  avatar_url text,
  home_city text,
  home_state text,
  joined_at timestamptz,
  status public.member_status,
  platform_role text,
  onboarding_completed_at timestamptz,
  membership_name text,
  membership_status text,
  referral_source text,
  referral_profile_id uuid,
  reviewed_at timestamptz,
  reviewed_by uuid
)
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.home_city,
    p.home_state,
    p.created_at,
    p.status,
    p.platform_role,
    p.onboarding_completed_at,
    coalesce(mp.name, 'Standard'),
    coalesce(ms.status, 'standard'),
    referrer.display_name,
    invite.sender_profile_id,
    review.reviewed_at,
    review.reviewed_by
  from public.member_signup_reviews review
  join public.profiles p on p.id = review.profile_id
  left join lateral (
    select m.plan_code, m.status
    from public.memberships m
    where m.profile_id = p.id
      and m.status in ('trialing', 'active', 'past_due', 'complimentary')
    order by m.created_at desc
    limit 1
  ) ms on true
  left join public.membership_plans mp on mp.code = ms.plan_code
  left join lateral (
    select mi.sender_profile_id
    from public.member_invites mi
    where mi.redeemed_by_profile_id = p.id
    order by mi.redeemed_at desc
    limit 1
  ) invite on true
  left join public.profiles referrer on referrer.id = invite.sender_profile_id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_new_members() from public, anon;
grant execute on function public.admin_list_new_members() to authenticated, service_role;

create or replace function public.admin_review_new_member(p_profile_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_reviewed_at timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.member_signup_reviews
  set reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = coalesce(reviewed_by, auth.uid())
  where profile_id = p_profile_id
  returning reviewed_at into v_reviewed_at;

  if v_reviewed_at is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  return v_reviewed_at;
end;
$$;

revoke all on function public.admin_review_new_member(uuid) from public, anon;
grant execute on function public.admin_review_new_member(uuid) to authenticated, service_role;
