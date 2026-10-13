-- GO Workout Your Circle V2. No access to workout_user_state or unshared goal data.
create table public.workout_circle_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requests_enabled boolean not null default true,
  encouragement_enabled boolean not null default true,
  milestones_enabled boolean not null default true,
  accountability_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.workout_circle_preferences enable row level security;
create policy workout_circle_preferences_owner on public.workout_circle_preferences
  for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,insert,update on public.workout_circle_preferences to authenticated;

create table public.workout_circle_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in
    ('connection_request','connection_accepted','encouragement','milestone',
     'accountability_request','accountability_accepted','accountability_checkin')),
  reference_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint workout_circle_not_self check (recipient_id<>actor_id)
);
create index workout_circle_notifications_recipient_idx
  on public.workout_circle_notifications(recipient_id,created_at desc);
alter table public.workout_circle_notifications enable row level security;
create policy workout_circle_notifications_owner on public.workout_circle_notifications
  for select to authenticated using(recipient_id=(select auth.uid()));
grant select on public.workout_circle_notifications to authenticated;

create table public.workout_accountability_agreements (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  user_low uuid generated always as (least(requester_id,partner_id)) stored,
  user_high uuid generated always as (greatest(requester_id,partner_id)) stored,
  goal_id text,
  frequency text not null default 'weekly' check (frequency in ('weekly','biweekly')),
  support_style text not null default 'encouragement' check (support_style in ('encouragement','checkin','workout')),
  status text not null default 'pending' check (status in ('pending','active','paused')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint workout_accountability_not_self check(requester_id<>partner_id),
  constraint workout_accountability_once unique(user_low,user_high)
);
create index workout_accountability_by_partner on public.workout_accountability_agreements(partner_id,status);
alter table public.workout_accountability_agreements enable row level security;
create policy workout_accountability_read on public.workout_accountability_agreements
 for select to authenticated
 using((requester_id=(select auth.uid()) or partner_id=(select auth.uid()))
   and not exists (select 1 from public.workout_connection_blocks b
     where (b.blocker_id=requester_id and b.blocked_id=partner_id)
        or (b.blocker_id=partner_id and b.blocked_id=requester_id)));
grant select on public.workout_accountability_agreements to authenticated;

create table public.workout_accountability_checkins (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.workout_accountability_agreements(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  signal text not null check(signal in ('on_track','need_support','recovery','celebrate')),
  note text not null default '' check (char_length(note)<=240),
  created_at timestamptz not null default now()
);
create index workout_accountability_checkins_recent on public.workout_accountability_checkins(agreement_id,created_at desc);
alter table public.workout_accountability_checkins enable row level security;
create policy workout_accountability_checkins_read on public.workout_accountability_checkins
  for select to authenticated
  using(exists(select 1 from public.workout_accountability_agreements a
   where a.id=agreement_id and (a.requester_id=(select auth.uid()) or a.partner_id=(select auth.uid()))
    and not exists(select 1 from public.workout_connection_blocks b
      where (b.blocker_id=a.requester_id and b.blocked_id=a.partner_id)
         or (b.blocker_id=a.partner_id and b.blocked_id=a.requester_id))));
grant select on public.workout_accountability_checkins to authenticated;

create or replace function public.workout_circle_notify(
  p_recipient uuid,p_actor uuid,p_kind text,p_reference uuid default null
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_enabled boolean;
begin
  if p_recipient is null or p_actor is null or p_recipient=p_actor then return; end if;
  if exists(select 1 from public.workout_connection_blocks b
    where (b.blocker_id=p_recipient and b.blocked_id=p_actor)
       or (b.blocker_id=p_actor and b.blocked_id=p_recipient)) then return; end if;
  select case
    when p_kind='connection_request' then coalesce(p.requests_enabled,true)
    when p_kind='encouragement' then coalesce(p.encouragement_enabled,true)
    when p_kind='milestone' then coalesce(p.milestones_enabled,true)
    when p_kind like 'accountability_%' then coalesce(p.accountability_enabled,true)
    else true end
  into v_enabled from public.workout_circle_preferences p where p.user_id=p_recipient;
  if coalesce(v_enabled,true)=false then return; end if;
  insert into public.workout_circle_notifications(recipient_id,actor_id,kind,reference_id)
  values(p_recipient,p_actor,p_kind,p_reference);
end;
$$;
revoke all on function public.workout_circle_notify(uuid,uuid,text,uuid) from public,anon,authenticated;

create or replace function public.workout_circle_connection_alert()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' and new.status='pending' then
    perform public.workout_circle_notify(new.recipient_id,new.requester_id,'connection_request',new.id);
  elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
    perform public.workout_circle_notify(new.requester_id,new.recipient_id,'connection_accepted',new.id);
  end if;
  return new;
end;
$$;
create trigger workout_circle_connection_alert
after insert or update of status on public.workout_connections
for each row execute function public.workout_circle_connection_alert();

create or replace function public.workout_circle_encouragement_alert()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.workout_circle_notify(new.recipient_id,new.sender_id,'encouragement',new.id);
  return new;
end;
$$;
create trigger workout_circle_encouragement_alert after insert on public.workout_encouragement
for each row execute function public.workout_circle_encouragement_alert();

-- Only status/details opt-ins may generate milestone alerts, without revealing the goal name or numbers.
create or replace function public.workout_circle_goal_alert()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_friend uuid;
begin
  if new.visibility not in ('status','details') or
     new.progress_status is distinct from 'Goal reached' or
     (tg_op='UPDATE' and old.progress_status='Goal reached') then return new; end if;
  for v_friend in
    select case when c.requester_id=new.owner_id then c.recipient_id else c.requester_id end
    from public.workout_connections c
    where c.status='accepted' and (c.requester_id=new.owner_id or c.recipient_id=new.owner_id)
  loop
    perform public.workout_circle_notify(v_friend,new.owner_id,'milestone',null);
  end loop;
  return new;
end;
$$;
create trigger workout_circle_goal_alert
after insert or update on public.workout_goal_shares
for each row execute function public.workout_circle_goal_alert();

create or replace function public.workout_circle_mark_read(p_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.workout_circle_notifications set read_at=coalesce(read_at,now())
 where id=p_id and recipient_id=auth.uid();
 return found;
end;
$$;

create or replace function public.workout_accountability_propose(
  p_partner_id uuid,p_goal_id text default null,p_frequency text default 'weekly',
  p_support_style text default 'encouragement'
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_partner_id is null or p_partner_id=v_user then raise exception 'Choose a valid connection'; end if;
 if p_frequency not in ('weekly','biweekly') or p_support_style not in ('encouragement','checkin','workout')
   then raise exception 'Unsupported check-in preference'; end if;
 if not exists(select 1 from public.workout_connections c where c.status='accepted'
     and ((c.requester_id=v_user and c.recipient_id=p_partner_id)
       or (c.recipient_id=v_user and c.requester_id=p_partner_id))) then
   raise exception 'Accountability requires an accepted connection'; end if;
 if exists(select 1 from public.workout_connection_blocks b
     where (b.blocker_id=v_user and b.blocked_id=p_partner_id)
        or (b.blocker_id=p_partner_id and b.blocked_id=v_user))
   then raise exception 'Connection unavailable'; end if;
 if p_goal_id is not null and not exists(select 1 from public.workout_goal_shares g
    where g.owner_id=v_user and g.goal_id=p_goal_id) then
   raise exception 'Share the goal before requesting accountability'; end if;
 insert into public.workout_accountability_agreements(requester_id,partner_id,goal_id,frequency,support_style)
 values(v_user,p_partner_id,p_goal_id,p_frequency,p_support_style)
 on conflict(user_low,user_high) do nothing returning id into v_id;
 if v_id is null then raise exception 'An accountability agreement already exists with this member'; end if;
 perform public.workout_circle_notify(p_partner_id,v_user,'accountability_request',v_id);
 return v_id;
end;
$$;
create or replace function public.workout_accountability_action(p_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_row public.workout_accountability_agreements%rowtype;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 select * into v_row from public.workout_accountability_agreements where id=p_id for update;
 if not found or v_user not in (v_row.requester_id,v_row.partner_id) then
   raise exception 'Agreement unavailable'; end if;
 if p_action='accept' and v_row.status='pending' and v_user=v_row.partner_id then
   update public.workout_accountability_agreements set status='active',accepted_at=now(),updated_at=now() where id=p_id;
   perform public.workout_circle_notify(v_row.requester_id,v_user,'accountability_accepted',p_id);
 elsif p_action='decline' and v_row.status='pending' and v_user=v_row.partner_id then
   delete from public.workout_accountability_agreements where id=p_id;
 elsif p_action='pause' and v_row.status='active' then
   update public.workout_accountability_agreements set status='paused',updated_at=now() where id=p_id;
 elsif p_action='resume' and v_row.status='paused' then
   update public.workout_accountability_agreements set status='active',updated_at=now() where id=p_id;
 elsif p_action='remove' then
   delete from public.workout_accountability_agreements where id=p_id;
 else raise exception 'Action is unavailable for this agreement'; end if;
 return true;
end;
$$;
create or replace function public.workout_accountability_checkin(
  p_agreement_id uuid,p_signal text,p_note text default ''
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_row public.workout_accountability_agreements%rowtype;
  v_id uuid; v_other uuid;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 select * into v_row from public.workout_accountability_agreements where id=p_agreement_id;
 if not found or v_row.status<>'active' or v_user not in(v_row.requester_id,v_row.partner_id) then
   raise exception 'Active accountability agreement required'; end if;
 if p_signal not in ('on_track','need_support','recovery','celebrate') or char_length(coalesce(p_note,''))>240 then
   raise exception 'Invalid check-in'; end if;
 v_other:=case when v_user=v_row.requester_id then v_row.partner_id else v_row.requester_id end;
 if exists(select 1 from public.workout_connection_blocks b where
     (b.blocker_id=v_user and b.blocked_id=v_other) or
     (b.blocker_id=v_other and b.blocked_id=v_user)) then raise exception 'Connection unavailable'; end if;
 if not exists(select 1 from public.workout_connections c where c.status='accepted'
    and ((c.requester_id=v_user and c.recipient_id=v_other)
      or (c.recipient_id=v_user and c.requester_id=v_other))) then
   raise exception 'Connection is no longer active'; end if;
 insert into public.workout_accountability_checkins(agreement_id,sender_id,signal,note)
 values(p_agreement_id,v_user,p_signal,btrim(coalesce(p_note,''))) returning id into v_id;
 perform public.workout_circle_notify(v_other,v_user,'accountability_checkin',v_id);
 return v_id;
end;
$$;
revoke all on function public.workout_circle_mark_read(uuid),
  public.workout_accountability_propose(uuid,text,text,text),
  public.workout_accountability_action(uuid,text),
  public.workout_accountability_checkin(uuid,text,text) from public,anon;
grant execute on function public.workout_circle_mark_read(uuid),
  public.workout_accountability_propose(uuid,text,text,text),
  public.workout_accountability_action(uuid,text),
  public.workout_accountability_checkin(uuid,text,text) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and
     not exists(select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename='workout_circle_notifications') then
    alter publication supabase_realtime add table public.workout_circle_notifications;
  end if;
end $$;
notify pgrst,'reload schema';
