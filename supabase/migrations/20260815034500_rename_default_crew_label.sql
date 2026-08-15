update public.community_circles
set name = 'My Crew',
    updated_at = now()
where lower(trim(name)) = 'my circle';
