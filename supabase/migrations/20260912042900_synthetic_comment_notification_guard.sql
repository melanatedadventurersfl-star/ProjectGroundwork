-- Install the synthetic-comment notification guard before synthetic seed activity runs.
-- The following migration adds profiles.is_synthetic, so this function checks for the
-- column dynamically until that migration has completed.

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
  commenter_is_synthetic boolean := false;
  author_is_synthetic boolean := false;
  synthetic_column_exists boolean := false;
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

  select exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and a.attname = 'is_synthetic'
      and a.attnum > 0
      and not a.attisdropped
  ) into synthetic_column_exists;

  if synthetic_column_exists then
    execute 'select coalesce(is_synthetic, false) from public.profiles where id = $1'
      into commenter_is_synthetic
      using new.author_id;
    execute 'select coalesce(is_synthetic, false) from public.profiles where id = $1'
      into author_is_synthetic
      using post_author_id;

    if commenter_is_synthetic and not author_is_synthetic then
      return new;
    end if;
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

revoke all on function private.notify_community_post_author_on_comment() from public, anon, authenticated;
