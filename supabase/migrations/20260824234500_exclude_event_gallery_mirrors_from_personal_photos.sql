-- Event-gallery mirror rows are presentation copies, not additional personal memories.
-- Keep the mirror available to the shared gallery while preventing it from being
-- counted again in the owner's profile photo albums.

alter table public.adventure_memory_photos
  alter column profile_id drop not null;

update public.adventure_memory_photos
set profile_id = null
where source_kind = 'event_upload'
  and source_photo_id is not null;

create or replace function public.sync_public_memory_photo_event_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.source_kind = 'personal' then
      delete from public.adventure_memory_photos
      where source_kind = 'event_upload'
        and source_photo_id = old.id;
    end if;
    return old;
  end if;

  if new.source_kind <> 'personal' then
    return new;
  end if;

  if new.visibility = 'public' then
    insert into public.adventure_memory_photos (
      profile_id,
      adventure_id,
      memory_id,
      image_url,
      caption,
      reflection,
      visibility,
      featured,
      source_kind,
      source_photo_id,
      media_type,
      moderation_status,
      created_at
    ) values (
      null,
      new.adventure_id,
      new.memory_id,
      new.image_url,
      new.caption,
      new.reflection,
      'public',
      false,
      'event_upload',
      new.id,
      new.media_type,
      new.moderation_status,
      new.created_at
    )
    on conflict (source_photo_id) where source_kind = 'event_upload' and source_photo_id is not null
    do update set
      profile_id = null,
      adventure_id = excluded.adventure_id,
      memory_id = excluded.memory_id,
      image_url = excluded.image_url,
      caption = excluded.caption,
      reflection = excluded.reflection,
      visibility = 'public',
      media_type = excluded.media_type,
      moderation_status = excluded.moderation_status;
  else
    delete from public.adventure_memory_photos
    where source_kind = 'event_upload'
      and source_photo_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_public_memory_photo_event_mirror() from public;
