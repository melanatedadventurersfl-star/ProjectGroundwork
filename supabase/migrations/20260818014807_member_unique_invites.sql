create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  status text not null default 'available' check (status in ('available','redeemed','revoked')),
  redeemed_by_profile_id uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint member_invites_redemption_consistency check (
    (status = 'redeemed' and redeemed_by_profile_id is not null and redeemed_at is not null)
    or (status <> 'redeemed' and redeemed_by_profile_id is null and redeemed_at is null)
  )
);

create index if not exists member_invites_sender_idx
  on public.member_invites(sender_profile_id, status);

alter table public.member_invites enable row level security;

revoke all on table public.member_invites from anon, authenticated;
grant select on table public.member_invites to authenticated;

create policy "members can view their own invites"
on public.member_invites
for select
to authenticated
using ((select auth.uid()) = sender_profile_id);

create or replace function public.ensure_member_invites(
  p_profile_id uuid,
  p_target_count integer default 3
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing integer;
  v_needed integer;
begin
  if p_target_count < 0 or p_target_count > 20 then
    raise exception 'Invite target out of range';
  end if;

  if auth.uid() is not null and auth.uid() <> p_profile_id then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Profile not found';
  end if;

  select count(*) into v_existing
  from public.member_invites
  where sender_profile_id = p_profile_id;

  v_needed := greatest(p_target_count - v_existing, 0);

  if v_needed > 0 then
    insert into public.member_invites(sender_profile_id)
    select p_profile_id from generate_series(1, v_needed);
  end if;

  return v_needed;
end;
$$;

revoke all on function public.ensure_member_invites(uuid, integer) from public, anon;
grant execute on function public.ensure_member_invites(uuid, integer) to authenticated;

create or replace function public.seed_new_member_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_member_invites(new.id, 3);
  return new;
end;
$$;

revoke all on function public.seed_new_member_invites() from public, anon, authenticated;

drop trigger if exists seed_member_invites_after_profile_insert on public.profiles;
create trigger seed_member_invites_after_profile_insert
after insert on public.profiles
for each row execute function public.seed_new_member_invites();

insert into public.member_invites(sender_profile_id)
select p.id
from public.profiles p
cross join generate_series(1,3)
where not exists (
  select 1 from public.member_invites mi where mi.sender_profile_id = p.id
);
