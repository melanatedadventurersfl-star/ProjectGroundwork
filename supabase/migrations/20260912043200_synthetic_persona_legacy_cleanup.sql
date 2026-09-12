-- Explicit tester accounts are being reused as fictional pilot personas.
-- Do not attribute their older tester-authored content or uploaded community media to the new persona names.

with renamed_testers as (
  select id
  from public.profiles
  where lower(email) in (
    'melanatedadventurersfl+trailtester01@gmail.com',
    'melanatedadventurersfl+trailtester02@gmail.com',
    'melanatedadventurersfl+hosttester01@gmail.com'
  )
)
update public.community_posts cp
set status = 'hidden', updated_at = now()
where cp.author_id in (select id from renamed_testers)
  and coalesce((cp.metadata ->> 'synthetic_legacy')::boolean, false) = true;

with renamed_testers as (
  select id
  from public.profiles
  where lower(email) in (
    'melanatedadventurersfl+trailtester01@gmail.com',
    'melanatedadventurersfl+trailtester02@gmail.com',
    'melanatedadventurersfl+hosttester01@gmail.com'
  )
)
update public.community_comments c
set status = 'hidden', updated_at = now()
where c.author_id in (select id from renamed_testers)
  and not exists (
    select 1
    from public.community_posts cp
    where cp.id = c.post_id
      and coalesce((cp.metadata ->> 'synthetic_activity')::boolean, false) = true
      and coalesce((cp.metadata ->> 'synthetic_legacy')::boolean, false) = false
  );

with renamed_testers as (
  select id
  from public.profiles
  where lower(email) in (
    'melanatedadventurersfl+trailtester01@gmail.com',
    'melanatedadventurersfl+trailtester02@gmail.com',
    'melanatedadventurersfl+hosttester01@gmail.com'
  )
)
delete from public.community_reactions r
where r.profile_id in (select id from renamed_testers)
  and exists (
    select 1
    from public.community_posts cp
    where cp.id = r.post_id
      and coalesce((cp.metadata ->> 'synthetic_legacy')::boolean, false) = true
  );
