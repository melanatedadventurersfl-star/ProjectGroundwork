-- Security hardening for production authorization.
-- The production master_account row is intentionally assigned out-of-band so a
-- privileged account identifier is never committed to this public repository.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

create table if not exists app_private.master_account (
  singleton boolean primary key default true check (singleton),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on app_private.master_account from public, anon, authenticated;

create or replace function app_private.is_master_account()
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select auth.uid() is not null
     and exists (
       select 1 from app_private.master_account m
       where m.singleton = true and m.profile_id = auth.uid()
     );
$$;
revoke all on function app_private.is_master_account() from public, anon;
grant execute on function app_private.is_master_account() to authenticated, service_role;

create or replace function app_private.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  if current_user in ('postgres', 'service_role') or app_private.is_master_account() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.status is distinct from old.status
     or new.platform_role is distinct from old.platform_role
     or new.event_host_level is distinct from old.event_host_level
     or new.created_at is distinct from old.created_at
     or new.onboarding_completed_at is distinct from old.onboarding_completed_at
     or new.sms_consent_at is distinct from old.sms_consent_at then
    raise exception 'Not authorized to modify protected profile fields';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_profile_privileges() from public, anon, authenticated;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
before update on public.profiles
for each row execute function app_private.protect_profile_privileges();

create or replace function public.is_platform_admin(check_profile_id uuid default auth.uid())
returns boolean
language sql
stable
set search_path = public, app_private
as $$
  select app_private.is_master_account()
      or exists (
        select 1 from public.profiles p
        where p.id = check_profile_id
          and p.id = auth.uid()
          and p.platform_role = 'admin'
      );
$$;
revoke all on function public.is_platform_admin(uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

create or replace function public.can_create_local_event()
returns boolean
language sql
stable
set search_path = public, app_private
as $$
  select app_private.is_master_account()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.status = 'active'
          and p.event_host_level in ('trusted_host', 'community_lead', 'staff')
      );
$$;
revoke all on function public.can_create_local_event() from public, anon;
grant execute on function public.can_create_local_event() to authenticated, service_role;

create or replace function public.is_paid_adventure_attendee(target_adventure uuid, target_profile uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select case
    when auth.uid() is null then false
    when target_profile <> auth.uid() and not app_private.is_master_account() then false
    else exists (
      select 1 from public.orders o
      where o.adventure_id = target_adventure
        and o.status = 'paid'::public.order_status
        and (
          o.purchaser_id = target_profile
          or exists (
            select 1 from public.order_attendees oa
            where oa.order_id = o.id and oa.profile_id = target_profile
          )
        )
    )
  end;
$$;
revoke all on function public.is_paid_adventure_attendee(uuid, uuid) from public, anon;
grant execute on function public.is_paid_adventure_attendee(uuid, uuid) to authenticated, service_role;

-- Internal privileged functions are trigger/service-only and cannot be called by clients.
revoke all on function public.attach_local_event_group() from public, anon, authenticated;
revoke all on function public.award_official_event_stamp(uuid) from public, anon, authenticated;
revoke all on function public.create_readiness_deadline_notifications() from public, anon, authenticated;
revoke all on function public.ensure_adventure_group(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.issue_order_credentials(uuid) from public, anon, authenticated;
revoke all on function public.notify_order_status_change() from public, anon, authenticated;
revoke all on function public.on_adventure_completed_stamp() from public, anon, authenticated;
revoke all on function public.on_member_event_stamp_badges() from public, anon, authenticated;
revoke all on function public.refresh_adventure_milestone_badges(uuid) from public, anon, authenticated;
revoke all on function public.sync_paid_order_experience() from public, anon, authenticated;

grant execute on function public.attach_local_event_group() to service_role;
grant execute on function public.award_official_event_stamp(uuid) to service_role;
grant execute on function public.create_readiness_deadline_notifications() to service_role;
grant execute on function public.ensure_adventure_group(uuid) to service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.issue_order_credentials(uuid) to service_role;
grant execute on function public.notify_order_status_change() to service_role;
grant execute on function public.on_adventure_completed_stamp() to service_role;
grant execute on function public.on_member_event_stamp_badges() to service_role;
grant execute on function public.refresh_adventure_milestone_badges(uuid) to service_role;
grant execute on function public.sync_paid_order_experience() to service_role;

revoke all on function public.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) from public, anon;
grant execute on function public.complete_member_onboarding_v2(text,text,text,text,text,integer,text,text[],jsonb,text,boolean,text,text,text,text,text,text) to authenticated, service_role;
revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated, service_role;
revoke all on function public.hold_order(uuid) from public, anon;
grant execute on function public.hold_order(uuid) to authenticated, service_role;
revoke all on function public.recalculate_order(uuid) from public, anon;
grant execute on function public.recalculate_order(uuid) to authenticated, service_role;
revoke all on function public.seed_member_readiness(uuid) from public, anon;
grant execute on function public.seed_member_readiness(uuid) to authenticated, service_role;
revoke all on function public.fan_out_announcement(uuid) from public, anon;
grant execute on function public.fan_out_announcement(uuid) to authenticated, service_role;

-- Only the recipient can accept/decline an incoming connection request.
drop policy if exists "Members respond to connection requests" on public.member_connections;
drop policy if exists "Members respond to incoming connection requests" on public.member_connections;
create policy "Members respond to incoming connection requests"
on public.member_connections for update to authenticated
using (auth.uid() = addressee_id and status = 'pending')
with check (auth.uid() = addressee_id and status in ('accepted','declined'));

-- Group-audience posts require membership in the exact target group.
drop policy if exists "Members create permitted community posts" on public.community_posts;
create policy "Members create permitted community posts"
on public.community_posts for insert to authenticated
with check (
  auth.uid() = author_id
  and (
    audience in ('everyone','connections')
    or (audience = 'circle' and exists (
      select 1 from public.community_circles c
      where c.id = community_posts.circle_id and c.owner_id = auth.uid()
    ))
    or (audience = 'group' and exists (
      select 1 from public.community_group_members gm
      where gm.group_id = community_posts.group_id and gm.profile_id = auth.uid()
    ))
  )
);

-- The singleton master account receives the only full RLS bypass policy.
do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists %I on %I.%I', 'Master account full access', r.schema_name, r.table_name);
    execute format(
      'create policy %I on %I.%I for all to authenticated using (app_private.is_master_account()) with check (app_private.is_master_account())',
      'Master account full access', r.schema_name, r.table_name
    );
  end loop;
end $$;
