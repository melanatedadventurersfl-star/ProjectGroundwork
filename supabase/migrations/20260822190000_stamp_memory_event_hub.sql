-- Stamp detail v2: multiple memories, tagged connections, event-gallery publishing,
-- and durable relationship state for attendee connection actions.

create table if not exists public.adventure_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  title text,
  body text,
  rating integer check (rating is null or rating between 1 and 5),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adventure_memories_owner_adventure_idx
  on public.adventure_memories (profile_id, adventure_id, created_at desc);
create index if not exists adventure_memories_public_adventure_idx
  on public.adventure_memories (adventure_id, created_at desc)
  where visibility = 'public';

create table if not exists public.adventure_memory_tags (
  memory_id uuid not null references public.adventure_memories(id) on delete cascade,
  tagged_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (memory_id, tagged_profile_id)
);

alter table public.adventure_memory_photos
  add column if not exists memory_id uuid references public.adventure_memories(id) on delete cascade;

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_source_kind_check;
alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_source_kind_check
  check (source_kind in ('personal', 'event_gallery', 'event_upload'));

create index if not exists adventure_memory_photos_memory_idx
  on public.adventure_memory_photos (memory_id, created_at);
create index if not exists adventure_event_gallery_idx
  on public.adventure_memory_photos (adventure_id, created_at desc)
  where source_kind = 'event_upload' and visibility = 'public';

-- Preserve existing single-reflection data as the first journal entry. The old table
-- remains in place for backwards compatibility with older builds.
insert into public.adventure_memories (profile_id, adventure_id, title, body, rating, visibility, created_at, updated_at)
select
  ar.profile_id,
  ar.adventure_id,
  nullif(trim(ar.highlight), ''),
  nullif(trim(ar.reflection), ''),
  ar.rating,
  case when ar.visibility = 'community' then 'public' else 'private' end,
  ar.created_at,
  ar.updated_at
from public.adventure_reflections ar
where (ar.rating is not null or nullif(trim(ar.highlight), '') is not null or nullif(trim(ar.reflection), '') is not null)
  and not exists (
    select 1 from public.adventure_memories am
    where am.profile_id = ar.profile_id and am.adventure_id = ar.adventure_id
  );

alter table public.adventure_memories enable row level security;
alter table public.adventure_memory_tags enable row level security;

drop trigger if exists adventure_memories_set_updated_at on public.adventure_memories;
create trigger adventure_memories_set_updated_at
before update on public.adventure_memories
for each row execute function public.set_updated_at();

drop policy if exists "Members read permitted adventure memories" on public.adventure_memories;
create policy "Members read permitted adventure memories"
on public.adventure_memories for select to authenticated
using (profile_id = auth.uid() or visibility = 'public');

drop policy if exists "Members create their adventure memories" on public.adventure_memories;
create policy "Members create their adventure memories"
on public.adventure_memories for insert to authenticated
with check (profile_id = auth.uid());

drop policy if exists "Members update their adventure memories" on public.adventure_memories;
create policy "Members update their adventure memories"
on public.adventure_memories for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "Members delete their adventure memories" on public.adventure_memories;
create policy "Members delete their adventure memories"
on public.adventure_memories for delete to authenticated
using (profile_id = auth.uid());

drop policy if exists "Members read visible memory tags" on public.adventure_memory_tags;
create policy "Members read visible memory tags"
on public.adventure_memory_tags for select to authenticated
using (
  exists (
    select 1 from public.adventure_memories am
    where am.id = memory_id
      and (am.profile_id = auth.uid() or am.visibility = 'public')
  )
);

drop policy if exists "Memory owners tag connected attendees" on public.adventure_memory_tags;
create policy "Memory owners tag connected attendees"
on public.adventure_memory_tags for insert to authenticated
with check (
  exists (
    select 1
    from public.adventure_memories am
    where am.id = memory_id
      and am.profile_id = auth.uid()
      and exists (
        select 1 from public.member_connections mc
        where mc.status = 'accepted'
          and (
            (mc.requester_id = auth.uid() and mc.addressee_id = tagged_profile_id)
            or (mc.addressee_id = auth.uid() and mc.requester_id = tagged_profile_id)
          )
      )
      and exists (
        select 1
        from public.member_passport_stamps mps
        where mps.profile_id = tagged_profile_id
          and mps.adventure_id = am.adventure_id
        union all
        select 1
        from public.orders o
        where o.purchaser_id = tagged_profile_id
          and o.adventure_id = am.adventure_id
          and o.status = 'paid'::public.order_status
        union all
        select 1
        from public.order_attendees oa
        join public.orders o on o.id = oa.order_id
        where oa.profile_id = tagged_profile_id
          and o.adventure_id = am.adventure_id
          and o.status = 'paid'::public.order_status
      )
  )
);

