-- Founder Overwatch V1
-- Private founder-level registry, search, governance and audit layer.

create or replace function public.is_overwatch_owner(check_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(check_profile_id, auth.uid())
      and p.platform_role = 'founder'
      and p.status = 'active'
  );
$$;

revoke all on function public.is_overwatch_owner(uuid) from public;
grant execute on function public.is_overwatch_owner(uuid) to authenticated;

create table if not exists public.overwatch_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  reason text,
  previous_data jsonb not null default '{}'::jsonb,
  new_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists overwatch_audit_log_created_idx
  on public.overwatch_audit_log(created_at desc);
create index if not exists overwatch_audit_log_entity_idx
  on public.overwatch_audit_log(entity_type, entity_id, created_at desc);

alter table public.overwatch_audit_log enable row level security;

drop policy if exists "Founder reads Overwatch audit log" on public.overwatch_audit_log;
create policy "Founder reads Overwatch audit log"
on public.overwatch_audit_log for select to authenticated
using (public.is_overwatch_owner());

grant select on public.overwatch_audit_log to authenticated;

create or replace function public.overwatch_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_overwatch_owner() then
    raise exception 'Overwatch access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'counts', jsonb_build_object(
      'members', (select count(*) from public.profiles),
      'active_members', (select count(*) from public.profiles where status = 'active'),
      'hosts', (select count(*) from public.outing_hosts),
      'approved_hosts', (select count(*) from public.outing_hosts where status = 'approved'),
      'vendors', (
        (select count(*) from public.vendor_center_access)
        +
        (select count(*) from public.host_vendor_profiles where owner_profile_id is null and coalesce(is_demo, false) = false)
      ),
      'approved_vendors', (select count(*) from public.vendor_center_access where status = 'approved'),
      'groups', (select count(*) from public.community_groups),
      'events', (
        (select count(*) from public.adventures)
        +
        (select count(*) from public.local_events where coalesce(is_demo, false) = false)
      ),
      'active_memberships', (select count(*) from public.memberships where status = 'active'),
      'pending_approvals', (
        (select count(*) from public.outing_hosts where status = 'pending')
        +
        (select count(*) from public.vendor_center_access where status in ('pending','needs_info'))
      ),
      'open_reports', (select count(*) from public.community_reports where status in ('open','reviewing'))
    ),
    'members', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          p.created_at,
          jsonb_build_object(
            'id', p.id,
            'display_name', p.display_name,
            'username', p.username,
            'email', p.email,
            'home_city', p.home_city,
            'home_state', p.home_state,
            'status', p.status::text,
            'platform_role', p.platform_role,
            'event_host_level', p.event_host_level,
            'onboarding_completed_at', p.onboarding_completed_at,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'membership_name', coalesce(mm.membership_name, 'Free'),
            'membership_plan_code', mm.plan_code,
            'membership_status', coalesce(mm.membership_status, 'none'),
            'membership_ends_at', mm.current_period_ends_at,
            'host_status', oh.status,
            'vendor_status', va.status,
            'group_count', (select count(*) from public.community_group_members gm where gm.profile_id = p.id),
            'event_count', (
              (select count(*) from public.adventures a where a.created_by = p.id or a.presented_by_profile_id = p.id)
              +
              (select count(*) from public.local_events le where le.host_id = p.id and coalesce(le.is_demo, false) = false)
            ),
            'report_count', (select count(*) from public.community_reports cr where cr.reported_author_id = p.id)
          ) as row_data
        from public.profiles p
        left join public.outing_hosts oh on oh.profile_id = p.id
        left join public.vendor_center_access va on va.profile_id = p.id
        left join lateral (
          select m.plan_code, m.status as membership_status, m.current_period_ends_at, coalesce(mp.name, m.plan_code) as membership_name
          from public.memberships m
          left join public.membership_plans mp on mp.code = m.plan_code
          where m.profile_id = p.id
          order by m.created_at desc
          limit 1
        ) mm on true
        order by p.created_at desc
        limit 200
      ) q
    ),
    'hosts', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          oh.created_at,
          jsonb_build_object(
            'id', oh.profile_id,
            'profile_id', oh.profile_id,
            'display_name', p.display_name,
            'username', p.username,
            'email', p.email,
            'home_city', p.home_city,
            'home_state', p.home_state,
            'member_status', p.status::text,
            'status', oh.status,
            'host_type', oh.host_type,
            'risk_tier', oh.risk_tier,
            'can_create_paid_outings', oh.can_create_paid_outings,
            'payout_status', oh.payout_status,
            'application_note', oh.application_note,
            'approved_at', oh.approved_at,
            'created_at', oh.created_at,
            'updated_at', oh.updated_at,
            'group_count', (select count(*) from public.community_group_members gm where gm.profile_id = oh.profile_id and gm.role in ('host','moderator')),
            'event_count', (
              (select count(*) from public.adventures a where a.created_by = oh.profile_id or a.presented_by_profile_id = oh.profile_id)
              +
              (select count(*) from public.local_events le where le.host_id = oh.profile_id and coalesce(le.is_demo, false) = false)
            ),
            'report_count', (select count(*) from public.community_reports cr where cr.reported_author_id = oh.profile_id)
          ) as row_data
        from public.outing_hosts oh
        join public.profiles p on p.id = oh.profile_id
        order by oh.created_at desc
        limit 200
      ) q
    ),
    'vendors', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          va.created_at,
          jsonb_build_object(
            'entity_type', 'vendor',
            'id', va.profile_id,
            'profile_id', va.profile_id,
            'vendor_profile_id', hvp.id,
            'business_name', va.business_name,
            'category', va.category,
            'service_area', va.service_area,
            'application_note', va.application_note,
            'status', va.status,
            'applied_at', va.applied_at,
            'approved_at', va.approved_at,
            'created_at', va.created_at,
            'updated_at', va.updated_at,
            'member_name', p.display_name,
            'username', p.username,
            'member_email', p.email,
            'member_status', p.status::text,
            'verification_status', hvp.verification_status,
            'marketplace_visible', hvp.marketplace_visible,
            'featured', hvp.featured,
            'website', hvp.website,
            'phone', hvp.phone
          ) as row_data
        from public.vendor_center_access va
        join public.profiles p on p.id = va.profile_id
        left join lateral (
          select v.*
          from public.host_vendor_profiles v
          where v.owner_profile_id = va.profile_id
            and coalesce(v.is_demo, false) = false
          order by v.created_at asc
          limit 1
        ) hvp on true

        union all

        select
          hvp.created_at,
          jsonb_build_object(
            'entity_type', 'vendor_profile',
            'id', hvp.id,
            'profile_id', null,
            'vendor_profile_id', hvp.id,
            'business_name', hvp.business_name,
            'category', hvp.category,
            'service_area', hvp.service_area,
            'application_note', null,
            'status', 'directory',
            'applied_at', null,
            'approved_at', null,
            'created_at', hvp.created_at,
            'updated_at', hvp.updated_at,
            'member_name', hvp.contact_name,
            'username', null,
            'member_email', hvp.email,
            'member_status', null,
            'verification_status', hvp.verification_status,
            'marketplace_visible', hvp.marketplace_visible,
            'featured', hvp.featured,
            'website', hvp.website,
            'phone', hvp.phone
          ) as row_data
        from public.host_vendor_profiles hvp
        where hvp.owner_profile_id is null
          and coalesce(hvp.is_demo, false) = false
        order by created_at desc
        limit 200
      ) q
    ),
    'groups', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          g.created_at,
          jsonb_build_object(
            'id', g.id,
            'name', g.name,
            'description', g.description,
            'kind', g.kind,
            'city', g.city,
            'state', g.state,
            'visibility', g.visibility,
            'management_type', g.management_type,
            'adventure_id', g.adventure_id,
            'created_by', g.created_by,
            'creator_name', p.display_name,
            'creator_username', p.username,
            'creator_email', p.email,
            'member_count', (select count(*) from public.community_group_members gm where gm.group_id = g.id),
            'moderator_count', (select count(*) from public.community_group_members gm where gm.group_id = g.id and gm.role in ('host','moderator')),
            'event_count', (
              (select count(*) from public.local_events le where le.group_id = g.id and coalesce(le.is_demo, false) = false)
              +
              (case when g.adventure_id is null then 0 else 1 end)
            ),
            'created_at', g.created_at,
            'updated_at', g.updated_at
          ) as row_data
        from public.community_groups g
        left join public.profiles p on p.id = g.created_by
        order by g.created_at desc
        limit 200
      ) q
    ),
    'events', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          a.created_at,
          jsonb_build_object(
            'entity_type', 'adventure',
            'id', a.id,
            'title', a.title,
            'source', 'adventure',
            'category', a.category,
            'status', a.status::text,
            'starts_at', a.starts_at,
            'ends_at', a.ends_at,
            'city', a.city,
            'state', a.state,
            'venue_name', a.venue_name,
            'visibility', a.visibility,
            'host_id', coalesce(a.presented_by_profile_id, a.created_by),
            'host_name', hp.display_name,
            'host_username', hp.username,
            'host_email', hp.email,
            'group_id', cg.id,
            'group_name', cg.name,
            'capacity', a.capacity,
            'is_featured', a.is_featured,
            'published_at', a.published_at,
            'created_at', a.created_at,
            'updated_at', a.updated_at
          ) as row_data
        from public.adventures a
        left join public.profiles hp on hp.id = coalesce(a.presented_by_profile_id, a.created_by)
        left join public.community_groups cg on cg.adventure_id = a.id

        union all

        select
          le.created_at,
          jsonb_build_object(
            'entity_type', 'local_event',
            'id', le.id,
            'title', le.title,
            'source', 'local_event',
            'category', le.category,
            'status', le.status,
            'starts_at', le.starts_at,
            'ends_at', le.ends_at,
            'city', le.city,
            'state', le.state,
            'venue_name', le.venue_name,
            'visibility', case when le.group_id is null then 'public' else 'group' end,
            'host_id', le.host_id,
            'host_name', hp.display_name,
            'host_username', hp.username,
            'host_email', hp.email,
            'group_id', le.group_id,
            'group_name', cg.name,
            'capacity', le.capacity,
            'is_featured', false,
            'published_at', null,
            'created_at', le.created_at,
            'updated_at', le.updated_at
          ) as row_data
        from public.local_events le
        left join public.profiles hp on hp.id = le.host_id
        left join public.community_groups cg on cg.id = le.group_id
        where coalesce(le.is_demo, false) = false
        order by created_at desc
        limit 250
      ) q
    ),
    'reports', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          cr.created_at,
          jsonb_build_object(
            'id', cr.id,
            'status', cr.status::text,
            'priority', cr.priority,
            'reason', cr.reason,
            'details', cr.details,
            'reporter_id', cr.reporter_id,
            'reporter_name', rp.display_name,
            'reporter_username', rp.username,
            'reported_author_id', cr.reported_author_id,
            'reported_author_name', ap.display_name,
            'reported_author_username', ap.username,
            'content_snapshot', cr.content_snapshot,
            'action_taken', cr.action_taken,
            'resolution_note', cr.resolution_note,
            'created_at', cr.created_at,
            'reviewed_at', cr.reviewed_at
          ) as row_data
        from public.community_reports cr
        left join public.profiles rp on rp.id = cr.reporter_id
        left join public.profiles ap on ap.id = cr.reported_author_id
        order by cr.created_at desc
        limit 200
      ) q
    ),
    'audit', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select
          al.created_at,
          jsonb_build_object(
            'id', al.id,
            'actor_id', al.actor_id,
            'actor_name', p.display_name,
            'action', al.action,
            'entity_type', al.entity_type,
            'entity_id', al.entity_id,
            'reason', al.reason,
            'previous_data', al.previous_data,
            'new_data', al.new_data,
            'created_at', al.created_at
          ) as row_data
        from public.overwatch_audit_log al
        left join public.profiles p on p.id = al.actor_id
        order by al.created_at desc
        limit 200
      ) q
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
      from (
        select created_at, jsonb_build_object('entity_type','member','id',id,'title',coalesce(display_name, username, 'New member'),'subtitle','Member joined','status',status::text,'created_at',created_at) as row_data from public.profiles
        union all
        select oh.created_at, jsonb_build_object('entity_type','host','id',oh.profile_id,'title',coalesce(p.display_name,p.username,'Host'),'subtitle','Host application','status',oh.status,'created_at',oh.created_at) from public.outing_hosts oh join public.profiles p on p.id = oh.profile_id
        union all
        select va.created_at, jsonb_build_object('entity_type','vendor','id',va.profile_id,'title',coalesce(nullif(va.business_name,''),p.display_name,p.username,'Vendor'),'subtitle','Vendor application','status',va.status,'created_at',va.created_at) from public.vendor_center_access va join public.profiles p on p.id = va.profile_id
        union all
        select g.created_at, jsonb_build_object('entity_type','group','id',g.id,'title',g.name,'subtitle','Group created','status',g.visibility,'created_at',g.created_at) from public.community_groups g
        union all
        select a.created_at, jsonb_build_object('entity_type','adventure','id',a.id,'title',a.title,'subtitle','Event listed','status',a.status::text,'created_at',a.created_at) from public.adventures a
        union all
        select le.created_at, jsonb_build_object('entity_type','local_event','id',le.id,'title',le.title,'subtitle','Local event listed','status',le.status,'created_at',le.created_at) from public.local_events le where coalesce(le.is_demo,false)=false
        order by created_at desc
        limit 100
      ) q
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.overwatch_snapshot() from public;
grant execute on function public.overwatch_snapshot() to authenticated;

