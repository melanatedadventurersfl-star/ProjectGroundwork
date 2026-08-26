create table if not exists public.outing_hosts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','paused','revoked')),
  host_type text not null default 'community' check (host_type in ('community','organization','official')),
  risk_tier text not null default 'standard' check (risk_tier in ('standard','enhanced')),
  can_create_paid_outings boolean not null default false,
  payout_status text not null default 'not_started' check (payout_status in ('not_started','pending','verified','restricted')),
  application_note text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger outing_hosts_set_updated_at
before update on public.outing_hosts
for each row execute function public.set_updated_at();

alter table public.outing_hosts enable row level security;

create policy "Members read their outing host record"
on public.outing_hosts for select
using (profile_id = auth.uid() or public.is_platform_admin());

create policy "Members apply to host"
on public.outing_hosts for insert
with check (
  profile_id = auth.uid()
  and status = 'pending'
  and host_type = 'community'
  and can_create_paid_outings = false
  and payout_status = 'not_started'
);

create policy "Admins manage outing hosts"
on public.outing_hosts for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.is_approved_outing_host(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.outing_hosts oh
      where oh.profile_id = p_profile_id
        and oh.status = 'approved'
    );
$$;

grant execute on function public.is_approved_outing_host(uuid) to authenticated;

create or replace function public.can_host_paid_outings(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.outing_hosts oh
      where oh.profile_id = p_profile_id
        and oh.status = 'approved'
        and oh.can_create_paid_outings = true
        and oh.payout_status in ('pending','verified')
    );
$$;

grant execute on function public.can_host_paid_outings(uuid) to authenticated;

drop policy if exists "Hosts may manage adventures" on public.adventures;

create policy "Approved hosts read their own adventures"
on public.adventures for select
using (
  created_by = auth.uid()
  and public.is_approved_outing_host(auth.uid())
);

create policy "Approved hosts create adventures"
on public.adventures for insert
with check (
  created_by = auth.uid()
  and public.is_approved_outing_host(auth.uid())
  and is_featured = false
);

create policy "Approved hosts update their own adventures"
on public.adventures for update
using (
  created_by = auth.uid()
  and public.is_approved_outing_host(auth.uid())
)
with check (
  created_by = auth.uid()
  and public.is_approved_outing_host(auth.uid())
  and is_featured = false
);

create policy "Approved hosts delete draft adventures"
on public.adventures for delete
using (
  created_by = auth.uid()
  and status in ('draft','scheduled')
  and public.is_approved_outing_host(auth.uid())
);

create policy "Approved hosts manage ticket types"
on public.ticket_types for all
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
)
with check (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
      and (price_cents = 0 or public.can_host_paid_outings(auth.uid()))
  )
);

create policy "Approved hosts manage addons"
on public.adventure_addons for all
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
)
with check (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
      and (price_cents = 0 or public.can_host_paid_outings(auth.uid()))
  )
);

create policy "Approved hosts manage waivers"
on public.waivers for all
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
)
with check (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
);

create policy "Hosts read orders for their outings"
on public.orders for select
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
);

create policy "Hosts read order attendees for their outings"
on public.order_attendees for select
using (
  exists (
    select 1
    from public.orders o
    join public.adventures a on a.id = o.adventure_id
    where o.id = order_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
);

create policy "Hosts read credentials for their outings"
on public.ticket_credentials for select
using (
  exists (
    select 1
    from public.orders o
    join public.adventures a on a.id = o.adventure_id
    where o.id = order_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
);

create policy "Hosts check in credentials for their outings"
on public.ticket_credentials for update
using (
  exists (
    select 1
    from public.orders o
    join public.adventures a on a.id = o.adventure_id
    where o.id = order_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.orders o
    join public.adventures a on a.id = o.adventure_id
    where o.id = order_id
      and a.created_by = auth.uid()
      and public.is_approved_outing_host(auth.uid())
  )
);

create or replace function public.publish_host_outing(p_adventure_id uuid)
returns public.adventures
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.adventures;
  has_ticket boolean;
  has_paid_ticket boolean;
begin
  if not public.is_approved_outing_host(auth.uid()) then
    raise exception 'Approved host access required';
  end if;

  if not exists (
    select 1 from public.adventures
    where id = p_adventure_id and created_by = auth.uid()
  ) then
    raise exception 'Outing not found';
  end if;

  select exists(select 1 from public.ticket_types where adventure_id = p_adventure_id and is_active),
         exists(select 1 from public.ticket_types where adventure_id = p_adventure_id and is_active and price_cents > 0)
  into has_ticket, has_paid_ticket;

  if not has_ticket then
    raise exception 'Add at least one ticket type before publishing';
  end if;

  if has_paid_ticket and not public.can_host_paid_outings(auth.uid()) then
    raise exception 'Paid outing approval is required before publishing paid tickets';
  end if;

  update public.adventures
  set status = 'published',
      published_at = coalesce(published_at, now()),
      spots_remaining = coalesce(spots_remaining, capacity)
  where id = p_adventure_id
  returning * into result;

  return result;
end;
$$;

grant execute on function public.publish_host_outing(uuid) to authenticated;

create or replace function public.host_check_in_credential(p_credential_code text)
returns public.ticket_credentials
language plpgsql
security definer
set search_path = public
as $$
declare result public.ticket_credentials;
begin
  update public.ticket_credentials tc
  set checked_in_at = coalesce(tc.checked_in_at, now())
  where tc.credential_code = p_credential_code
    and exists (
      select 1
      from public.orders o
      join public.adventures a on a.id = o.adventure_id
      where o.id = tc.order_id
        and a.created_by = auth.uid()
        and public.is_approved_outing_host(auth.uid())
    )
  returning * into result;

  if result.id is null then
    raise exception 'Credential not found for one of your outings';
  end if;

  return result;
end;
$$;

grant execute on function public.host_check_in_credential(text) to authenticated;
