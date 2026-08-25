alter table public.community_comments
  add column if not exists parent_comment_id uuid references public.community_comments(id) on delete cascade,
  add column if not exists reply_to_profile_id uuid references public.profiles(id) on delete set null;

create index if not exists community_comments_parent_comment_id_idx
  on public.community_comments(parent_comment_id)
  where parent_comment_id is not null;

create index if not exists community_comments_reply_to_profile_id_idx
  on public.community_comments(reply_to_profile_id)
  where reply_to_profile_id is not null;

create or replace function public.notify_community_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if new.reply_to_profile_id is null or new.reply_to_profile_id = new.author_id then
    return new;
  end if;

  select coalesce(nullif(display_name, ''), nullif(first_name, ''), 'Someone')
    into actor_name
    from public.profiles
   where id = new.author_id;

  insert into public.notifications (
    recipient_id,
    kind,
    priority,
    title,
    body,
    action_url,
    dedupe_key
  ) values (
    new.reply_to_profile_id,
    'community',
    'normal',
    coalesce(actor_name, 'Someone') || ' replied to your comment',
    case
      when char_length(btrim(new.body)) > 0 then left(btrim(new.body), 140)
      when cardinality(new.image_paths) > 0 then 'Sent a photo reply'
      else 'Sent a reply'
    end,
    '/community/' || new.post_id::text || '?comment=' || new.id::text,
    'community-comment-reply:' || new.id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists community_comment_reply_notification on public.community_comments;
create trigger community_comment_reply_notification
after insert on public.community_comments
for each row
execute function public.notify_community_comment_reply();

comment on column public.community_comments.parent_comment_id is
  'Top-level comment this reply belongs under. Child replies are visually limited to one nesting level.';

comment on column public.community_comments.reply_to_profile_id is
  'Profile being directly replied to and visually tagged in the thread.';
