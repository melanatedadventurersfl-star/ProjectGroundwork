alter table public.outing_hosts
  add column if not exists desired_outing_types text[] not null default '{}'::text[],
  add column if not exists home_area text,
  add column if not exists leadership_experience text,
  add column if not exists expected_group_size text,
  add column if not exists requested_paid_access boolean not null default false,
  add column if not exists certifications text,
  add column if not exists motivation text,
  add column if not exists safety_acknowledged_at timestamptz,
  add column if not exists orientation_completed_at timestamptz,
  add column if not exists orientation_version text,
  add column if not exists reviewer_notes text,
  add column if not exists review_reason text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists host_stage text not null default 'new' check (host_stage in ('new','established','trusted'));

alter table public.outing_hosts drop constraint if exists outing_hosts_status_check;
alter table public.outing_hosts
  add constraint outing_hosts_status_check
  check (status in ('pending','needs_info','approved','paused','declined','revoked'));

create or replace function public.complete_host_orientation(p_version text default '1.0')
returns public.outing_hosts
language plpgsql
security definer
set search_path = public
as $$
declare result public.outing_hosts;
begin
  update public.outing_hosts
  set orientation_completed_at = now(),
      orientation_version = coalesce(nullif(trim(p_version),''),'1.0'),
      updated_at = now()
  where profile_id = auth.uid()
  returning * into result;

  if result.profile_id is null then
    raise exception 'Host application not found';
  end if;
  return result;
end; $$;

grant execute on function public.complete_host_orientation(text) to authenticated;

create or replace function public.review_outing_host(
  p_profile_id uuid,
  p_decision text,
  p_notes text default null,
  p_reason text default null
)
returns public.outing_hosts
language plpgsql
security definer
set search_path = public
as $$
declare result public.outing_hosts;
begin
  if not public.is_platform_admin() then raise exception 'Admin access required'; end if;
  if p_decision not in ('approved','needs_info','paused','declined','revoked') then raise exception 'Invalid host decision'; end if;

  if p_decision = 'approved' and not exists (
    select 1 from public.outing_hosts
    where profile_id = p_profile_id
      and safety_acknowledged_at is not null
      and orientation_completed_at is not null
  ) then
    raise exception 'Safety acknowledgement and host orientation are required before approval';
  end if;

  update public.outing_hosts
  set status = p_decision,
      reviewer_notes = nullif(trim(p_notes),''),
      review_reason = nullif(trim(p_reason),''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      approved_by = case when p_decision='approved' then auth.uid() else approved_by end,
      approved_at = case when p_decision='approved' then now() else approved_at end,
      can_create_paid_outings = case when p_decision in ('declined','revoked') then false else can_create_paid_outings end,
      updated_at = now()
  where profile_id = p_profile_id
  returning * into result;

  if result.profile_id is null then raise exception 'Host application not found'; end if;
  return result;
end; $$;

grant execute on function public.review_outing_host(uuid,text,text,text) to authenticated;
