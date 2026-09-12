-- Tenant-aware Signup V1
-- Organization join links route new profiles into the intended tenant without
-- trusting raw organization identifiers from signup metadata.

create table if not exists private.organization_join_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null default 'Member signup link',
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','revoked')),
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_join_links_org_status_idx
  on private.organization_join_links(organization_id, status, created_at desc);
create index if not exists organization_join_links_expires_idx
  on private.organization_join_links(expires_at)
  where status = 'active' and expires_at is not null;

revoke all on private.organization_join_links from public, anon, authenticated;
grant select, insert, update on private.organization_join_links to authenticated;

create or replace function private.organization_for_join_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.organization_id
  from private.organization_join_links l
  join public.organizations o on o.id = l.organization_id
  where l.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and l.status = 'active'
    and o.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (l.max_uses is null or l.use_count < l.max_uses)
  limit 1;
$$;

create or replace function private.consume_organization_join_token(
  p_token text,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if p_profile_id is null or nullif(btrim(coalesce(p_token, '')), '') is null then
    return null;
  end if;

  update private.organization_join_links l
  set use_count = l.use_count + 1,
      last_used_at = now(),
      updated_at = now()
  from public.organizations o
  where l.organization_id = o.id
    and l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and l.status = 'active'
    and o.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and (l.max_uses is null or l.use_count < l.max_uses)
  returning l.organization_id into v_org;

  if v_org is null then
    return null;
  end if;

  insert into public.organization_memberships (organization_id, profile_id, status)
  values (v_org, p_profile_id, 'active')
  on conflict (organization_id, profile_id)
  do update set status = 'active', updated_at = now();

  insert into public.organization_member_roles (organization_id, profile_id, role_code)
  values (v_org, p_profile_id, 'member')
  on conflict do nothing;

  insert into public.profile_workspace_preferences (profile_id, active_organization_id)
  values (p_profile_id, v_org)
  on conflict (profile_id)
  do update set active_organization_id = excluded.active_organization_id,
                updated_at = now();

  return v_org;
end;
$$;

revoke all on function private.organization_for_join_token(text) from public, anon, authenticated;
revoke all on function private.consume_organization_join_token(text, uuid) from public, anon, authenticated;

create or replace function public.create_organization_join_link(
  p_organization_id uuid,
  p_label text default 'Member signup link',
  p_max_uses integer default null,
  p_expires_in_days integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_hash text;
  v_link private.organization_join_links%rowtype;
  v_org public.organizations%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.has_organization_permission(p_organization_id, 'members.manage', v_actor) then
    raise exception 'Member management permission required' using errcode = '42501';
  end if;

  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'Maximum uses must be at least 1';
  end if;
  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 365 then
    raise exception 'Expiration must be between 1 and 365 days';
  end if;

  select * into v_org
  from public.organizations
  where id = p_organization_id and status = 'active';
  if not found then
    raise exception 'Active organization not found' using errcode = 'P0002';
  end if;

  v_token := 'org_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into private.organization_join_links (
    organization_id, label, token_hash, max_uses, expires_at, created_by
  ) values (
    p_organization_id,
    coalesce(nullif(btrim(p_label), ''), 'Member signup link'),
    v_hash,
    p_max_uses,
    now() + make_interval(days => p_expires_in_days),
    v_actor
  )
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'organization_id', v_link.organization_id,
    'organization_name', v_org.name,
    'organization_slug', v_org.slug,
    'label', v_link.label,
    'token', v_token,
    'expires_at', v_link.expires_at,
    'max_uses', v_link.max_uses,
    'signup_path', '/(auth)/sign-up?org_invite=' || v_token
  );
end;
$$;

create or replace function public.list_organization_join_links(p_organization_id uuid)
returns table (
  id uuid,
  label text,
  status text,
  max_uses integer,
  use_count integer,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.has_organization_permission(p_organization_id, 'members.manage', auth.uid()) then
    raise exception 'Member management permission required' using errcode = '42501';
  end if;

  return query
  select l.id, l.label, l.status, l.max_uses, l.use_count,
         l.expires_at, l.last_used_at, l.created_at
  from private.organization_join_links l
  where l.organization_id = p_organization_id
  order by l.created_at desc;
end;
$$;

create or replace function public.revoke_organization_join_link(p_link_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
  from private.organization_join_links
  where id = p_link_id;

  if v_org is null then
    return false;
  end if;

  if auth.uid() is null
    or not private.has_organization_permission(v_org, 'members.manage', auth.uid()) then
    raise exception 'Member management permission required' using errcode = '42501';
  end if;

  update private.organization_join_links
  set status = 'revoked', updated_at = now()
  where id = p_link_id and status <> 'revoked';

  return true;
end;
$$;

revoke all on function public.create_organization_join_link(uuid,text,integer,integer) from public, anon;
revoke all on function public.list_organization_join_links(uuid) from public, anon;
revoke all on function public.revoke_organization_join_link(uuid) from public, anon;
grant execute on function public.create_organization_join_link(uuid,text,integer,integer) to authenticated;
grant execute on function public.list_organization_join_links(uuid) to authenticated;
grant execute on function public.revoke_organization_join_link(uuid) to authenticated;

-- New profiles join a validated tenant when an organization token was supplied.
-- No token keeps the current Go Melanated default behavior.
create or replace function private.bootstrap_profile_default_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_token text;
begin
  select nullif(btrim(u.raw_user_meta_data ->> 'organization_join_token'), '')
    into v_token
  from auth.users u
  where u.id = new.id;

  if v_token is not null then
    v_org := private.consume_organization_join_token(v_token, new.id);
    if v_org is not null then
      return new;
    end if;
  end if;

  select id into v_org
  from public.organizations
  where is_platform_default = true
  limit 1;

  if v_org is null then return new; end if;

  insert into public.organization_memberships (organization_id, profile_id, status)
  values (v_org, new.id, 'active')
  on conflict (organization_id, profile_id)
  do update set status = 'active', updated_at = now();

  insert into public.organization_member_roles (organization_id, profile_id, role_code)
  values (v_org, new.id, 'member')
  on conflict do nothing;

  insert into public.profile_workspace_preferences (profile_id, active_organization_id)
  values (new.id, v_org)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- Tenant-link signups do not inherit Go Melanated's seeded social connections.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
  chosen_display_name text;
  organization_join_token text;
  target_organization uuid;
begin
  chosen_username := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  )), '');

  chosen_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  organization_join_token := nullif(trim(new.raw_user_meta_data ->> 'organization_join_token'), '');

  if organization_join_token is not null then
    target_organization := private.organization_for_join_token(organization_join_token);
  end if;

  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    chosen_username,
    coalesce(chosen_display_name, chosen_username, 'Adventurer')
  );

  if target_organization is null then
    insert into public.member_connections (requester_id, addressee_id, status)
    select new.id, d.profile_id, 'accepted'
    from private.default_connection_profiles d
    where d.profile_id <> new.id
    on conflict do nothing;
  end if;

  return new;
end;
$$;
