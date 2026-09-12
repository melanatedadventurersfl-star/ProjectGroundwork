-- Organization Provisioning V1
-- Creates complete organizations through one platform-admin RPC and keeps
-- unsafe shared member modules disabled until they receive tenant isolation.

update public.experience_blueprints
set version = 2,
    default_modules = '[{"code":"home","label":"Home","enabled":true,"nav_position":10,"route_key":"/(tabs)","icon_key":"home","settings":{}},{"code":"events","label":"Events","enabled":true,"nav_position":20,"route_key":"/(tabs)/explore","icon_key":"adventure","settings":{}},{"code":"community","label":"Community","enabled":false,"nav_position":30,"route_key":"/(tabs)/community","icon_key":"community","settings":{"requires_tenant_isolation":true}},{"code":"profiles","label":"Profiles","enabled":false,"route_key":"/member/profile","icon_key":"profile","settings":{"requires_tenant_isolation":true}},{"code":"groups","label":"Groups","enabled":false,"route_key":"/groups","icon_key":"connections","settings":{"requires_tenant_isolation":true}},{"code":"directory","label":"Directory","enabled":false,"route_key":"/trail-guide","icon_key":"directory","settings":{"requires_tenant_isolation":true}},{"code":"calendar","label":"Calendar","enabled":false,"route_key":"/calendar","icon_key":"calendar","settings":{"requires_tenant_isolation":true}},{"code":"notifications","label":"Notifications","enabled":false,"route_key":"/notifications","icon_key":"notifications","settings":{"requires_tenant_isolation":true}},{"code":"memberships","label":"Membership","enabled":false,"route_key":"/member/go-plus","icon_key":"membership","settings":{"requires_tenant_isolation":true}},{"code":"search","label":"Search","enabled":false,"icon_key":"search","settings":{"requires_tenant_isolation":true}},{"code":"saved","label":"Saved","enabled":true,"icon_key":"bookmark","settings":{}},{"code":"menu","label":"Menu","enabled":true,"nav_position":90,"route_key":"/(tabs)/menu","icon_key":"menu","settings":{}}]'::jsonb,
    default_settings = '{"home_variant":"community","events_variant":"community","supports_branding":true,"supports_home_layout":true,"supports_custom_navigation":true,"supports_custom_terminology":true,"branding":{"primary":"#0F1713","surface":"#17211C","accent":"#D7B45A","text":"#FFF8E8"},"terminology":{"home":"Home","events":"Events","community":"Community","directory":"Directory","journey":"Journey","member":"Member","host":"Host"},"home_layout":["hero","upcoming_events","community_activity","recommendations"],"membership_settings":{"mode":"community"},"public_settings":{"discoverable":false,"allow_public_events":true}}'::jsonb,
    updated_at = now()
where code = 'community';

-- A bare organization row is no longer a supported creation path. Legacy
-- host-organization sync continues to work through its privileged trigger.
drop policy if exists "Users create organizations for themselves" on public.organizations;
drop policy if exists "Platform operators create organizations" on public.organizations;
create policy "Platform operators create organizations"
on public.organizations for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_platform_operator((select auth.uid())))
);

