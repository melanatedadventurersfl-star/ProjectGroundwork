create type public.connection_status as enum ('pending', 'accepted', 'declined');

create table public.member_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index member_connections_unique_pair
on public.member_connections (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create table public.community_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_circle_members (
  circle_id uuid not null references public.community_circles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, profile_id)
);

create trigger member_connections_set_updated_at
before update on public.member_connections
for each row execute function public.set_updated_at();

create trigger community_circles_set_updated_at
before update on public.community_circles
for each row execute function public.set_updated_at();

alter table public.member_connections enable row level security;
alter table public.community_circles enable row level security;
alter table public.community_circle_members enable row level security;

create policy "Connection participants can read connections"
on public.member_connections for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Members can request connections"
on public.member_connections for insert
with check (auth.uid() = requester_id);

create policy "Connection participants can remove connections"
on public.member_connections for delete
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Circle owners manage circles"
on public.community_circles for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Circle owners read members"
on public.community_circle_members for select
using (
  exists (
    select 1 from public.community_circles c
    where c.id = circle_id and c.owner_id = auth.uid()
  )
);

create policy "Circle owners add connected members"
on public.community_circle_members for insert
with check (
  exists (
    select 1 from public.community_circles c
    where c.id = circle_id and c.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.member_connections mc
    where mc.status = 'accepted'
      and (
        (mc.requester_id = auth.uid() and mc.addressee_id = profile_id)
        or (mc.addressee_id = auth.uid() and mc.requester_id = profile_id)
      )
  )
);

create policy "Circle owners remove members"
on public.community_circle_members for delete
using (
  exists (
    select 1 from public.community_circles c
    where c.id = circle_id and c.owner_id = auth.uid()
  )
);

create or replace function public.respond_to_connection_request(connection_id uuid, response public.connection_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if response not in ('accepted', 'declined') then
    raise exception 'Response must be accepted or declined';
  end if;

  update public.member_connections
  set status = response
  where id = connection_id
    and addressee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Connection request not found';
  end if;
end;
$$;

grant execute on function public.respond_to_connection_request(uuid, public.connection_status) to authenticated;

create or replace function public.search_community_members(search_text text default '')
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  connection_id uuid,
  connection_status public.connection_status,
  connection_direction text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Member') as display_name,
    p.avatar_url,
    p.home_city,
    p.home_state,
    mc.id as connection_id,
    mc.status as connection_status,
    case
      when mc.requester_id = auth.uid() then 'outgoing'
      when mc.addressee_id = auth.uid() then 'incoming'
      else null
    end as connection_direction
  from public.profiles p
  left join public.member_connections mc
    on (mc.requester_id = auth.uid() and mc.addressee_id = p.id)
    or (mc.addressee_id = auth.uid() and mc.requester_id = p.id)
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.status <> 'suspended'
    and (
      nullif(trim(search_text), '') is null
      or coalesce(p.display_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.first_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.last_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.home_city, '') ilike '%' || trim(search_text) || '%'
    )
  order by display_name
  limit 40;
$$;

grant execute on function public.search_community_members(text) to authenticated;

create or replace function public.get_my_connections()
returns table (
  connection_id uuid,
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  status public.connection_status,
  direction text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.id,
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Member'),
    p.avatar_url,
    p.home_city,
    p.home_state,
    mc.status,
    case when mc.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    mc.created_at
  from public.member_connections mc
  join public.profiles p
    on p.id = case when mc.requester_id = auth.uid() then mc.addressee_id else mc.requester_id end
  where auth.uid() is not null
    and (mc.requester_id = auth.uid() or mc.addressee_id = auth.uid())
  order by mc.created_at desc;
$$;

grant execute on function public.get_my_connections() to authenticated;

create or replace function public.get_my_circles()
returns table (
  id uuid,
  name text,
  member_count integer,
  member_names text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    count(cm.profile_id)::int,
    coalesce(
      array_agg(coalesce(nullif(trim(p.display_name), ''), p.first_name, 'Member') order by cm.added_at) filter (where p.id is not null),
      '{}'::text[]
    )
  from public.community_circles c
  left join public.community_circle_members cm on cm.circle_id = c.id
  left join public.profiles p on p.id = cm.profile_id
  where c.owner_id = auth.uid()
  group by c.id, c.name, c.created_at
  order by c.created_at desc;
$$;

grant execute on function public.get_my_circles() to authenticated;

create or replace function public.get_circle_members(target_circle_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  added_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Member'),
    p.avatar_url,
    p.home_city,
    p.home_state,
    cm.added_at
  from public.community_circle_members cm
  join public.community_circles c on c.id = cm.circle_id
  join public.profiles p on p.id = cm.profile_id
  where cm.circle_id = target_circle_id
    and c.owner_id = auth.uid()
  order by cm.added_at;
$$;

grant execute on function public.get_circle_members(uuid) to authenticated;