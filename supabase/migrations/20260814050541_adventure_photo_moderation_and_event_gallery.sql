create or replace function public.is_platform_admin(check_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_profile_id
      and p.platform_role = 'admin'
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;

alter table public.adventure_memory_photos
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_moderation_status_check;

alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_moderation_status_check
  check (moderation_status in ('pending', 'approved', 'rejected'));

update public.adventure_memory_photos
set moderation_status = 'approved',
    reviewed_at = coalesce(reviewed_at, created_at)
where moderation_status = 'pending';

drop policy if exists "Members read permitted memory photos" on public.adventure_memory_photos;
drop policy if exists "Admins read all adventure memory photos" on public.adventure_memory_photos;
drop policy if exists "Admins moderate adventure memory photos" on public.adventure_memory_photos;

create policy "Members read permitted memory photos"
on public.adventure_memory_photos
for select
to authenticated
using (
  profile_id = auth.uid()
  or (
    moderation_status = 'approved'
    and visibility = 'group'
    and public.is_paid_adventure_attendee(adventure_id, auth.uid())
  )
);

create policy "Admins read all adventure memory photos"
on public.adventure_memory_photos
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

create policy "Admins moderate adventure memory photos"
on public.adventure_memory_photos
for update
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists "Members add their memory photos" on public.adventure_memory_photos;
create policy "Members add their memory photos"
on public.adventure_memory_photos
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.is_paid_adventure_attendee(adventure_id, auth.uid())
  and moderation_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);

create index if not exists adventure_memory_photos_gallery_idx
  on public.adventure_memory_photos (adventure_id, moderation_status, created_at desc);
