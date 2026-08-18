create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  referred_profile_id uuid not null references public.profiles(id) on delete cascade,
  invite_id uuid not null references public.member_invites(id) on delete cascade,
  credit_type text not null default 'successful_referral' check (credit_type = 'successful_referral'),
  created_at timestamptz not null default now(),
  unique (invite_id),
  unique (referred_profile_id)
);

create index if not exists referral_credits_sender_created_idx
  on public.referral_credits(sender_profile_id, created_at desc);

alter table public.referral_credits enable row level security;

revoke all on table public.referral_credits from anon;
revoke all on table public.referral_credits from authenticated;
grant select on table public.referral_credits to authenticated;

drop policy if exists "Members can view their referral credits" on public.referral_credits;
create policy "Members can view their referral credits"
on public.referral_credits
for select
to authenticated
using ((select auth.uid()) = sender_profile_id);

create or replace function public.redeem_member_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite_id uuid;
  v_sender_id uuid;
  v_created_at timestamptz;
  v_onboarding_completed_at timestamptz;
  v_member_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_token), '') is null then
    raise exception 'Invite token is required';
  end if;

  select p.created_at, p.onboarding_completed_at,
         coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'A new member')
    into v_created_at, v_onboarding_completed_at, v_member_name
  from public.profiles p
  where p.id = v_user_id;

  if v_created_at is null then
    raise exception 'Profile not found';
  end if;

  if v_created_at < now() - interval '7 days' or v_onboarding_completed_at is not null then
    raise exception 'Invites can only be redeemed by newly joined members';
  end if;

  if exists (
    select 1 from public.member_invites
    where redeemed_by_profile_id = v_user_id
  ) then
    raise exception 'An invite has already been redeemed for this profile';
  end if;

  select id, sender_profile_id
    into v_invite_id, v_sender_id
  from public.member_invites
  where token = lower(trim(p_token))
    and status = 'available'
  for update skip locked;

  if v_invite_id is null then
    raise exception 'Invite is invalid or no longer available';
  end if;

  if v_sender_id = v_user_id then
    raise exception 'You cannot redeem your own invite';
  end if;

  update public.member_invites
  set status = 'redeemed',
      redeemed_by_profile_id = v_user_id,
      redeemed_at = now()
  where id = v_invite_id
    and status = 'available';

  if not found then
    raise exception 'Invite is no longer available';
  end if;

  insert into public.referral_credits(sender_profile_id, referred_profile_id, invite_id)
  values (v_sender_id, v_user_id, v_invite_id)
  on conflict do nothing;

  insert into public.notifications(
    recipient_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  ) values (
    v_sender_id,
    'community'::public.notification_kind,
    'normal'::public.notification_priority,
    'Your invite was accepted',
    v_member_name || ' joined Melanated Adventurers through your invite. You earned 1 referral credit.',
    '/member/invites',
    'member-invite-redeemed:' || v_invite_id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return v_sender_id;
end;
$$;

revoke all on function public.redeem_member_invite(text) from public, anon;
grant execute on function public.redeem_member_invite(text) to authenticated;
