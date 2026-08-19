create table if not exists public.passport_rank_overrides (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  rank_name text not null check (rank_name in ('Explorer','Pathfinder','Trailblazer','Adventurer','Summit Seeker','Ascendant')),
  reason text not null check (length(btrim(reason)) between 2 and 500),
  set_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.passport_recognition_audit (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('rank_override_set','rank_override_cleared','badge_granted','badge_revoked','stamp_granted','stamp_revoked')),
  subject_type text not null check (subject_type in ('rank','badge','stamp')),
  subject_id uuid,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  reason text not null check (length(btrim(reason)) between 2 and 500),
  created_at timestamptz not null default now()
);

create index if not exists passport_recognition_audit_target_created_idx
  on public.passport_recognition_audit(target_profile_id, created_at desc);
create index if not exists passport_recognition_audit_actor_created_idx
  on public.passport_recognition_audit(actor_profile_id, created_at desc);

alter table public.passport_rank_overrides enable row level security;
alter table public.passport_recognition_audit enable row level security;

drop policy if exists "Master account full access" on public.passport_rank_overrides;
create policy "Master account full access"
  on public.passport_rank_overrides
  for all
  to authenticated
  using (app_private.is_master_account())
  with check (app_private.is_master_account());

drop policy if exists "Master account full access" on public.passport_recognition_audit;
create policy "Master account full access"
  on public.passport_recognition_audit
  for all
  to authenticated
  using (app_private.is_master_account())
  with check (app_private.is_master_account());

create or replace function public.passport_rank_for_completed(p_completed bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_completed, 0) >= 20 then 'Ascendant'
    when coalesce(p_completed, 0) >= 10 then 'Summit Seeker'
    when coalesce(p_completed, 0) >= 5 then 'Adventurer'
    when coalesce(p_completed, 0) >= 3 then 'Trailblazer'
    when coalesce(p_completed, 0) >= 1 then 'Pathfinder'
    else 'Explorer'
  end;
$$;

create or replace function public.get_my_passport_rank()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_completed bigint := 0;
  v_override text;
begin
  if v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  select count(*) into v_completed
  from public.member_journey j
  where j.profile_id = v_profile_id;

  select o.rank_name into v_override
  from public.passport_rank_overrides o
  where o.profile_id = v_profile_id;

  return jsonb_build_object(
    'completed_adventures', v_completed,
    'calculated_rank', public.passport_rank_for_completed(v_completed),
    'rank_override', v_override,
    'effective_rank', coalesce(v_override, public.passport_rank_for_completed(v_completed))
  );
end;
$$;

create or replace function public.creator_search_passport_members(
  p_query text default '',
  p_limit integer default 30
)
returns table (
  profile_id uuid,
  display_name text,
  username text,
  email text,
  avatar_url text,
  platform_role text,
  completed_adventures bigint,
  badge_count bigint,
  stamp_count bigint,
  calculated_rank text,
  rank_override text,
  effective_rank text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 50));
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.email,
    p.avatar_url,
    p.platform_role,
    coalesce(j.completed_adventures, 0)::bigint,
    coalesce(b.badge_count, 0)::bigint,
    coalesce(s.stamp_count, 0)::bigint,
    public.passport_rank_for_completed(coalesce(j.completed_adventures, 0)),
    o.rank_name,
    coalesce(o.rank_name, public.passport_rank_for_completed(coalesce(j.completed_adventures, 0)))
  from public.profiles p
  left join lateral (
    select count(*)::bigint as completed_adventures
    from public.member_journey mj
    where mj.profile_id = p.id
  ) j on true
  left join lateral (
    select count(*)::bigint as badge_count
    from public.member_badges mb
    where mb.profile_id = p.id
  ) b on true
  left join lateral (
    select count(*)::bigint as stamp_count
    from public.member_passport_stamps ms
    where ms.profile_id = p.id
  ) s on true
  left join public.passport_rank_overrides o on o.profile_id = p.id
  where v_query = ''
     or lower(coalesce(p.display_name, '')) like '%' || v_query || '%'
     or lower(coalesce(p.username, '')) like '%' || v_query || '%'
     or lower(coalesce(p.email, '')) like '%' || v_query || '%'
  order by case when p.id = auth.uid() then 0 else 1 end,
           lower(coalesce(p.display_name, p.username, p.email, ''))
  limit v_limit;
end;
$$;

