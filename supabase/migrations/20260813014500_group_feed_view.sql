create or replace view public.community_feed as
select
  p.id,
  p.group_id,
  p.adventure_id,
  p.author_id,
  coalesce(pr.display_name, pr.first_name, 'Member') as author_name,
  pr.avatar_url,
  p.body,
  p.image_url,
  p.is_pinned,
  p.created_at,
  count(distinct r.profile_id)::int as reaction_count,
  count(distinct c.id)::int as comment_count
from public.community_posts p
join public.profiles pr on pr.id = p.author_id
left join public.community_reactions r on r.post_id = p.id
left join public.community_comments c on c.post_id = p.id and c.status = 'published'
where p.status = 'published'
  and (
    p.group_id is null
    or exists (
      select 1 from public.community_groups g
      where g.id = p.group_id
        and (g.visibility = 'public' or public.is_group_member(g.id))
    )
  )
group by p.id, pr.display_name, pr.first_name, pr.avatar_url;

grant select on public.community_feed to authenticated;
