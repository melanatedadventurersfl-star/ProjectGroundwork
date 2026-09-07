-- Admin review surfaces should identify members by the name collected during onboarding,
-- not by the email-derived display name/username created at signup.

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
    coalesce(
      nullif(trim(concat_ws(' ', nullif(trim(p.first_name), ''), nullif(trim(p.last_name), ''))), ''),
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'New member'
    ) as display_name,
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
    coalesce(
      nullif(trim(concat_ws(' ', nullif(trim(referrer.first_name), ''), nullif(trim(referrer.last_name), ''))), ''),
      nullif(trim(referrer.display_name), ''),
      nullif(trim(referrer.username), '')
    ) as referral_source,
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

notify pgrst, 'reload schema';
