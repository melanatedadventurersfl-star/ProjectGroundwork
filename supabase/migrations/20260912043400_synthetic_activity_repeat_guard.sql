-- Harden the recurring simulator against repetitive posts and duplicate replies.

create or replace function private.run_synthetic_activity_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg private.synthetic_activity_settings%rowtype;
  actor private.synthetic_personas%rowtype;
  local_now timestamp;
  local_hour integer;
  actions_today integer := 0;
  actor_actions_today integer := 0;
  action_roll double precision;
  should_act boolean := false;
  selected_body text;
  selected_photo text;
  selected_group uuid;
  target_post uuid;
  reaction_value text;
  inserted_id uuid;
  result jsonb := '{}'::jsonb;
begin
  select * into cfg
  from private.synthetic_activity_settings
  where settings_key = 'default';

  if not found or not cfg.enabled then
    return jsonb_build_object('status','disabled');
  end if;

  local_now := timezone(cfg.activity_timezone, now());
  local_hour := extract(hour from local_now)::integer;

  update private.synthetic_activity_settings
  set last_tick_at = now(), updated_at = now()
  where settings_key = 'default';

  if cfg.quiet_start_hour < cfg.quiet_end_hour then
    if local_hour >= cfg.quiet_start_hour and local_hour < cfg.quiet_end_hour then
      return jsonb_build_object('status','quiet_hours','hour',local_hour);
    end if;
  elsif local_hour >= cfg.quiet_start_hour or local_hour < cfg.quiet_end_hour then
    return jsonb_build_object('status','quiet_hours','hour',local_hour);
  end if;

  select count(*)::integer into actions_today
  from private.synthetic_activity_log l
  where timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
    and l.action_type <> 'seed';

  if actions_today >= cfg.max_daily_actions then
    return jsonb_build_object('status','daily_cap','actions_today',actions_today);
  end if;

  should_act := random() < case
    when local_hour >= 20 and actions_today < cfg.min_daily_actions then 0.82
    when actions_today < cfg.min_daily_actions then 0.46
    else 0.30
  end;

  if not should_act then
    return jsonb_build_object('status','idle','actions_today',actions_today);
  end if;

  select sp.* into actor
  from private.synthetic_personas sp
  where sp.enabled = true
    and (
      select count(*)
      from private.synthetic_activity_log l
      where l.actor_profile_id = sp.profile_id
        and timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
        and l.action_type <> 'seed'
    ) < sp.max_daily_actions
  order by random() / greatest(sp.activity_weight, 1)
  limit 1;

  if not found then
    return jsonb_build_object('status','persona_caps','actions_today',actions_today);
  end if;

  select count(*)::integer into actor_actions_today
  from private.synthetic_activity_log l
  where l.actor_profile_id = actor.profile_id
    and timezone(cfg.activity_timezone, l.created_at)::date = local_now::date
    and l.action_type <> 'seed';

  action_roll := random();

  -- New conversation starters are intentionally less common than replies.
  if action_roll < 0.10 then
    select template into selected_body
    from unnest(actor.post_templates) template
    where not exists (
      select 1
      from public.community_posts cp
      where cp.author_id = actor.profile_id
        and cp.body = template
        and cp.created_at > now() - interval '30 days'
    )
    order by random()
    limit 1;

    if selected_body is not null and btrim(selected_body) <> '' then
      select cgm.group_id into selected_group
      from public.community_group_members cgm
      where cgm.profile_id = actor.profile_id
      order by random()
      limit 1;

      insert into public.community_posts (
        author_id, group_id, audience, post_type, body, metadata, status
      ) values (
        actor.profile_id,
        selected_group,
        case when selected_group is null then 'everyone' else 'group' end,
        case when position('?' in selected_body) > 0 then 'ask' else 'update' end,
        selected_body,
        jsonb_build_object('synthetic_activity', true, 'persona_key', actor.persona_key),
        'published'
      ) returning id into inserted_id;

      insert into private.synthetic_activity_log (
        actor_profile_id, action_type, target_kind, target_id, context
      ) values (
        actor.profile_id, 'post', 'post', inserted_id,
        jsonb_build_object('group_id', selected_group)
      );

      return jsonb_build_object(
        'status','created','action','post','actor',actor.persona_key,'target_id',inserted_id
      );
    end if;
  end if;

  -- Prefer a recent post where this persona still has an unused reply template.
  select candidate.post_id, candidate.reply_body
  into target_post, selected_body
  from (
    select cp.id as post_id,
           reply_template.body as reply_body,
           cp.created_at,
           case when exists (
             select 1
             from public.community_group_members mine
             where mine.profile_id = actor.profile_id
               and mine.group_id = cp.group_id
           ) then 0 else 1 end as group_priority
    from public.community_posts cp
    join public.profiles author on author.id = cp.author_id
    cross join lateral (
      select template as body
      from unnest(actor.comment_templates) template
      where not exists (
        select 1
        from public.community_comments existing_comment
        where existing_comment.post_id = cp.id
          and existing_comment.author_id = actor.profile_id
          and existing_comment.body = template
      )
      order by random()
      limit 1
    ) reply_template
    where cp.status = 'published'
      and cp.author_id <> actor.profile_id
      and cp.created_at > now() - interval '21 days'
      and (cfg.target_real_member_content or author.is_synthetic = true)
      and not exists (
        select 1
        from public.community_blocks b
        where (b.blocker_id = actor.profile_id and b.blocked_id = cp.author_id)
           or (b.blocker_id = cp.author_id and b.blocked_id = actor.profile_id)
      )
      and not exists (
        select 1
        from private.synthetic_activity_log recent_actor_action
        where recent_actor_action.actor_profile_id = actor.profile_id
          and recent_actor_action.context ->> 'post_id' = cp.id::text
          and recent_actor_action.created_at > now() - interval '12 hours'
      )
    order by group_priority, cp.created_at desc, random()
    limit 1
  ) candidate;

  -- If every suitable thread was touched recently, relax only the 12-hour repeat window.
  if target_post is null then
    select candidate.post_id, candidate.reply_body
    into target_post, selected_body
    from (
      select cp.id as post_id,
             reply_template.body as reply_body,
             cp.created_at
      from public.community_posts cp
      join public.profiles author on author.id = cp.author_id
      cross join lateral (
        select template as body
        from unnest(actor.comment_templates) template
        where not exists (
          select 1
          from public.community_comments existing_comment
          where existing_comment.post_id = cp.id
            and existing_comment.author_id = actor.profile_id
            and existing_comment.body = template
        )
        order by random()
        limit 1
      ) reply_template
      where cp.status = 'published'
        and cp.author_id <> actor.profile_id
        and cp.created_at > now() - interval '21 days'
        and (cfg.target_real_member_content or author.is_synthetic = true)
        and not exists (
          select 1
          from public.community_blocks b
          where (b.blocker_id = actor.profile_id and b.blocked_id = cp.author_id)
             or (b.blocker_id = cp.author_id and b.blocked_id = actor.profile_id)
        )
      order by cp.created_at desc, random()
      limit 1
    ) candidate;
  end if;

  -- If no unused reply remains, react to a recent synthetic thread instead of duplicating text.
  if target_post is null then
    select cp.id into target_post
    from public.community_posts cp
    join public.profiles author on author.id = cp.author_id
    where cp.status = 'published'
      and cp.author_id <> actor.profile_id
      and cp.created_at > now() - interval '21 days'
      and (cfg.target_real_member_content or author.is_synthetic = true)
      and not exists (
        select 1 from public.community_reactions r
        where r.post_id = cp.id and r.profile_id = actor.profile_id
      )
    order by cp.created_at desc, random()
    limit 1;

    if target_post is null then
      return jsonb_build_object('status','idle','reason','no_fresh_target');
    end if;

    reaction_value := (array['like','love','celebrate','support'])[1 + floor(random() * 4)::integer];
    insert into public.community_reactions (post_id, profile_id, reaction)
    values (target_post, actor.profile_id, reaction_value)
    on conflict (post_id, profile_id) do nothing;

    insert into private.synthetic_activity_log (
      actor_profile_id, action_type, target_kind, target_id, context
    ) values (
      actor.profile_id, 'reaction', 'post', target_post,
      jsonb_build_object('reaction', reaction_value, 'post_id', target_post)
    );

    return jsonb_build_object(
      'status','created','action','reaction','actor',actor.persona_key,'target_id',target_post
    );
  end if;

  -- Some non-post activity becomes a reaction instead of a reply when one is still available.
  if action_roll >= 0.68 and not exists (
    select 1
    from public.community_reactions r
    where r.post_id = target_post and r.profile_id = actor.profile_id
  ) then
    reaction_value := (array['like','love','celebrate','support'])[1 + floor(random() * 4)::integer];
    insert into public.community_reactions (post_id, profile_id, reaction)
    values (target_post, actor.profile_id, reaction_value)
    on conflict (post_id, profile_id) do nothing;

    insert into private.synthetic_activity_log (
      actor_profile_id, action_type, target_kind, target_id, context
    ) values (
      actor.profile_id, 'reaction', 'post', target_post,
      jsonb_build_object('reaction', reaction_value, 'post_id', target_post)
    );

    return jsonb_build_object(
      'status','created','action','reaction','actor',actor.persona_key,'target_id',target_post
    );
  end if;

  selected_photo := null;
  if cardinality(actor.photo_paths) > 0 and random() < 0.18 then
    selected_photo := actor.photo_paths[1 + floor(random() * cardinality(actor.photo_paths))::integer];
  end if;

  insert into public.community_comments (
    post_id, author_id, body, image_paths, status
  ) values (
    target_post,
    actor.profile_id,
    selected_body,
    case when selected_photo is null then '{}'::text[] else array[selected_photo]::text[] end,
    'published'
  ) returning id into inserted_id;

  insert into private.synthetic_activity_log (
    actor_profile_id, action_type, target_kind, target_id, context
  ) values (
    actor.profile_id,
    case when selected_photo is null then 'comment' else 'photo_comment' end,
    'comment',
    inserted_id,
    jsonb_build_object('post_id', target_post)
  );

  result := jsonb_build_object(
    'status','created',
    'action',case when selected_photo is null then 'comment' else 'photo_comment' end,
    'actor',actor.persona_key,
    'target_id',target_post,
    'actions_today',actions_today + 1,
    'actor_actions_today',actor_actions_today + 1
  );

  return result;
end;
$$;

revoke all on function private.run_synthetic_activity_tick() from public, anon, authenticated;
grant execute on function private.run_synthetic_activity_tick() to service_role;
