-- Keep the Founder role aligned to the private master account so the
-- Founder Overwatch option cannot appear for another account.

create or replace function app_private.enforce_overwatch_founder_identity()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  if new.platform_role = 'founder'
     and not exists (
       select 1
       from app_private.master_account m
       where m.singleton = true
         and m.profile_id = new.id
     ) then
    raise exception 'Founder role is reserved for the master account';
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_overwatch_founder_identity() from public, anon, authenticated;

drop trigger if exists profiles_enforce_overwatch_founder_identity on public.profiles;
create trigger profiles_enforce_overwatch_founder_identity
before insert or update of platform_role on public.profiles
for each row execute function app_private.enforce_overwatch_founder_identity();

create or replace function app_private.sync_overwatch_founder_identity()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  update public.profiles
  set platform_role = 'admin', updated_at = now()
  where platform_role = 'founder'
    and id <> new.profile_id;

  update public.profiles
  set platform_role = 'founder', updated_at = now()
  where id = new.profile_id
    and platform_role is distinct from 'founder';

  return new;
end;
$$;

revoke all on function app_private.sync_overwatch_founder_identity() from public, anon, authenticated;

drop trigger if exists master_account_sync_overwatch_founder_identity on app_private.master_account;
create trigger master_account_sync_overwatch_founder_identity
after insert or update of profile_id on app_private.master_account
for each row execute function app_private.sync_overwatch_founder_identity();

update public.profiles p
set platform_role = 'admin', updated_at = now()
where p.platform_role = 'founder'
  and not exists (
    select 1 from app_private.master_account m
    where m.singleton = true and m.profile_id = p.id
  );

update public.profiles p
set platform_role = 'founder', updated_at = now()
from app_private.master_account m
where m.singleton = true
  and p.id = m.profile_id
  and p.platform_role is distinct from 'founder';
