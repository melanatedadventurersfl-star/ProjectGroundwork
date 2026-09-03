create table if not exists public.host_profile_settings (
  host_profile_id uuid primary key references public.profiles(id) on delete cascade,
  organization_name text,
  tagline text,
  website_url text,
  instagram_url text,
  facebook_url text,
  contact_email text,
  show_email boolean not null default false,
  location_summary text,
  specialties text[] not null default '{}',
  availability_status text,
  accepting_messages boolean not null default true,
  faq jsonb not null default '[]'::jsonb,
  policies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger host_profile_settings_set_updated_at
before update on public.host_profile_settings
for each row execute function public.set_updated_at();

alter table public.host_profile_settings enable row level security;

create policy "Approved hosts may read public host settings"
on public.host_profile_settings for select
using (
  exists (
    select 1 from public.outing_hosts oh
    where oh.profile_id = host_profile_id
      and oh.status = 'approved'
  )
  or host_profile_id = auth.uid()
  or public.is_platform_admin()
);

create policy "Hosts manage their public host settings"
on public.host_profile_settings for all
using (host_profile_id = auth.uid() or public.is_platform_admin())
with check (
  (host_profile_id = auth.uid() and public.is_approved_outing_host(auth.uid()))
  or public.is_platform_admin()
);

create table if not exists public.host_follows (
  host_profile_id uuid not null references public.profiles(id) on delete cascade,
  follower_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (host_profile_id, follower_profile_id),
  check (host_profile_id <> follower_profile_id)
);

alter table public.host_follows enable row level security;

create policy "Host follow counts are readable"
on public.host_follows for select
using (auth.uid() is not null);

create policy "Members follow approved hosts"
on public.host_follows for insert
with check (
  follower_profile_id = auth.uid()
  and exists (
    select 1 from public.outing_hosts oh
    where oh.profile_id = host_profile_id
      and oh.status = 'approved'
  )
);

create policy "Members unfollow hosts"
on public.host_follows for delete
using (follower_profile_id = auth.uid());

create table if not exists public.host_inquiries (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  adventure_id uuid references public.adventures(id) on delete set null,
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists host_inquiries_host_created_idx
  on public.host_inquiries(host_profile_id, created_at desc);
create index if not exists host_inquiries_sender_created_idx
  on public.host_inquiries(sender_profile_id, created_at desc);

alter table public.host_inquiries enable row level security;

create policy "Inquiry participants may read messages"
on public.host_inquiries for select
using (
  sender_profile_id = auth.uid()
  or host_profile_id = auth.uid()
  or public.is_platform_admin()
);

create policy "Members may message approved hosts"
on public.host_inquiries for insert
with check (
  sender_profile_id = auth.uid()
  and sender_profile_id <> host_profile_id
  and exists (
    select 1
    from public.outing_hosts oh
    left join public.host_profile_settings hps on hps.host_profile_id = oh.profile_id
    where oh.profile_id = host_profile_id
      and oh.status = 'approved'
      and coalesce(hps.accepting_messages, true) = true
  )
);

create policy "Hosts may mark inquiries read"
on public.host_inquiries for update
using (host_profile_id = auth.uid() or public.is_platform_admin())
with check (host_profile_id = auth.uid() or public.is_platform_admin());

create or replace function public.get_public_host_profile(p_host_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with approved_host as (
    select
      oh.profile_id,
      oh.host_type,
      oh.approved_at,
      p.display_name,
      p.username,
      p.avatar_url,
      p.cover_url,
      p.bio,
      p.home_city,
      p.home_state,
      p.created_at,
      hps.organization_name,
      hps.tagline,
      hps.website_url,
      hps.instagram_url,
      hps.facebook_url,
      case when hps.show_email then hps.contact_email else null end as contact_email,
      hps.location_summary,
      coalesce(hps.specialties, '{}'::text[]) as specialties,
      hps.availability_status,
      coalesce(hps.accepting_messages, true) as accepting_messages,
      coalesce(hps.faq, '[]'::jsonb) as faq,
      coalesce(hps.policies, '[]'::jsonb) as policies
    from public.outing_hosts oh
    join public.profiles p on p.id = oh.profile_id
    left join public.host_profile_settings hps on hps.host_profile_id = oh.profile_id
    where oh.profile_id = p_host_profile_id
      and oh.status = 'approved'
  ),
  public_events as (
    select a.*
    from public.adventures a
    where a.created_by = p_host_profile_id
      and a.status in ('published', 'sold_out', 'completed')
  ),
  upcoming as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'starts_at', a.starts_at,
      'city', a.city,
      'state', a.state,
      'category', a.category,
      'hero_image_url', a.hero_image_url,
      'spots_remaining', a.spots_remaining,
      'capacity', a.capacity,
      'status', a.status
    ) order by a.starts_at asc), '[]'::jsonb) as items
    from public_events a
    where a.starts_at >= now()
      and a.status in ('published', 'sold_out')
  ),
  past as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'starts_at', a.starts_at,
      'city', a.city,
      'state', a.state,
      'category', a.category,
      'hero_image_url', a.hero_image_url,
      'status', a.status
    ) order by a.starts_at desc), '[]'::jsonb) as items
    from (
      select * from public_events
      where starts_at < now() or status = 'completed'
      order by starts_at desc
      limit 12
    ) a
  ),
  stats as (
    select
      count(*) filter (where status = 'completed' or starts_at < now())::int as events_hosted,
      count(*) filter (where starts_at >= now() and status in ('published','sold_out'))::int as upcoming_events
    from public_events
  ),
  follows as (
    select
      count(*)::int as follower_count,
      exists(
        select 1 from public.host_follows hf2
        where hf2.host_profile_id = p_host_profile_id
          and hf2.follower_profile_id = auth.uid()
      ) as viewer_follows
    from public.host_follows hf
    where hf.host_profile_id = p_host_profile_id
  )
  select case when ah.profile_id is null then null else jsonb_build_object(
    'id', ah.profile_id,
    'host_type', ah.host_type,
    'approved_at', ah.approved_at,
    'display_name', ah.display_name,
    'organization_name', coalesce(ah.organization_name, ah.display_name),
    'username', ah.username,
    'avatar_url', ah.avatar_url,
    'cover_url', ah.cover_url,
    'bio', ah.bio,
    'tagline', ah.tagline,
    'home_city', ah.home_city,
    'home_state', ah.home_state,
    'location_summary', ah.location_summary,
    'website_url', ah.website_url,
    'instagram_url', ah.instagram_url,
    'facebook_url', ah.facebook_url,
    'contact_email', ah.contact_email,
    'specialties', ah.specialties,
    'availability_status', ah.availability_status,
    'accepting_messages', ah.accepting_messages,
    'faq', ah.faq,
    'policies', ah.policies,
    'created_at', ah.created_at,
    'events_hosted', s.events_hosted,
    'upcoming_event_count', s.upcoming_events,
    'follower_count', f.follower_count,
    'viewer_follows', f.viewer_follows,
    'upcoming_events', u.items,
    'past_events', p.items
  ) end
  from approved_host ah
  cross join stats s
  cross join follows f
  cross join upcoming u
  cross join past p;
