insert into public.badges (code,title,description,icon_name,category)
values
  ('first-post','First Post','Published your first community post.','chatbubble','community'),
  ('campfire-contributor','Campfire Contributor','Made five published community contributions across posts and comments.','campfire','community')
on conflict (code) do update set
  title=excluded.title,
  description=excluded.description,
  icon_name=excluded.icon_name,
  category=excluded.category;

create or replace function public.refresh_community_contribution_badges(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post_count integer := 0;
  comment_count integer := 0;
  contribution_count integer := 0;
begin
  select count(*)::integer into post_count
  from public.community_posts
  where author_id = target_profile and status::text = 'published';

  select count(*)::integer into comment_count
  from public.community_comments
  where author_id = target_profile and status::text = 'published';

  contribution_count := post_count + comment_count;

  insert into public.member_badges (profile_id,badge_id,evidence)
  select target_profile,b.id,jsonb_build_object('source','community_activity','published_posts',post_count,'published_comments',comment_count,'contributions',contribution_count)
  from public.badges b
  where (b.code='first-post' and post_count >= 1)
     or (b.code='campfire-contributor' and contribution_count >= 5)
  on conflict (profile_id,badge_id) do nothing;
end;
$$;

create or replace function public.on_community_contribution_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_community_contribution_badges(coalesce(new.author_id, old.author_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists community_post_badges on public.community_posts;
create trigger community_post_badges
after insert or update of status on public.community_posts
for each row execute function public.on_community_contribution_badges();

drop trigger if exists community_comment_badges on public.community_comments;
create trigger community_comment_badges
after insert or update of status on public.community_comments
for each row execute function public.on_community_contribution_badges();

do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_community_contribution_badges(r.id);
  end loop;
end $$;
