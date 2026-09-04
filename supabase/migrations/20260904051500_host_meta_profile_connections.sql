create table if not exists public.host_meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.host_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nonce text not null unique,
  return_url text not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.host_meta_oauth_states enable row level security;

create index if not exists host_meta_oauth_states_expiry_idx
  on public.host_meta_oauth_states (expires_at);

create table if not exists public.host_meta_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.host_organizations(id) on delete cascade,
  connected_by uuid not null references public.profiles(id) on delete cascade,
  facebook_user_id text,
  facebook_page_id text,
  facebook_page_name text,
  instagram_account_id text,
  instagram_username text,
  token_ciphertext text not null,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected','expired','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.host_meta_connections enable row level security;

-- No client policies are intentionally created for either table.
-- OAuth state and encrypted provider tokens are server-only and are accessed
-- through Edge Functions with the service role after organization permission checks.

create or replace function public.can_manage_host_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.host_organization_members m
    where m.organization_id = p_organization_id
      and m.profile_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

grant execute on function public.can_manage_host_organization(uuid) to authenticated;
