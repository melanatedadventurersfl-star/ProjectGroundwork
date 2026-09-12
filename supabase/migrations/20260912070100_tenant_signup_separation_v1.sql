-- Tenant signup separation V1
-- Tenant invitations never fall through to Go Melanated signup behavior.

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
    'signup_path', '/tenant-sign-up?org_invite=' || v_token || '&slug=' || v_org.slug
  );
end;
$$;

revoke all on function public.create_organization_join_link(uuid,text,integer,integer) from public, anon;
grant execute on function public.create_organization_join_link(uuid,text,integer,integer) to authenticated;

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
    if v_org is null then
      raise exception 'Organization invitation is invalid, expired, revoked, or fully used' using errcode = '22023';
    end if;
    return new;
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

revoke all on function private.bootstrap_profile_default_organization() from public, anon, authenticated;

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
    if target_organization is null then
      raise exception 'Organization invitation is invalid, expired, revoked, or fully used' using errcode = '22023';
    end if;
  end if;

  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    chosen_username,
    coalesce(
      chosen_display_name,
      chosen_username,
      case when target_organization is not null then 'Member' else 'Adventurer' end
    )
  );

  if organization_join_token is null then
    insert into public.member_connections (requester_id, addressee_id, status)
    select new.id, d.profile_id, 'accepted'
    from private.default_connection_profiles d
    where d.profile_id <> new.id
    on conflict do nothing;
  end if;

  return new;
end;
$$;