create or replace function public.overwatch_search(p_query text, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_result jsonb;
begin
  if not public.is_overwatch_owner() then
    raise exception 'Overwatch access required.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_query, ''))) < 2 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_data order by rank_order, created_at desc), '[]'::jsonb)
  into v_result
  from (
    select * from (
      select 1 as rank_order, p.created_at, jsonb_build_object(
        'entity_type','member','id',p.id,'title',coalesce(p.display_name,p.username,p.email,'Member'),
        'subtitle',concat_ws(' · ', nullif(p.email,''), nullif(concat_ws(', ',p.home_city,p.home_state),'')),
        'status',p.status::text,'created_at',p.created_at
      ) as row_data
      from public.profiles p
      where lower(coalesce(p.display_name,'')) like v_query
         or lower(coalesce(p.username,'')) like v_query
         or lower(coalesce(p.email,'')) like v_query
         or lower(coalesce(p.home_city,'')) like v_query
         or lower(coalesce(p.home_state,'')) like v_query

      union all

      select 2, oh.created_at, jsonb_build_object(
        'entity_type','host','id',oh.profile_id,'title',coalesce(p.display_name,p.username,p.email,'Host'),
        'subtitle',concat_ws(' · ', 'Host', oh.host_type, p.email),'status',oh.status,'created_at',oh.created_at
      )
      from public.outing_hosts oh
      join public.profiles p on p.id = oh.profile_id
      where lower(coalesce(p.display_name,'')) like v_query
         or lower(coalesce(p.username,'')) like v_query
         or lower(coalesce(p.email,'')) like v_query
         or lower(coalesce(oh.host_type,'')) like v_query

      union all

      select 3, va.created_at, jsonb_build_object(
        'entity_type','vendor','id',va.profile_id,'title',coalesce(nullif(va.business_name,''),p.display_name,p.username,'Vendor'),
        'subtitle',concat_ws(' · ', nullif(va.category,''), nullif(va.service_area,''), p.email),'status',va.status,'created_at',va.created_at
      )
      from public.vendor_center_access va
      join public.profiles p on p.id = va.profile_id
      where lower(coalesce(va.business_name,'')) like v_query
         or lower(coalesce(va.category,'')) like v_query
         or lower(coalesce(va.service_area,'')) like v_query
         or lower(coalesce(p.display_name,'')) like v_query
         or lower(coalesce(p.email,'')) like v_query

      union all

      select 4, hvp.created_at, jsonb_build_object(
        'entity_type','vendor_profile','id',hvp.id,'title',hvp.business_name,
        'subtitle',concat_ws(' · ', nullif(hvp.category,''), nullif(hvp.service_area,''), nullif(hvp.email,'')),'status',coalesce(hvp.verification_status,'directory'),'created_at',hvp.created_at
      )
      from public.host_vendor_profiles hvp
      where hvp.owner_profile_id is null
        and coalesce(hvp.is_demo,false)=false
        and (
          lower(coalesce(hvp.business_name,'')) like v_query
          or lower(coalesce(hvp.category,'')) like v_query
          or lower(coalesce(hvp.service_area,'')) like v_query
          or lower(coalesce(hvp.email,'')) like v_query
        )

      union all

      select 5, g.created_at, jsonb_build_object(
        'entity_type','group','id',g.id,'title',g.name,
        'subtitle',concat_ws(' · ', g.kind, nullif(concat_ws(', ',g.city,g.state),'')),'status',g.visibility,'created_at',g.created_at
      )
      from public.community_groups g
      where lower(coalesce(g.name,'')) like v_query
         or lower(coalesce(g.description,'')) like v_query
         or lower(coalesce(g.city,'')) like v_query
         or lower(coalesce(g.state,'')) like v_query

      union all

      select 6, a.created_at, jsonb_build_object(
        'entity_type','adventure','id',a.id,'title',a.title,
        'subtitle',concat_ws(' · ', 'Event', nullif(concat_ws(', ',a.city,a.state),'')),'status',a.status::text,'created_at',a.created_at
      )
      from public.adventures a
      where lower(coalesce(a.title,'')) like v_query
         or lower(coalesce(a.category,'')) like v_query
         or lower(coalesce(a.city,'')) like v_query
         or lower(coalesce(a.state,'')) like v_query
         or lower(coalesce(a.venue_name,'')) like v_query

      union all

      select 7, le.created_at, jsonb_build_object(
        'entity_type','local_event','id',le.id,'title',le.title,
        'subtitle',concat_ws(' · ', 'Local event', nullif(concat_ws(', ',le.city,le.state),'')),'status',le.status,'created_at',le.created_at
      )
      from public.local_events le
      where coalesce(le.is_demo,false)=false
        and (
          lower(coalesce(le.title,'')) like v_query
          or lower(coalesce(le.category,'')) like v_query
          or lower(coalesce(le.city,'')) like v_query
          or lower(coalesce(le.state,'')) like v_query
          or lower(coalesce(le.venue_name,'')) like v_query
        )
    ) matches
    order by rank_order, created_at desc
    limit v_limit
  ) limited;

  return v_result;
end;
$$;

revoke all on function public.overwatch_search(text, integer) from public;
grant execute on function public.overwatch_search(text, integer) to authenticated;

create or replace function public.overwatch_entity_detail(p_entity_type text, p_entity_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_result jsonb;
begin
  if not public.is_overwatch_owner() then
    raise exception 'Overwatch access required.' using errcode = '42501';
  end if;

  begin
    v_id := p_entity_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid entity id.';
  end;

  case p_entity_type
    when 'member' then
      select jsonb_build_object(
        'entity_type','member','id',p.id,'display_name',p.display_name,'username',p.username,'email',p.email,
        'home_city',p.home_city,'home_state',p.home_state,'status',p.status::text,'platform_role',p.platform_role,
        'event_host_level',p.event_host_level,'onboarding_completed_at',p.onboarding_completed_at,'created_at',p.created_at,'updated_at',p.updated_at,
        'membership_name',coalesce(mm.membership_name,'Free'),'membership_plan_code',mm.plan_code,'membership_status',coalesce(mm.membership_status,'none'),'membership_ends_at',mm.current_period_ends_at,
        'host_status',oh.status,'vendor_status',va.status,
        'group_count',(select count(*) from public.community_group_members gm where gm.profile_id=p.id),
        'event_count',((select count(*) from public.adventures a where a.created_by=p.id or a.presented_by_profile_id=p.id)+(select count(*) from public.local_events le where le.host_id=p.id and coalesce(le.is_demo,false)=false)),
        'report_count',(select count(*) from public.community_reports cr where cr.reported_author_id=p.id)
      ) into v_result
      from public.profiles p
      left join public.outing_hosts oh on oh.profile_id=p.id
      left join public.vendor_center_access va on va.profile_id=p.id
      left join lateral (
        select m.plan_code,m.status as membership_status,m.current_period_ends_at,coalesce(mp.name,m.plan_code) as membership_name
        from public.memberships m left join public.membership_plans mp on mp.code=m.plan_code
        where m.profile_id=p.id order by m.created_at desc limit 1
      ) mm on true
      where p.id=v_id;

    when 'host' then
      select jsonb_build_object(
        'entity_type','host','id',oh.profile_id,'profile_id',oh.profile_id,'display_name',p.display_name,'username',p.username,'email',p.email,
        'home_city',p.home_city,'home_state',p.home_state,'member_status',p.status::text,'status',oh.status,'host_type',oh.host_type,
        'risk_tier',oh.risk_tier,'can_create_paid_outings',oh.can_create_paid_outings,'payout_status',oh.payout_status,'application_note',oh.application_note,
        'approved_at',oh.approved_at,'created_at',oh.created_at,'updated_at',oh.updated_at,
        'group_count',(select count(*) from public.community_group_members gm where gm.profile_id=oh.profile_id and gm.role in ('host','moderator')),
        'event_count',((select count(*) from public.adventures a where a.created_by=oh.profile_id or a.presented_by_profile_id=oh.profile_id)+(select count(*) from public.local_events le where le.host_id=oh.profile_id and coalesce(le.is_demo,false)=false)),
        'report_count',(select count(*) from public.community_reports cr where cr.reported_author_id=oh.profile_id)
      ) into v_result
      from public.outing_hosts oh join public.profiles p on p.id=oh.profile_id where oh.profile_id=v_id;

    when 'vendor' then
      select jsonb_build_object(
        'entity_type','vendor','id',va.profile_id,'profile_id',va.profile_id,'vendor_profile_id',hvp.id,'business_name',va.business_name,'category',va.category,
        'service_area',va.service_area,'application_note',va.application_note,'status',va.status,'applied_at',va.applied_at,'approved_at',va.approved_at,
        'created_at',va.created_at,'updated_at',va.updated_at,'member_name',p.display_name,'username',p.username,'member_email',p.email,'member_status',p.status::text,
        'verification_status',hvp.verification_status,'marketplace_visible',hvp.marketplace_visible,'featured',hvp.featured,'website',hvp.website,'phone',hvp.phone
      ) into v_result
      from public.vendor_center_access va join public.profiles p on p.id=va.profile_id
      left join lateral (select v.* from public.host_vendor_profiles v where v.owner_profile_id=va.profile_id and coalesce(v.is_demo,false)=false order by v.created_at asc limit 1) hvp on true
      where va.profile_id=v_id;

    when 'vendor_profile' then
      select jsonb_build_object(
        'entity_type','vendor_profile','id',hvp.id,'vendor_profile_id',hvp.id,'business_name',hvp.business_name,'category',hvp.category,'description',hvp.description,
        'service_area',hvp.service_area,'status','directory','contact_name',hvp.contact_name,'email',hvp.email,'phone',hvp.phone,'website',hvp.website,
        'verification_status',hvp.verification_status,'marketplace_visible',hvp.marketplace_visible,'featured',hvp.featured,'created_at',hvp.created_at,'updated_at',hvp.updated_at
      ) into v_result
      from public.host_vendor_profiles hvp where hvp.id=v_id and coalesce(hvp.is_demo,false)=false;

    when 'group' then
      select jsonb_build_object(
        'entity_type','group','id',g.id,'name',g.name,'description',g.description,'kind',g.kind,'city',g.city,'state',g.state,'visibility',g.visibility,
        'management_type',g.management_type,'adventure_id',g.adventure_id,'created_by',g.created_by,'creator_name',p.display_name,'creator_username',p.username,'creator_email',p.email,
        'member_count',(select count(*) from public.community_group_members gm where gm.group_id=g.id),
        'moderator_count',(select count(*) from public.community_group_members gm where gm.group_id=g.id and gm.role in ('host','moderator')),
        'event_count',((select count(*) from public.local_events le where le.group_id=g.id and coalesce(le.is_demo,false)=false)+(case when g.adventure_id is null then 0 else 1 end)),
        'created_at',g.created_at,'updated_at',g.updated_at
      ) into v_result
      from public.community_groups g left join public.profiles p on p.id=g.created_by where g.id=v_id;

    when 'adventure' then
      select jsonb_build_object(
        'entity_type','adventure','id',a.id,'title',a.title,'source','adventure','summary',a.summary,'description',a.description,'category',a.category,'status',a.status::text,
        'starts_at',a.starts_at,'ends_at',a.ends_at,'city',a.city,'state',a.state,'venue_name',a.venue_name,'address',a.address,'visibility',a.visibility,'capacity',a.capacity,
        'is_featured',a.is_featured,'published_at',a.published_at,'host_id',coalesce(a.presented_by_profile_id,a.created_by),'host_name',p.display_name,'host_username',p.username,'host_email',p.email,
        'group_id',cg.id,'group_name',cg.name,'created_at',a.created_at,'updated_at',a.updated_at
      ) into v_result
      from public.adventures a left join public.profiles p on p.id=coalesce(a.presented_by_profile_id,a.created_by) left join public.community_groups cg on cg.adventure_id=a.id where a.id=v_id;

    when 'local_event' then
      select jsonb_build_object(
        'entity_type','local_event','id',le.id,'title',le.title,'source','local_event','description',le.description,'category',le.category,'status',le.status,
        'starts_at',le.starts_at,'ends_at',le.ends_at,'city',le.city,'state',le.state,'venue_name',le.venue_name,'visibility',case when le.group_id is null then 'public' else 'group' end,'capacity',le.capacity,
        'host_id',le.host_id,'host_name',p.display_name,'host_username',p.username,'host_email',p.email,'group_id',le.group_id,'group_name',cg.name,'created_at',le.created_at,'updated_at',le.updated_at
      ) into v_result
      from public.local_events le left join public.profiles p on p.id=le.host_id left join public.community_groups cg on cg.id=le.group_id where le.id=v_id and coalesce(le.is_demo,false)=false;

    when 'report' then
      select jsonb_build_object(
        'entity_type','report','id',cr.id,'status',cr.status::text,'priority',cr.priority,'reason',cr.reason,'details',cr.details,'reporter_id',cr.reporter_id,
        'reporter_name',rp.display_name,'reporter_username',rp.username,'reported_author_id',cr.reported_author_id,'reported_author_name',ap.display_name,'reported_author_username',ap.username,
        'content_snapshot',cr.content_snapshot,'action_taken',cr.action_taken,'resolution_note',cr.resolution_note,'created_at',cr.created_at,'reviewed_at',cr.reviewed_at
      ) into v_result
      from public.community_reports cr left join public.profiles rp on rp.id=cr.reporter_id left join public.profiles ap on ap.id=cr.reported_author_id where cr.id=v_id;

    else
      raise exception 'Unsupported Overwatch entity type: %', p_entity_type;
  end case;

  if v_result is null then
    raise exception 'Overwatch record not found.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.overwatch_entity_detail(text, text) from public;
grant execute on function public.overwatch_entity_detail(text, text) to authenticated;

create or replace function public.overwatch_control(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_target text;
begin
  if not public.is_overwatch_owner() then
    raise exception 'Overwatch access required.' using errcode = '42501';
  end if;

  begin
    v_id := p_entity_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid entity id.';
  end;

  if p_action in ('restrict','suspend','pause','revoke','decline','needs_info','cancel','unpublish') and v_reason is null then
    raise exception 'A reason is required for this action.';
  end if;

  if p_entity_type = 'member' then
    if v_id = auth.uid() and p_action in ('restrict','suspend') then
      raise exception 'You cannot restrict or suspend your own founder account.';
    end if;

    select jsonb_build_object('status',status::text) into v_before from public.profiles where id=v_id;
    if v_before is null then raise exception 'Member not found.'; end if;

    if p_action = 'activate' then v_target := 'active';
    elsif p_action = 'restrict' then v_target := 'restricted';
    elsif p_action = 'suspend' then v_target := 'suspended';
    else raise exception 'Unsupported member action.';
    end if;

    update public.profiles set status=v_target::public.member_status, updated_at=now() where id=v_id;
    select jsonb_build_object('status',status::text) into v_after from public.profiles where id=v_id;

  elsif p_entity_type = 'host' then
    select jsonb_build_object('status',status) into v_before from public.outing_hosts where profile_id=v_id;
    if v_before is null then raise exception 'Host not found.'; end if;

    if p_action = 'approve' then v_target := 'approved';
    elsif p_action = 'pause' then v_target := 'paused';
    elsif p_action = 'revoke' then v_target := 'revoked';
    else raise exception 'Unsupported host action.';
    end if;

    update public.outing_hosts
      set status=v_target,
          approved_by=case when v_target='approved' then auth.uid() else approved_by end,
          approved_at=case when v_target='approved' then coalesce(approved_at,now()) else approved_at end,
          updated_at=now()
      where profile_id=v_id;
    select jsonb_build_object('status',status) into v_after from public.outing_hosts where profile_id=v_id;

  elsif p_entity_type = 'vendor' then
    select jsonb_build_object('status',status) into v_before from public.vendor_center_access where profile_id=v_id;
    if v_before is null then raise exception 'Vendor application not found.'; end if;

    if p_action in ('approve','needs_info','decline','pause','revoke') then
      v_target := case p_action when 'approve' then 'approved' else p_action end;
    else
      raise exception 'Unsupported vendor action.';
    end if;

    perform public.review_vendor_access(v_id, v_target);
    select jsonb_build_object('status',status) into v_after from public.vendor_center_access where profile_id=v_id;

  elsif p_entity_type = 'group' then
    select jsonb_build_object('visibility',visibility) into v_before from public.community_groups where id=v_id;
    if v_before is null then raise exception 'Group not found.'; end if;

    if p_action = 'make_public' then v_target := 'public';
    elsif p_action = 'make_members' then v_target := 'members';
    else raise exception 'Unsupported group action.';
    end if;

    update public.community_groups set visibility=v_target, updated_at=now() where id=v_id;
    select jsonb_build_object('visibility',visibility) into v_after from public.community_groups where id=v_id;

  elsif p_entity_type = 'adventure' then
    select jsonb_build_object('status',status::text) into v_before from public.adventures where id=v_id;
    if v_before is null then raise exception 'Event not found.'; end if;

    if p_action = 'publish' then v_target := 'published';
    elsif p_action = 'unpublish' then v_target := 'draft';
    elsif p_action = 'cancel' then v_target := 'cancelled';
    else raise exception 'Unsupported event action.';
    end if;

    update public.adventures
      set status=v_target::public.adventure_status,
          published_at=case when v_target='published' then coalesce(published_at,now()) else published_at end,
          updated_at=now()
      where id=v_id;
    select jsonb_build_object('status',status::text) into v_after from public.adventures where id=v_id;

  elsif p_entity_type = 'local_event' then
    select jsonb_build_object('status',status) into v_before from public.local_events where id=v_id;
    if v_before is null then raise exception 'Local event not found.'; end if;

    if p_action = 'publish' then v_target := 'published';
    elsif p_action = 'unpublish' then v_target := 'draft';
    elsif p_action = 'cancel' then v_target := 'cancelled';
    else raise exception 'Unsupported local event action.';
    end if;

    update public.local_events set status=v_target, updated_at=now() where id=v_id;
    select jsonb_build_object('status',status) into v_after from public.local_events where id=v_id;

  else
    raise exception 'Unsupported Overwatch control entity type.';
  end if;

  insert into public.overwatch_audit_log(actor_id,action,entity_type,entity_id,reason,previous_data,new_data)
  values(auth.uid(),p_action,p_entity_type,p_entity_id,v_reason,v_before,v_after);

  return jsonb_build_object('ok',true,'entity_type',p_entity_type,'entity_id',p_entity_id,'action',p_action,'previous',v_before,'current',v_after);
end;
$$;

revoke all on function public.overwatch_control(text, text, text, text) from public;
grant execute on function public.overwatch_control(text, text, text, text) to authenticated;
