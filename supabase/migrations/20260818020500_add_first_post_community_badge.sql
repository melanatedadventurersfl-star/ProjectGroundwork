insert into public.badges (code, title, description, icon_name, category)
values ('first-post', 'First Post', 'Published your first community post.', 'message-circle', 'community')
on conflict (code) do update
set title = excluded.title,
    description = excluded.description,
    icon_name = excluded.icon_name,
    category = excluded.category;

create or replace function public.award_first_post_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'published' then
    insert into public.member_badges (profile_id, badge_id, earned_at, evidence)
    select new.author_id,
           b.id,
           coalesce(new.created_at, now()),
           jsonb_build_object('source', 'first_published_post', 'post_id', new.id)
    from public.badges b
    where b.code = 'first-post'
    on conflict (profile_id, badge_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists community_first_post_badge on public.community_posts;
create trigger community_first_post_badge
after insert or update of status on public.community_posts
for each row
execute function public.award_first_post_badge();

insert into public.member_badges (profile_id, badge_id, earned_at, evidence)
select p.author_id,
       b.id,
       min(p.created_at),
       jsonb_build_object('source', 'first_published_post_backfill')
from public.community_posts p
join public.badges b on b.code = 'first-post'
where p.status::text = 'published'
group by p.author_id, b.id
on conflict (profile_id, badge_id) do nothing;
