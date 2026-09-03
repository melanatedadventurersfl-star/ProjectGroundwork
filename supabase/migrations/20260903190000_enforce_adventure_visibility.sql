-- Enforce event visibility at the data layer.
-- Public and unlisted events remain readable when published.
-- Private events require explicit access or ownership.
-- Community events require membership in at least one allowed group.

create table if not exists public.adventure_private_access (
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (adventure_id, profile_id)
);

create index if not exists adventure_private_access_profile_idx
  on public.adventure_private_access(profile_id, adventure_id);

alter table public.adventure_private_access enable row level security;

drop policy if exists "Published adventures are readable" on public.adventures;

drop policy if exists "Visible adventures are readable" on public.adventures;
create policy "Visible adventures are readable"
on public.adventures for select
using (
  created_by = auth.uid()
  or (
    status in ('published', 'sold_out', 'completed')
    and (
      visibility in ('public', 'unlisted')
      or (
        visibility = 'private'
        and exists (
          select 1
          from public.adventure_private_access apa
          where apa.adventure_id = adventures.id
            and apa.profile_id = auth.uid()
        )
      )
      or (
        visibility = 'community'
        and exists (
          select 1
          from public.adventure_community_access aca
          join public.community_group_members cgm on cgm.group_id = aca.group_id
          where aca.adventure_id = adventures.id
            and cgm.profile_id = auth.uid()
        )
      )
    )
  )
);

drop policy if exists "Private event access is readable" on public.adventure_private_access;
create policy "Private event access is readable"
on public.adventure_private_access for select to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

drop policy if exists "Event creators manage private access" on public.adventure_private_access;
create policy "Event creators manage private access"
on public.adventure_private_access for all to authenticated
using (
  exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
)
with check (
  granted_by = auth.uid()
  and exists (
    select 1 from public.adventures a
    where a.id = adventure_id and a.created_by = auth.uid()
  )
);

grant select, insert, update, delete on public.adventure_private_access to authenticated;
