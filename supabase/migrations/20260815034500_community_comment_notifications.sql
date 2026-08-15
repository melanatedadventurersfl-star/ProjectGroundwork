create schema if not exists private;

create or replace function private.notify_community_post_author_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author_id uuid;
  post_adventure_id uuid;
  commenter_name text;
  comment_preview text;
begin
  if new.status <> 'published' then
    return new;
  end if;

  select p.author_id, p.adventure_id
  into post_author_id, post_adventure_id
  from public.community_posts p
  where p.id = new.post_id;

  if post_author_id is null or post_author_id = new.author_id then
    return new;
  end if;

  select coalesce(
    nullif(trim(pr.display_name), ''),
    nullif(trim(pr.username), ''),
    nullif(trim(pr.first_name), ''),
    'A member'
  )
  into commenter_name
  from public.profiles pr
  where pr.id = new.author_id;

  commenter_name := coalesce(commenter_name, 'A member');
  comment_preview := left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 180);

  insert into public.notifications (
    recipient_id,
    adventure_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  ) values (
    post_author_id,
    post_adventure_id,
    'community',
    'normal',
    commenter_name || ' commented on your post',
    comment_preview,
    '/community/' || new.post_id::text,
    'community-comment:' || new.id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function private.notify_community_post_author_on_comment() from public;
revoke all on function private.notify_community_post_author_on_comment() from anon;
revoke all on function private.notify_community_post_author_on_comment() from authenticated;

drop trigger if exists community_comments_notify_post_author on public.community_comments;
create trigger community_comments_notify_post_author
after insert on public.community_comments
for each row
when (new.status = 'published')
execute function private.notify_community_post_author_on_comment();
