create unique index if not exists member_invites_one_redemption_per_profile
  on public.member_invites(redeemed_by_profile_id)
  where redeemed_by_profile_id is not null;

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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_token), '') is null then
    raise exception 'Invite token is required';
  end if;

  if exists (
    select 1 from public.member_invites
    where redeemed_by_profile_id = v_user_id
  ) then
    raise exception 'This member has already redeemed an invite';
  end if;

  select id, sender_profile_id
    into v_invite_id, v_sender_id
  from public.member_invites
  where token = trim(p_token)
    and status = 'available'
  for update;

  if v_invite_id is null then
    raise exception 'Invite is invalid or has already been used';
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
    raise exception 'Invite is invalid or has already been used';
  end if;

  return v_sender_id;
end;
$$;

revoke all on function public.redeem_member_invite(text) from public, anon;
grant execute on function public.redeem_member_invite(text) to authenticated;