create or replace function public.provision_organization(
  p_name text,
  p_slug text,
  p_kind text default 'community',
  p_visibility text default 'private',
  p_blueprint_code text default 'community',
  p_primary_color text default null,
  p_accent_color text default null,
  p_make_active boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_org public.organizations%rowtype;
  v_experience public.organization_experiences%rowtype;
  v_blueprint public.experience_blueprints%rowtype;
  v_defaults jsonb;
  v_branding jsonb;
  v_navigation jsonb;
  v_module jsonb;
  v_module_code text;
  v_module_label text;
  v_module_enabled boolean;
  v_module_position integer;
  v_module_route text;
  v_module_icon text;
  v_module_settings jsonb;
begin
  if v_actor is null or not private.is_platform_operator(v_actor) then
    raise exception 'Platform operator access required' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'Organization name is required';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Slug must be 3-64 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen';
  end if;
  if p_kind not in ('community','company','nonprofit','brand','team','other') then
    raise exception 'Unsupported organization kind';
  end if;
  if p_visibility not in ('public','private') then
    raise exception 'Visibility must be public or private';
  end if;

  select * into v_blueprint
  from public.experience_blueprints
  where code = p_blueprint_code and is_active = true;
  if not found then
    raise exception 'Active experience blueprint not found: %', p_blueprint_code;
  end if;
  v_defaults := coalesce(v_blueprint.default_settings, '{}'::jsonb);

  insert into public.organizations (name, slug, kind, status, visibility, created_by, brand_settings)
  values (
    v_name,
    v_slug,
    p_kind,
    'active'::public.organization_status,
    p_visibility,
    v_actor,
    jsonb_strip_nulls(jsonb_build_object(
      'brand_name', v_name,
      'primary', nullif(btrim(coalesce(p_primary_color,'')),''),
      'accent', nullif(btrim(coalesce(p_accent_color,'')),'')
    ))
  )
  returning * into v_org;

  v_branding := coalesce(v_defaults->'branding', '{}'::jsonb)
    || jsonb_build_object('brand_name', v_name)
    || case when nullif(btrim(coalesce(p_primary_color,'')),'') is not null
         then jsonb_build_object('primary', btrim(p_primary_color)) else '{}'::jsonb end
    || case when nullif(btrim(coalesce(p_accent_color,'')),'') is not null
         then jsonb_build_object('accent', btrim(p_accent_color)) else '{}'::jsonb end;

  v_navigation := jsonb_strip_nulls(jsonb_build_object(
    'style', 'community',
    'show_brand_name', true,
    'home_variant', coalesce(v_defaults->>'home_variant','community'),
    'events_variant', coalesce(v_defaults->>'events_variant','community')
  ));

  insert into public.organization_experiences (
    organization_id, experience_key, name, public_slug, blueprint_code, status,
    branding, navigation, terminology, home_layout, membership_settings,
    public_settings, created_by
  ) values (
    v_org.id,
    'primary',
    v_name,
    v_slug,
    v_blueprint.code,
    'draft',
    v_branding,
    v_navigation,
    coalesce(v_defaults->'terminology','{}'::jsonb),
    coalesce(v_defaults->'home_layout','[]'::jsonb),
    coalesce(v_defaults->'membership_settings','{}'::jsonb),
    coalesce(v_defaults->'public_settings','{}'::jsonb),
    v_actor
  )
  returning * into v_experience;

  for v_module in
    select value from jsonb_array_elements(coalesce(v_blueprint.default_modules,'[]'::jsonb))
  loop
    if jsonb_typeof(v_module) = 'string' then
      v_module_code := trim(both '"' from v_module::text);
      v_module_label := initcap(replace(v_module_code, '_', ' '));
      v_module_enabled := false;
      v_module_position := null;
      v_module_route := null;
      v_module_icon := null;
      v_module_settings := '{}'::jsonb;
    else
      v_module_code := btrim(coalesce(v_module->>'code',''));
      v_module_label := coalesce(
        nullif(btrim(v_module->>'label'),''),
        initcap(replace(v_module_code, '_', ' '))
      );
      v_module_enabled := coalesce((v_module->>'enabled')::boolean, false);
      v_module_position := case
        when v_module ? 'nav_position' and v_module->>'nav_position' is not null
          then (v_module->>'nav_position')::integer
        else null
      end;
      v_module_route := nullif(btrim(coalesce(v_module->>'route_key','')),'');
      v_module_icon := nullif(btrim(coalesce(v_module->>'icon_key','')),'');
      v_module_settings := coalesce(v_module->'settings','{}'::jsonb);
    end if;

    if v_module_code = '' then
      raise exception 'Blueprint % contains a module without a code', v_blueprint.code;
    end if;

    insert into public.organization_experience_modules (
      experience_id, module_code, label, enabled, nav_position, route_key,
      icon_key, settings
    ) values (
      v_experience.id, v_module_code, v_module_label, v_module_enabled,
      v_module_position, v_module_route, v_module_icon, v_module_settings
    );
  end loop;

  if p_make_active then
    insert into public.profile_workspace_preferences (profile_id, active_organization_id)
    values (v_actor, v_org.id)
    on conflict (profile_id) do update
    set active_organization_id = excluded.active_organization_id,
        updated_at = now();
  end if;

  return jsonb_build_object(
    'organization_id', v_org.id,
    'experience_id', v_experience.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'blueprint_code', v_experience.blueprint_code,
    'experience_status', v_experience.status,
    'made_active', p_make_active
  );
end;
$$;

revoke all on function public.provision_organization(text,text,text,text,text,text,text,boolean)
from public, anon;
grant execute on function public.provision_organization(text,text,text,text,text,text,text,boolean)
to authenticated;
