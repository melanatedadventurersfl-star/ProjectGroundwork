alter table public.support_requests
  add column if not exists attachments text[] not null default '{}'::text[],
  add column if not exists diagnostics jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload own support attachments" on storage.objects;
create policy "Members upload own support attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Members read own support attachments" on storage.objects;
create policy "Members read own support attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or app_private.is_master_account()
  )
);

drop policy if exists "Members delete own support attachments" on storage.objects;
create policy "Members delete own support attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
