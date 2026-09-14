drop policy if exists "Hosts manage outing messages" on public.host_outing_messages;
drop policy if exists "Host staff read outing messages" on public.host_outing_messages;
drop policy if exists "Host staff send outing messages" on public.host_outing_messages;
drop policy if exists "Members read outing messages" on public.host_outing_messages;

create policy "Host staff read outing messages"
on public.host_outing_messages
for select
to authenticated
using (
  host_id = (select auth.uid())
  or public.is_adventure_staff(adventure_id)
  or exists (
    select 1 from public.adventures a
    where a.id = host_outing_messages.adventure_id
      and a.created_by = (select auth.uid())
  )
);

create policy "Host staff send outing messages"
on public.host_outing_messages
for insert
to authenticated
with check (
  host_id = (select auth.uid())
  and (
    public.is_adventure_staff(adventure_id)
    or exists (
      select 1 from public.adventures a
      where a.id = host_outing_messages.adventure_id
        and a.created_by = (select auth.uid())
    )
  )
);

create policy "Members read outing messages"
on public.host_outing_messages
for select
to authenticated
using (
  (
    audience = 'registered'
    and exists (
      select 1 from public.orders o
      where o.adventure_id = host_outing_messages.adventure_id
        and o.purchaser_id = (select auth.uid())
        and o.status = 'paid'
    )
  )
  or (
    audience = 'checked_in'
    and exists (
      select 1
      from public.orders o
      join public.order_attendees oa on oa.order_id = o.id
      join public.adventure_check_ins ci on ci.attendee_id = oa.id
        and ci.adventure_id = o.adventure_id
      where o.adventure_id = host_outing_messages.adventure_id
        and o.purchaser_id = (select auth.uid())
        and o.status = 'paid'
    )
  )
  or (
    audience = 'waitlist'
    and exists (
      select 1 from public.adventure_waitlist w
      where w.adventure_id = host_outing_messages.adventure_id
        and w.profile_id = (select auth.uid())
        and w.status in ('waiting', 'offered')
    )
  )
);

grant select, insert on table public.host_outing_messages to authenticated;