drop policy if exists "Memory owners remove tags" on public.adventure_memory_tags;
create policy "Memory owners remove tags"
on public.adventure_memory_tags for delete to authenticated
using (
  exists (
    select 1 from public.adventure_memories am
    where am.id = memory_id and am.profile_id = auth.uid()
  )
);

grant select, insert, update, delete on public.adventure_memories to authenticated;
grant select, insert, delete on public.adventure_memory_tags to authenticated;

-- PostgreSQL requires dropping a table-returning function before changing its output columns.
drop function if exists public.get_adventure_event_people(uuid);

-- Older builds can keep using is_connected. New builds also get a durable direction-aware state.
create function public.get_adventure_event_people(target_adventure_id uuid)
returns table(
  profile_id uuid,
  display_name text,
  username text,
  avatar_url text,
  is_connected boolean,
  relationship_state text
)
language sql
security definer
set search_path = public, auth
as $$
  with caller as (
    select auth.uid() as id
  ),
  can_view as (
    select (
      app_private.is_master_account()
      or exists (
        select 1 from member_passport_stamps mps, caller c
        where mps.profile_id = c.id and mps.adventure_id = target_adventure_id
      )
      or exists (
        select 1 from orders o, caller c
        where o.purchaser_id = c.id and o.adventure_id = target_adventure_id and o.status = 'paid'::order_status
      )
      or exists (
        select 1 from order_attendees oa
        join orders o on o.id = oa.order_id
        join caller c on c.id = oa.profile_id
        where o.adventure_id = target_adventure_id and o.status = 'paid'::order_status
      )
    ) as ok
  ),
  attendee_ids as (
    select o.purchaser_id as profile_id from orders o
    where o.adventure_id = target_adventure_id and o.status = 'paid'::order_status
    union
    select oa.profile_id from order_attendees oa join orders o on o.id = oa.order_id
    where o.adventure_id = target_adventure_id and o.status = 'paid'::order_status and oa.profile_id is not null
    union
    select mps.profile_id from member_passport_stamps mps where mps.adventure_id = target_adventure_id
  )
  select distinct
    pd.id as profile_id,
    pd.display_name,
    pd.username,
    pd.avatar_url,
    (mc.status = 'accepted') as is_connected,
    case
      when mc.status = 'accepted' then 'connected'
      when mc.status = 'pending' and mc.requester_id = c.id then 'outgoing_pending'
      when mc.status = 'pending' and mc.addressee_id = c.id then 'incoming_pending'
      else 'none'
    end as relationship_state
  from attendee_ids ai
  join profile_directory pd on pd.id = ai.profile_id
  cross join can_view cv
  cross join caller c
  left join member_connections mc
    on (mc.requester_id = c.id and mc.addressee_id = pd.id)
    or (mc.addressee_id = c.id and mc.requester_id = pd.id)
  where cv.ok
    and pd.id <> c.id
    and pd.status = 'active'::member_status
    and (pd.is_searchable or mc.status = 'accepted' or mc.status = 'pending')
  order by is_connected desc, display_name nulls last, username nulls last;
$$;

revoke all on function public.get_adventure_event_people(uuid) from public;
grant execute on function public.get_adventure_event_people(uuid) to authenticated;

-- One canonical connection action. An incoming request is accepted, an outgoing request
-- remains requested, an accepted relationship remains connected, and a missing pair creates a request.
create or replace function public.connect_or_accept_member(target_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid := auth.uid();
  existing public.member_connections%rowtype;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if caller_id = target_profile_id then return 'connected'; end if;

  select * into existing
  from public.member_connections
  where (requester_id = caller_id and addressee_id = target_profile_id)
     or (requester_id = target_profile_id and addressee_id = caller_id)
  limit 1;

  if found then
    if existing.status = 'accepted' then return 'connected'; end if;
    if existing.status = 'pending' and existing.requester_id = caller_id then return 'outgoing_pending'; end if;
    if existing.status = 'pending' and existing.addressee_id = caller_id then
      update public.member_connections set status = 'accepted' where id = existing.id;
      return 'connected';
    end if;
    update public.member_connections
      set requester_id = caller_id, addressee_id = target_profile_id, status = 'pending'
      where id = existing.id;
    return 'outgoing_pending';
  end if;

  insert into public.member_connections (requester_id, addressee_id, status)
  values (caller_id, target_profile_id, 'pending');
  return 'outgoing_pending';
end;
$$;

revoke all on function public.connect_or_accept_member(uuid) from public;
grant execute on function public.connect_or_accept_member(uuid) to authenticated;
