create table if not exists public.community_post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists community_post_shares_post_id_idx
  on public.community_post_shares(post_id);

alter table public.community_post_shares enable row level security;

drop policy if exists "Members read community post shares" on public.community_post_shares;
create policy "Members read community post shares"
on public.community_post_shares for select
using (true);

drop policy if exists "Members record their own community post shares" on public.community_post_shares;
create policy "Members record their own community post shares"
on public.community_post_shares for insert
with check (auth.uid() = profile_id);

grant select, insert on public.community_post_shares to authenticated;
