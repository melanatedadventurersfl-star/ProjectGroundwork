alter table public.community_comments
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.community_comments
  alter column body set default '';

alter table public.community_comments
  drop constraint if exists community_comments_body_check;

alter table public.community_comments
  add constraint community_comments_body_or_photo_check
  check (
    char_length(body) <= 2000
    and (
      char_length(btrim(body)) >= 1
      or cardinality(image_paths) between 1 and 4
    )
  );

alter table public.community_comments
  add constraint community_comments_max_four_images_check
  check (cardinality(image_paths) <= 4);

comment on column public.community_comments.image_paths is
  'Up to four private community-media storage object paths attached to this reply.';
