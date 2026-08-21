create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid null references auth.users(id) on delete set null,
  source text not null default 'web' check (source in ('web','app','support')),
  status text not null default 'pending' check (status in ('pending','verifying','approved','completed','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz null,
  notes text null,
  constraint account_deletion_requests_email_check
    check (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1)
);

alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from anon, authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;

create unique index if not exists account_deletion_requests_one_open_per_email_idx
  on public.account_deletion_requests (lower(trim(email)))
  where status in ('pending','verifying','approved');

comment on table public.account_deletion_requests is
  'Account deletion requests received from Go Melanated app, web, or support channels. Direct client access is blocked; requests are created by trusted server-side code.';
