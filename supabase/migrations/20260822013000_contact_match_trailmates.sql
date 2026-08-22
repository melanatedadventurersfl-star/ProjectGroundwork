create or replace function public.match_contacts_by_phone(p_phone_numbers text[])
returns table (
  id uuid,
  display_name text,
  username text,
  home_city text,
  home_state text,
  avatar_url text,
  interests text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.id,
    d.display_name,
    d.username,
    d.home_city,
    d.home_state,
    d.avatar_url,
    d.interests
  from public.profiles p
  join public.community_profile_directory d on d.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.phone_number is not null
    and p.phone_number = any(coalesce(p_phone_numbers, '{}'::text[]))
  order by d.display_name nulls last, d.username nulls last
  limit 25;
$$;

revoke all on function public.match_contacts_by_phone(text[]) from public, anon;
grant execute on function public.match_contacts_by_phone(text[]) to authenticated;

comment on function public.match_contacts_by_phone(text[]) is
  'Returns public profile fields only for authenticated users whose normalized phone numbers match an explicitly supplied contact list. Contact values are not persisted.';