$$;

grant execute on function public.get_public_host_profile(uuid) to authenticated;

create or replace function public.set_host_follow(p_host_profile_id uuid, p_follow boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_host_profile_id = auth.uid() then
    raise exception 'You cannot follow yourself as a host';
  end if;
  if not exists (
    select 1 from public.outing_hosts
    where profile_id = p_host_profile_id and status = 'approved'
  ) then
    raise exception 'Host not found';
  end if;

  if p_follow then
    insert into public.host_follows(host_profile_id, follower_profile_id)
    values (p_host_profile_id, auth.uid())
    on conflict do nothing;
  else
    delete from public.host_follows
    where host_profile_id = p_host_profile_id
      and follower_profile_id = auth.uid();
  end if;

  return p_follow;
end;
$$;

grant execute on function public.set_host_follow(uuid, boolean) to authenticated;

create or replace function public.send_host_inquiry(
  p_host_profile_id uuid,
  p_message text,
  p_adventure_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry_id uuid;
  clean_message text := btrim(p_message);
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if clean_message = '' or char_length(clean_message) > 2000 then
    raise exception 'Message must be between 1 and 2000 characters';
  end if;
  if p_host_profile_id = auth.uid() then
    raise exception 'You cannot message yourself through the public host profile';
  end if;
  if not exists (
    select 1
    from public.outing_hosts oh
    left join public.host_profile_settings hps on hps.host_profile_id = oh.profile_id
    where oh.profile_id = p_host_profile_id
      and oh.status = 'approved'
      and coalesce(hps.accepting_messages, true) = true
  ) then
    raise exception 'This host is not accepting messages';
  end if;
  if p_adventure_id is not null and not exists (
    select 1 from public.adventures a
    where a.id = p_adventure_id
      and a.created_by = p_host_profile_id
      and a.status in ('published','sold_out','completed')
  ) then
    raise exception 'Event context does not belong to this host';
  end if;

  insert into public.host_inquiries(host_profile_id, sender_profile_id, adventure_id, message)
  values (p_host_profile_id, auth.uid(), p_adventure_id, clean_message)
  returning id into inquiry_id;

  return inquiry_id;
end;
$$;

grant execute on function public.send_host_inquiry(uuid, text, uuid) to authenticated;