create or replace function public.creator_get_passport_recognition(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member jsonb;
  v_completed bigint := 0;
  v_override public.passport_rank_overrides%rowtype;
  v_badges jsonb := '[]'::jsonb;
  v_stamps jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;

  select jsonb_build_object(
    'profile_id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'email', p.email,
    'avatar_url', p.avatar_url,
    'platform_role', p.platform_role
  ) into v_member
  from public.profiles p
  where p.id = p_profile_id;

  if v_member is null then
    raise exception 'Member not found';
  end if;

  select count(*) into v_completed
  from public.member_journey j
  where j.profile_id = p_profile_id;

  select * into v_override
  from public.passport_rank_overrides o
  where o.profile_id = p_profile_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'badge_id', b.id,
      'code', b.code,
      'title', b.title,
      'description', b.description,
      'icon_name', b.icon_name,
      'category', b.category,
      'earned', mb.id is not null,
      'member_badge_id', mb.id,
      'earned_at', mb.earned_at,
      'evidence', coalesce(mb.evidence, '{}'::jsonb)
    ) order by (mb.id is not null) desc, lower(b.title)
  ), '[]'::jsonb) into v_badges
  from public.badges b
  left join public.member_badges mb
    on mb.badge_id = b.id and mb.profile_id = p_profile_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'stamp_id', ps.id,
      'code', ps.code,
      'title', ps.title,
      'description', ps.description,
      'icon_name', ps.icon_name,
      'category', ps.category,
      'earned_count', coalesce(ms.earned_count, 0),
      'acquisitions', coalesce(ms.acquisitions, '[]'::jsonb)
    ) order by (coalesce(ms.earned_count, 0) > 0) desc, lower(ps.title)
  ), '[]'::jsonb) into v_stamps
  from public.passport_stamps ps
  left join lateral (
    select
      count(*)::integer as earned_count,
      jsonb_agg(jsonb_build_object(
        'member_stamp_id', mps.id,
        'earned_at', mps.earned_at,
        'adventure_id', mps.adventure_id,
        'evidence', coalesce(mps.evidence, '{}'::jsonb)
      ) order by mps.earned_at desc) as acquisitions
    from public.member_passport_stamps mps
    where mps.profile_id = p_profile_id and mps.stamp_id = ps.id
  ) ms on true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'action', a.action,
      'subject_type', a.subject_type,
      'subject_id', a.subject_id,
      'before_state', a.before_state,
      'after_state', a.after_state,
      'reason', a.reason,
      'created_at', a.created_at,
      'actor_profile_id', a.actor_profile_id
    ) order by a.created_at desc
  ), '[]'::jsonb) into v_history
  from (
    select * from public.passport_recognition_audit
    where target_profile_id = p_profile_id
    order by created_at desc
    limit 60
  ) a;

  return jsonb_build_object(
    'member', v_member,
    'rank', jsonb_build_object(
      'completed_adventures', v_completed,
      'calculated_rank', public.passport_rank_for_completed(v_completed),
      'rank_override', v_override.rank_name,
      'effective_rank', coalesce(v_override.rank_name, public.passport_rank_for_completed(v_completed)),
      'override_reason', v_override.reason,
      'override_set_at', v_override.updated_at
    ),
    'badges', v_badges,
    'stamps', v_stamps,
    'history', v_history
  );
end;
$$;

create or replace function public.creator_set_rank_override(
  p_profile_id uuid,
  p_rank_name text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := '{}'::jsonb;
  v_after jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if p_rank_name not in ('Explorer','Pathfinder','Trailblazer','Adventurer','Summit Seeker','Ascendant') then
    raise exception 'Invalid rank';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Member not found';
  end if;

  select to_jsonb(o) into v_before
  from public.passport_rank_overrides o
  where o.profile_id = p_profile_id;
  v_before := coalesce(v_before, '{}'::jsonb);

  insert into public.passport_rank_overrides(profile_id, rank_name, reason, set_by)
  values (p_profile_id, p_rank_name, v_reason, auth.uid())
  on conflict (profile_id) do update
    set rank_name = excluded.rank_name,
        reason = excluded.reason,
        set_by = excluded.set_by,
        updated_at = now();

  select to_jsonb(o) into v_after
  from public.passport_rank_overrides o
  where o.profile_id = p_profile_id;

  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'rank_override_set', 'rank', v_before, coalesce(v_after, '{}'::jsonb), v_reason
  );
end;
$$;

create or replace function public.creator_clear_rank_override(
  p_profile_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;

  select to_jsonb(o) into v_before
  from public.passport_rank_overrides o
  where o.profile_id = p_profile_id;

  if v_before is null then
    raise exception 'No rank override is active';
  end if;

  delete from public.passport_rank_overrides where profile_id = p_profile_id;

  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'rank_override_cleared', 'rank', v_before, '{}'::jsonb, v_reason
  );
end;
$$;

