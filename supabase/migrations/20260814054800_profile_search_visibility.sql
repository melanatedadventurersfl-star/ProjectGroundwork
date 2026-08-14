alter table public.profiles
add column if not exists is_searchable boolean not null default true;

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
    and p.is_searchable = true
    and (
      nullif(trim(search_text), '') is null
      or coalesce(p.display_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.first_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.last_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(p.username, '') ilike '%' || regexp_replace(trim(search_text), '^@', '') || '%'
      or coalesce(p.home_city, '') ilike '%' || trim(search_text) || '%'
    )
  order by display_name
  limit 40;
$$;

grant execute on function public.search_community_members(text) to authenticated;
