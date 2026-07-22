create type public.community_post_status as enum ('published', 'hidden', 'removed');
create type public.community_report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  image_url text,
  status public.community_post_status not null default 'published',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status public.community_post_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','celebrate','support')),
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  reason text not null,
  details text,
  status public.community_report_status not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((post_id is not null) <> (comment_id is not null))
);

create trigger community_posts_set_updated_at before update on public.community_posts for each row execute function public.set_updated_at();
create trigger community_comments_set_updated_at before update on public.community_comments for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

create policy "Members read published community posts" on public.community_posts for select using (status = 'published');
create policy "Members create their own posts" on public.community_posts for insert with check (auth.uid() = author_id);
create policy "Authors edit their own posts" on public.community_posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Authors delete their own posts" on public.community_posts for delete using (auth.uid() = author_id);

create policy "Members read published comments" on public.community_comments for select using (status = 'published');
create policy "Members create their own comments" on public.community_comments for insert with check (auth.uid() = author_id);
create policy "Authors edit their own comments" on public.community_comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Authors delete their own comments" on public.community_comments for delete using (auth.uid() = author_id);

create policy "Members read reactions" on public.community_reactions for select using (true);
create policy "Members manage their own reactions" on public.community_reactions for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "Members create reports" on public.community_reports for insert with check (auth.uid() = reporter_id);
create policy "Members read their own reports" on public.community_reports for select using (auth.uid() = reporter_id);

create view public.community_feed as
select
  p.id,
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