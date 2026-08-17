alter table public.profiles
  add column if not exists is_searchable boolean not null default true;

alter table public.profile_directory
  add column if not exists is_searchable boolean not null default true;

update public.profile_directory d
set is_searchable = p.is_searchable
from public.profiles p
where p.id = d.id;

create or replace function app_private.sync_profile_directory()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  insert into public.profile_directory (
    id, display_name, username, avatar_url, home_city, home_state,
    profile_is_private, platform_role, event_host_level, interests,
    pronouns, status, created_at, is_searchable
  ) values (
    new.id,
    coalesce(nullif(trim(new.display_name), ''), nullif(trim(concat_ws(' ', new.first_name, new.last_name)), ''), 'Member'),
    new.username,
    new.avatar_url,
    case when new.city_visible then new.home_city else null end,
    case when new.city_visible then new.home_state else null end,
    new.profile_is_private,
    new.platform_role,
    new.event_host_level,
    case when new.interests_visible then new.interests else null end,
    case when new.pronouns_visible then new.pronouns else null end,
    new.status,
    new.created_at,
    new.is_searchable
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    home_city = excluded.home_city,
    home_state = excluded.home_state,
    profile_is_private = excluded.profile_is_private,
    platform_role = excluded.platform_role,
    event_host_level = excluded.event_host_level,
    interests = excluded.interests,
    pronouns = excluded.pronouns,
    status = excluded.status,
    created_at = excluded.created_at,
    is_searchable = excluded.is_searchable;
  return new;
end;
$$;

revoke execute on function app_private.sync_profile_directory() from public, anon, authenticated;

create or replace function public.search_community_members(search_text text default '')
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  home_city text,
  home_state text,
  connection_id uuid,
  connection_status text,
  connection_direction text
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.home_city,
    p.home_state,
    mc.id,
    mc.status::text,
    case
      when mc.requester_id = auth.uid() then 'outgoing'
      when mc.addressee_id = auth.uid() then 'incoming'
      else null
    end
  from public.profile_directory p
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
      or coalesce(p.username, '') ilike '%' || regexp_replace(trim(search_text), '^@', '') || '%'
      or coalesce(p.home_city, '') ilike '%' || trim(search_text) || '%'
    )
  order by p.display_name
  limit 40;
$$;

grant execute on function public.search_community_members(text) to authenticated;
