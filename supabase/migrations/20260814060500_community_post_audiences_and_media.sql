alter table public.community_posts
  add column if not exists group_id uuid references public.community_groups(id) on delete cascade,
  add column if not exists circle_id uuid references public.community_circles(id) on delete cascade,
  add column if not exists audience text not null default 'everyone',
  add column if not exists post_type text not null default 'update',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.community_posts
set audience = 'group'
where group_id is not null and audience = 'everyone';

alter table public.community_posts
  drop constraint if exists community_posts_audience_check,
  add constraint community_posts_audience_check
    check (audience in ('everyone','connections','circle','group')),
  drop constraint if exists community_posts_post_type_check,
  add constraint community_posts_post_type_check
    check (post_type in ('update','photo','ask','meetup','buddy','recommendation')),
  drop constraint if exists community_posts_audience_target_check,
  add constraint community_posts_audience_target_check
    check (
      (audience = 'circle' and circle_id is not null and group_id is null)
      or (audience = 'group' and group_id is not null and circle_id is null)
      or (audience in ('everyone','connections') and circle_id is null and group_id is null)
    );

drop policy if exists "Members read published community posts" on public.community_posts;
drop policy if exists "Members create their own posts" on public.community_posts;

create policy "Members read visible community posts"
on public.community_posts for select
using (
  status = 'published'
  and (
    auth.uid() = author_id
    or audience = 'everyone'
    or (
      audience = 'connections'
      and exists (
        select 1 from public.member_connections mc
        where mc.status = 'accepted'
          and (
            (mc.requester_id = author_id and mc.addressee_id = auth.uid())
            or (mc.addressee_id = author_id and mc.requester_id = auth.uid())
          )
      )
    )
    or (
      audience = 'circle'
      and exists (
        select 1 from public.community_circle_members cm
        where cm.circle_id = community_posts.circle_id
          and cm.profile_id = auth.uid()
      )
    )
    or (
      audience = 'group'
      and exists (
        select 1 from public.community_group_members gm
        where gm.group_id = community_posts.group_id
          and gm.profile_id = auth.uid()
      )
    )
  )
);

create policy "Members create permitted community posts"
on public.community_posts for insert
with check (
  auth.uid() = author_id
  and (
    audience in ('everyone','connections')
    or (
      audience = 'circle'
      and exists (
        select 1 from public.community_circles c
        where c.id = circle_id and c.owner_id = auth.uid()
      )
    )
    or (
      audience = 'group'
      and exists (
        select 1 from public.community_group_members gm
        where gm.group_id = group_id and gm.profile_id = auth.uid()
      )
    )
  )
);

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Members upload own community media" on storage.objects;
drop policy if exists "Members read visible community media" on storage.objects;
drop policy if exists "Members delete own community media" on storage.objects;

create policy "Members upload own community media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "Members read visible community media"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and exists (
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
            select 1 from public.member_connections mc
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
            select 1 from public.community_circle_members cm
            where cm.circle_id = p.circle_id and cm.profile_id = auth.uid()
          )
        )
        or (
          p.audience = 'group'
          and exists (
            select 1 from public.community_group_members gm
            where gm.group_id = p.group_id and gm.profile_id = auth.uid()
          )
        )
      )
  )
);

create policy "Members delete own community media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop view if exists public.community_feed;
create view public.community_feed
with (security_invoker = true)
as
select
  p.id,
  p.group_id,
  p.circle_id,
  p.audience,
  p.post_type,
  p.metadata,
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
group by p.id, pr.display_name, pr.first_name, pr.avatar_url;

grant select on public.community_feed to authenticated;
