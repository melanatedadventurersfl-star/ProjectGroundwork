drop policy if exists "Members read outing messages" on public.host_outing_messages;

create policy "Members read outing messages"
on public.host_outing_messages
for select
to authenticated
using (
  (
    audience = 'registered'
    and public.is_paid_adventure_attendee(adventure_id, (select auth.uid()))
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
        and o.status = 'paid'
        and (
          o.purchaser_id = (select auth.uid())
          or oa.profile_id = (select auth.uid())
        )
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
