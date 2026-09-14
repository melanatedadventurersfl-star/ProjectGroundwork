drop policy if exists "Host staff update outing messages" on public.host_outing_messages;

create policy "Host staff update outing messages"
on public.host_outing_messages
for update
to authenticated
using (
  host_id = (select auth.uid())
  and (
    public.is_adventure_staff(adventure_id)
    or exists (
      select 1 from public.adventures a
      where a.id = host_outing_messages.adventure_id
        and a.created_by = (select auth.uid())
    )
  )
)
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

grant update on table public.host_outing_messages to authenticated;
