-- Make community reporting reliable, idempotent, reviewable, and user-controllable.

alter table public.community_reports
  add column if not exists reported_author_id uuid references public.profiles(id) on delete set null,
  add column if not exists thread_post_id uuid references public.community_posts(id) on delete set null,
  add column if not exists content_snapshot text,
  add column if not exists content_created_at timestamptz,
  add column if not exists priority text not null default 'normal',
  add column if not exists resolution_note text,
  add column if not exists action_taken text;

alter table public.community_reports
  drop constraint if exists community_reports_priority_check;
alter table public.community_reports
  add constraint community_reports_priority_check check (priority in ('normal', 'high'));

create unique index if not exists community_open_post_report_once
  on public.community_reports (reporter_id, post_id)
  where post_id is not null and status in ('open', 'reviewing');

create unique index if not exists community_open_comment_report_once
  on public.community_reports (reporter_id, comment_id)
  where comment_id is not null and status in ('open', 'reviewing');

create table if not exists public.community_hidden_content (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is not null) <> (comment_id is not null))
);

create unique index if not exists community_hidden_post_once
  on public.community_hidden_content (profile_id, post_id)
  where post_id is not null;
create unique index if not exists community_hidden_comment_once
  on public.community_hidden_content (profile_id, comment_id)
  where comment_id is not null;

create table if not exists public.community_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.community_hidden_content enable row level security;
alter table public.community_blocks enable row level security;

create policy "Members manage hidden community content"
  on public.community_hidden_content
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Members manage community blocks"
  on public.community_blocks
  for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Admins can review and resolve reports while reporters retain read-only access to their own reports.
drop policy if exists "Platform admins review community reports" on public.community_reports;
create policy "Platform admins review community reports"
  on public.community_reports
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.submit_community_report(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns table(report_id uuid, report_status public.community_report_status, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reporter uuid := auth.uid();
  v_author uuid;
  v_body text;
  v_created_at timestamptz;
  v_thread_post_id uuid;
  v_existing public.community_reports%rowtype;
  v_inserted public.community_reports%rowtype;
begin
  if v_reporter is null then
    raise exception 'You must be signed in to report content.' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Choose a reason for this report.' using errcode = '22023';
  end if;

  if p_target_kind = 'post' then
    select p.author_id, p.body, p.created_at, p.id
      into v_author, v_body, v_created_at, v_thread_post_id
      from public.community_posts p
     where p.id = p_target_id;
  elsif p_target_kind = 'comment' then
    select c.author_id, c.body, c.created_at, c.post_id
      into v_author, v_body, v_created_at, v_thread_post_id
      from public.community_comments c
     where c.id = p_target_id;
  else
    raise exception 'Unsupported report target.' using errcode = '22023';
  end if;

  if v_author is null then
    raise exception 'This content is no longer available.' using errcode = 'P0002';
  end if;

  if v_author = v_reporter then
    raise exception 'You cannot report your own content.' using errcode = '22023';
  end if;

  select r.* into v_existing
    from public.community_reports r
   where r.reporter_id = v_reporter
     and r.status in ('open', 'reviewing')
     and ((p_target_kind = 'post' and r.post_id = p_target_id)
       or (p_target_kind = 'comment' and r.comment_id = p_target_id))
   order by r.created_at desc
   limit 1;

  if v_existing.id is not null then
    return query select v_existing.id, v_existing.status, false;
    return;
  end if;

  begin
    insert into public.community_reports (
      reporter_id,
      post_id,
      comment_id,
      reason,
      details,
      reported_author_id,
      thread_post_id,
      content_snapshot,
      content_created_at,
      priority
    ) values (
      v_reporter,
      case when p_target_kind = 'post' then p_target_id else null end,
      case when p_target_kind = 'comment' then p_target_id else null end,
      trim(p_reason),
      nullif(trim(coalesce(p_details, '')), ''),
      v_author,
      v_thread_post_id,
      v_body,
      v_created_at,
      case when lower(p_reason) similar to '%(threat|violence|hate|dangerous|harmful)%' then 'high' else 'normal' end
    )
    returning * into v_inserted;
  exception when unique_violation then
    select r.* into v_inserted
      from public.community_reports r
     where r.reporter_id = v_reporter
       and r.status in ('open', 'reviewing')
       and ((p_target_kind = 'post' and r.post_id = p_target_id)
         or (p_target_kind = 'comment' and r.comment_id = p_target_id))
     order by r.created_at desc
     limit 1;
    return query select v_inserted.id, v_inserted.status, false;
    return;
  end;

  return query select v_inserted.id, v_inserted.status, true;
end;
$$;

grant execute on function public.submit_community_report(text, uuid, text, text) to authenticated;

create or replace function public.hide_community_content(p_target_kind text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if p_target_kind = 'post' then
    if not exists (select 1 from public.community_posts where id = p_target_id) then
      raise exception 'This content is no longer available.' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.community_hidden_content where profile_id = v_profile_id and post_id = p_target_id) then
      insert into public.community_hidden_content(profile_id, post_id) values (v_profile_id, p_target_id);
    end if;
  elsif p_target_kind = 'comment' then
    if not exists (select 1 from public.community_comments where id = p_target_id) then
      raise exception 'This content is no longer available.' using errcode = 'P0002';
    end if;
    if not exists (select 1 from public.community_hidden_content where profile_id = v_profile_id and comment_id = p_target_id) then
      insert into public.community_hidden_content(profile_id, comment_id) values (v_profile_id, p_target_id);
    end if;
  else
    raise exception 'Unsupported content target.' using errcode = '22023';
  end if;
end;
$$;

grant execute on function public.hide_community_content(text, uuid) to authenticated;

create or replace function public.block_community_member(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocker_id uuid := auth.uid();
begin
  if v_blocker_id is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_blocked_id = v_blocker_id then
    raise exception 'You cannot block yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'Member not found.' using errcode = 'P0002';
  end if;

  insert into public.community_blocks(blocker_id, blocked_id)
  values (v_blocker_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

grant execute on function public.block_community_member(uuid) to authenticated;
