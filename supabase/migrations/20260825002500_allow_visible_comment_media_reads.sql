drop policy if exists "Members read visible community media" on storage.objects;

create policy "Members read visible community media"
on storage.objects
for select
using (
  bucket_id = 'community-media'
  and (
    exists (
      select 1
      from public.community_posts p
      where p.image_url = storage.objects.name
        and p.status = 'published'
        and (
          p.author_id = auth.uid()
          or p.audience = 'everyone'
          or (
            p.audience = 'connections'
            and exists (
              select 1
              from public.member_connections mc
              where mc.status = 'accepted'
                and (
                  (mc.requester_id = p.author_id and mc.addressee_id = auth.uid())
                  or (mc.addressee_id = p.author_id and mc.requester_id = auth.uid())
                )
            )
          )
          or (
            p.audience = 'circle'
            and exists (
              select 1
              from public.community_circle_members cm
              where cm.circle_id = p.circle_id
                and cm.profile_id = auth.uid()
            )
          )
          or (
            p.audience = 'group'
            and exists (
              select 1
              from public.community_group_members gm
              where gm.group_id = p.group_id
                and gm.profile_id = auth.uid()
            )
          )
        )
    )
    or exists (
      select 1
      from public.community_comments c
      join public.community_posts p on p.id = c.post_id
      where storage.objects.name = any(c.image_paths)
        and c.status = 'published'
        and p.status = 'published'
        and (
          c.author_id = auth.uid()
          or p.author_id = auth.uid()
          or p.audience = 'everyone'
          or (
            p.audience = 'connections'
            and exists (
              select 1
              from public.member_connections mc
              where mc.status = 'accepted'
                and (
                  (mc.requester_id = p.author_id and mc.addressee_id = auth.uid())
                  or (mc.addressee_id = p.author_id and mc.requester_id = auth.uid())
                )
            )
          )
          or (
            p.audience = 'circle'
            and exists (
              select 1
              from public.community_circle_members cm
              where cm.circle_id = p.circle_id
                and cm.profile_id = auth.uid()
            )
          )
          or (
            p.audience = 'group'
            and exists (
              select 1
              from public.community_group_members gm
              where gm.group_id = p.group_id
                and gm.profile_id = auth.uid()
            )
          )
        )
    )
  )
);
