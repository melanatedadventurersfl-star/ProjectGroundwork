create extension if not exists pg_net with schema extensions;

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

create policy "Members read their push devices"
on public.device_push_tokens for select
using (profile_id = auth.uid());

create policy "Members delete their push devices"
on public.device_push_tokens for delete
using (profile_id = auth.uid());

create or replace function public.register_device_push_token(expo_token text, device_platform text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  token_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if expo_token is null or length(trim(expo_token)) < 10 then
    raise exception 'Invalid Expo push token';
  end if;

  if device_platform not in ('android', 'ios') then
    raise exception 'Unsupported device platform';
  end if;

  insert into public.device_push_tokens (
    profile_id,
    expo_push_token,
    platform,
    enabled,
    last_seen_at,
    updated_at
  ) values (
    auth.uid(),
    trim(expo_token),
    device_platform,
    true,
    now(),
    now()
  )
  on conflict (expo_push_token) do update
    set profile_id = excluded.profile_id,
        platform = excluded.platform,
        enabled = true,
        last_seen_at = now(),
        updated_at = now()
  returning id into token_id;

  return token_id;
end;
$$;

grant execute on function public.register_device_push_token(text, text) to authenticated;

create index if not exists device_push_tokens_profile_enabled_idx
  on public.device_push_tokens (profile_id, enabled)
  where enabled = true;

-- Database webhooks are powered by pg_net. Store the project endpoint and
-- public anon JWT in Vault so the trigger does not expose them in runtime logs.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'push_project_url') then
    perform vault.create_secret(
      'https://hqndxityqrdiiwqyjagu.supabase.co',
      'push_project_url',
      'Project URL used by the notification delivery webhook'
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'push_webhook_anon_jwt') then
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbmR4aXR5cXJkaWl3cXlqYWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwOTA3MTksImV4cCI6MjA5OTY2NjcxOX0.KpZb_rjDzGgiS9c3IRN7mi41yNO3b_lsZKFwVJlkCyc',
      'push_webhook_anon_jwt',
      'Public anon JWT used only to pass Edge Function gateway verification'
    );
  end if;
end;
$$;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  project_url text;
  webhook_jwt text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'push_project_url'
  limit 1;

  select decrypted_secret into webhook_jwt
  from vault.decrypted_secrets
  where name = 'push_webhook_anon_jwt'
  limit 1;

  if project_url is null or webhook_jwt is null then
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_jwt
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    )
  );

  return new;
end;
$$;

drop trigger if exists notifications_native_push_webhook on public.notifications;
create trigger notifications_native_push_webhook
after insert on public.notifications
for each row execute function public.dispatch_notification_push();