create or replace function public.creator_grant_badge(
  p_profile_id uuid,
  p_badge_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_after jsonb;
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Member not found';
  end if;
  if not exists (select 1 from public.badges where id = p_badge_id) then
    raise exception 'Badge not found';
  end if;

  insert into public.member_badges(profile_id, badge_id, earned_at, evidence)
  values (
    p_profile_id,
    p_badge_id,
    now(),
    jsonb_build_object('source','founder_manual','actor_profile_id',auth.uid(),'reason',v_reason)
  )
  on conflict (profile_id, badge_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'Member already has this badge';
  end if;

  select to_jsonb(mb) into v_after from public.member_badges mb where mb.id = v_id;
  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, subject_id, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'badge_granted', 'badge', p_badge_id, '{}'::jsonb, coalesce(v_after, '{}'::jsonb), v_reason
  );
  return v_id;
end;
$$;

create or replace function public.creator_revoke_badge(
  p_profile_id uuid,
  p_badge_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;

  select to_jsonb(mb) into v_before
  from public.member_badges mb
  where mb.profile_id = p_profile_id and mb.badge_id = p_badge_id;

  if v_before is null then
    raise exception 'Member does not have this badge';
  end if;

  delete from public.member_badges
  where profile_id = p_profile_id and badge_id = p_badge_id;

  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, subject_id, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'badge_revoked', 'badge', p_badge_id, v_before, '{}'::jsonb, v_reason
  );
end;
$$;

create or replace function public.creator_grant_stamp(
  p_profile_id uuid,
  p_stamp_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_after jsonb;
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Member not found';
  end if;
  if not exists (select 1 from public.passport_stamps where id = p_stamp_id) then
    raise exception 'Stamp not found';
  end if;
  if exists (
    select 1 from public.member_passport_stamps
    where profile_id = p_profile_id and stamp_id = p_stamp_id
  ) then
    raise exception 'Member already has this stamp';
  end if;

  insert into public.member_passport_stamps(profile_id, stamp_id, adventure_id, earned_at, evidence)
  values (
    p_profile_id,
    p_stamp_id,
    null,
    now(),
    jsonb_build_object('source','founder_manual','actor_profile_id',auth.uid(),'reason',v_reason)
  )
  returning id into v_id;

  select to_jsonb(ms) into v_after from public.member_passport_stamps ms where ms.id = v_id;
  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, subject_id, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'stamp_granted', 'stamp', p_stamp_id, '{}'::jsonb, coalesce(v_after, '{}'::jsonb), v_reason
  );
  return v_id;
end;
$$;

create or replace function public.creator_revoke_stamp(
  p_profile_id uuid,
  p_member_stamp_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_stamp_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app_private.is_master_account() then
    raise exception 'Founder access required';
  end if;
  if length(v_reason) < 2 then
    raise exception 'A reason is required';
  end if;

  select to_jsonb(ms), ms.stamp_id into v_before, v_stamp_id
  from public.member_passport_stamps ms
  where ms.id = p_member_stamp_id and ms.profile_id = p_profile_id;

  if v_before is null then
    raise exception 'Stamp acquisition not found';
  end if;

  delete from public.member_passport_stamps
  where id = p_member_stamp_id and profile_id = p_profile_id;

  insert into public.passport_recognition_audit(
    target_profile_id, actor_profile_id, action, subject_type, subject_id, before_state, after_state, reason
  ) values (
    p_profile_id, auth.uid(), 'stamp_revoked', 'stamp', v_stamp_id, v_before, '{}'::jsonb, v_reason
  );
end;
$$;

revoke all on function public.get_my_passport_rank() from public;
grant execute on function public.get_my_passport_rank() to authenticated;
revoke all on function public.creator_search_passport_members(text, integer) from public;
grant execute on function public.creator_search_passport_members(text, integer) to authenticated;
revoke all on function public.creator_get_passport_recognition(uuid) from public;
grant execute on function public.creator_get_passport_recognition(uuid) to authenticated;
revoke all on function public.creator_set_rank_override(uuid, text, text) from public;
grant execute on function public.creator_set_rank_override(uuid, text, text) to authenticated;
revoke all on function public.creator_clear_rank_override(uuid, text) from public;
grant execute on function public.creator_clear_rank_override(uuid, text) to authenticated;
revoke all on function public.creator_grant_badge(uuid, uuid, text) from public;
grant execute on function public.creator_grant_badge(uuid, uuid, text) to authenticated;
revoke all on function public.creator_revoke_badge(uuid, uuid, text) from public;
grant execute on function public.creator_revoke_badge(uuid, uuid, text) to authenticated;
revoke all on function public.creator_grant_stamp(uuid, uuid, text) from public;
grant execute on function public.creator_grant_stamp(uuid, uuid, text) to authenticated;
revoke all on function public.creator_revoke_stamp(uuid, uuid, text) from public;
grant execute on function public.creator_revoke_stamp(uuid, uuid, text) to authenticated;
