alter table public.host_event_imports drop constraint if exists host_event_imports_source_type_check;
alter table public.host_event_imports add constraint host_event_imports_source_type_check check (source_type in ('event_site','file_url','pasted_text','template','uploaded_files'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-imports',
  'event-imports',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'text/plain',
    'text/html',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.host_event_import_files (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.host_event_imports(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists host_event_import_files_owner_idx on public.host_event_import_files(owner_profile_id, created_at desc);
create index if not exists host_event_import_files_import_idx on public.host_event_import_files(import_id);

alter table public.host_event_import_files enable row level security;
revoke all on table public.host_event_import_files from anon, authenticated;
grant select, insert, update, delete on table public.host_event_import_files to authenticated;

create policy "Hosts read own import files" on public.host_event_import_files
for select to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts create own import files" on public.host_event_import_files
for insert to authenticated
with check (owner_profile_id = (select auth.uid()) and (select is_approved_outing_host(auth.uid())));

create policy "Hosts update own import files" on public.host_event_import_files
for update to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()))
with check (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

create policy "Hosts delete own import files" on public.host_event_import_files
for delete to authenticated
using (owner_profile_id = (select auth.uid()) or (select is_platform_admin()) or (select app_private.is_master_account()));

drop policy if exists "Hosts upload own event imports" on storage.objects;
create policy "Hosts upload own event imports" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'event-imports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select is_approved_outing_host(auth.uid()))
);

drop policy if exists "Hosts read own event import objects" on storage.objects;
create policy "Hosts read own event import objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'event-imports'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select is_platform_admin())
    or (select app_private.is_master_account())
  )
);

drop policy if exists "Hosts delete own event import objects" on storage.objects;
create policy "Hosts delete own event import objects" on storage.objects
for delete to authenticated
using (
  bucket_id = 'event-imports'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select is_platform_admin())
    or (select app_private.is_master_account())
  )
);
