-- Ensure memory tagging validates the same persisted relationship and adventure
-- participation data without nested RLS on referenced tables blocking the check.

create or replace function public.can_tag_adventure_memory(
  target_memory_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.adventure_memories am
    where am.id = target_memory_id
      and am.profile_id = auth.uid()
      and exists (
        select 1
        from public.member_connections mc
        where mc.status = 'accepted'
          and (
            (mc.requester_id = auth.uid() and mc.addressee_id = target_profile_id)
            or (mc.addressee_id = auth.uid() and mc.requester_id = target_profile_id)
          )
      )
      and (
        exists (
          select 1
          from public.member_passport_stamps mps
          where mps.profile_id = target_profile_id
            and mps.adventure_id = am.adventure_id
        )
        or exists (
          select 1
          from public.orders o
          where o.purchaser_id = target_profile_id
            and o.adventure_id = am.adventure_id
            and o.status = 'paid'::public.order_status
        )
        or exists (
          select 1
          from public.order_attendees oa
          join public.orders o on o.id = oa.order_id
          where oa.profile_id = target_profile_id
            and o.adventure_id = am.adventure_id
            and o.status = 'paid'::public.order_status
        )
      )
  );
$$;

revoke all on function public.can_tag_adventure_memory(uuid, uuid) from public;
grant execute on function public.can_tag_adventure_memory(uuid, uuid) to authenticated;

drop policy if exists "Memory owners tag connected attendees" on public.adventure_memory_tags;
create policy "Memory owners tag connected attendees"
on public.adventure_memory_tags
for insert to authenticated
with check (
  public.can_tag_adventure_memory(memory_id, tagged_profile_id)
);
