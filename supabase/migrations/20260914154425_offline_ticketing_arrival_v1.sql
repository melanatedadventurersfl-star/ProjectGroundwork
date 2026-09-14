create table if not exists public.adventure_arrival_scans (
  id uuid primary key,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  attendee_id uuid not null references public.order_attendees(id) on delete cascade,
  scanned_by uuid not null references public.profiles(id) on delete restrict,
  device_id text not null,
  scan_method text not null check (scan_method in ('qr','manual')),
  scanned_at timestamptz not null,
  credential_fingerprint text,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','valid','duplicate')),
  created_at timestamptz not null default now()
);

create index if not exists adventure_arrival_scans_event_attendee_idx
  on public.adventure_arrival_scans (adventure_id, attendee_id, scanned_at);
create index if not exists adventure_arrival_scans_event_status_idx
  on public.adventure_arrival_scans (adventure_id, reconciliation_status, scanned_at desc);

alter table public.adventure_arrival_scans enable row level security;

revoke all on public.adventure_arrival_scans from anon;
revoke insert, update, delete, truncate, references, trigger on public.adventure_arrival_scans from authenticated;
grant select on public.adventure_arrival_scans to authenticated;

drop policy if exists "Adventure hosts and staff read arrival scans" on public.adventure_arrival_scans;
create policy "Adventure hosts and staff read arrival scans"
on public.adventure_arrival_scans for select
to authenticated
using (
  public.is_adventure_staff(adventure_id)
  or exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
  or app_private.is_master_account()
);

create or replace function public.sync_adventure_arrival_scan(
  p_scan_id uuid,
  p_adventure_id uuid,
  p_attendee_id uuid,
  p_device_id text,
  p_scanned_at timestamptz,
  p_scan_method text,
  p_credential_code text default null
)
returns table (
  scan_status text,
  canonical_checked_in_at timestamptz,
  duplicate_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing public.adventure_arrival_scans;
  v_checked_in_at timestamptz;
  v_status text;
  v_duplicate_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if p_scan_method not in ('qr','manual') then
    raise exception 'Invalid arrival scan method';
  end if;

  if not (
    public.is_adventure_staff(p_adventure_id)
    or exists (
      select 1 from public.adventures a
      where a.id = p_adventure_id and a.created_by = auth.uid()
    )
    or app_private.is_master_account()
  ) then
    raise exception 'Host or event staff access required';
  end if;

  if not exists (
    select 1
    from public.order_attendees oa
    join public.orders o on o.id = oa.order_id
    where oa.id = p_attendee_id
      and o.adventure_id = p_adventure_id
      and o.status = 'paid'::public.order_status
  ) then
    raise exception 'Attendee is not valid for this event';
  end if;

  if p_scan_method = 'qr' and not exists (
    select 1
    from public.ticket_credentials tc
    join public.orders o on o.id = tc.order_id
    where tc.attendee_id = p_attendee_id
      and tc.credential_code = p_credential_code
      and o.adventure_id = p_adventure_id
      and o.status = 'paid'::public.order_status
  ) then
    raise exception 'Credential does not match this attendee and event';
  end if;

  select * into v_existing
  from public.adventure_arrival_scans s
  where s.id = p_scan_id;

  if v_existing.id is not null and v_existing.reconciliation_status <> 'pending' then
    select ac.checked_in_at into v_checked_in_at
    from public.adventure_check_ins ac
    where ac.adventure_id = p_adventure_id and ac.attendee_id = p_attendee_id;

    select greatest(count(*) - 1, 0)::integer into v_duplicate_count
    from public.adventure_arrival_scans s
    where s.adventure_id = p_adventure_id
      and s.attendee_id = p_attendee_id
      and s.reconciliation_status in ('valid','duplicate');

    return query select v_existing.reconciliation_status, v_checked_in_at, v_duplicate_count;
    return;
  end if;

  insert into public.adventure_arrival_scans (
    id, adventure_id, attendee_id, scanned_by, device_id, scan_method, scanned_at,
    credential_fingerprint, reconciliation_status
  ) values (
    p_scan_id, p_adventure_id, p_attendee_id, auth.uid(), p_device_id, p_scan_method, p_scanned_at,
    case when p_credential_code is null then null else encode(extensions.digest(p_credential_code, 'sha256'), 'hex') end,
    'pending'
  )
  on conflict (id) do nothing;

  insert into public.adventure_check_ins (
    adventure_id, attendee_id, checked_in_by, checked_in_at, method, credential_code, device_id, offline_recorded_at, notes
  ) values (
    p_adventure_id,
    p_attendee_id,
    auth.uid(),
    p_scanned_at,
    case when p_scan_method = 'qr' then 'qr'::public.check_in_method else 'manual'::public.check_in_method end,
    p_credential_code,
    p_device_id,
    p_scanned_at,
    'Arrival Mode'
  )
  on conflict (adventure_id, attendee_id) do nothing
  returning checked_in_at into v_checked_in_at;

  if v_checked_in_at is null then
    select ac.checked_in_at into v_checked_in_at
    from public.adventure_check_ins ac
    where ac.adventure_id = p_adventure_id and ac.attendee_id = p_attendee_id;
    v_status := 'duplicate';
  else
    v_status := 'valid';
  end if;

  update public.ticket_credentials tc
  set checked_in_at = coalesce(tc.checked_in_at, v_checked_in_at)
  where tc.attendee_id = p_attendee_id;

  update public.adventure_arrival_scans
  set reconciliation_status = v_status
  where id = p_scan_id;

  select greatest(count(*) - 1, 0)::integer into v_duplicate_count
  from public.adventure_arrival_scans s
  where s.adventure_id = p_adventure_id
    and s.attendee_id = p_attendee_id
    and s.reconciliation_status in ('valid','duplicate');

  return query select v_status, v_checked_in_at, v_duplicate_count;
end;
$$;

revoke all on function public.sync_adventure_arrival_scan(uuid,uuid,uuid,text,timestamptz,text,text) from public, anon;
grant execute on function public.sync_adventure_arrival_scan(uuid,uuid,uuid,text,timestamptz,text,text) to authenticated, service_role;
