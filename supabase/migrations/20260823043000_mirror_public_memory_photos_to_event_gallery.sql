create unique index if not exists adventure_memory_photos_event_mirror_unique
on public.adventure_memory_photos (source_photo_id)
where source_kind = 'event_upload' and source_photo_id is not null;

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
      new.profile_id,
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
      profile_id = excluded.profile_id,
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

drop trigger if exists sync_public_memory_photo_event_mirror_trigger on public.adventure_memory_photos;
create trigger sync_public_memory_photo_event_mirror_trigger
after insert or update of visibility, moderation_status, caption, reflection, image_url, memory_id or delete
on public.adventure_memory_photos
for each row
execute function public.sync_public_memory_photo_event_mirror();

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
)
select
  p.profile_id,
  p.adventure_id,
  p.memory_id,
  p.image_url,
  p.caption,
  p.reflection,
  'public',
  false,
  'event_upload',
  p.id,
  p.media_type,
  p.moderation_status,
  p.created_at
from public.adventure_memory_photos p
where p.source_kind = 'personal'
  and p.visibility = 'public'
on conflict (source_photo_id) where source_kind = 'event_upload' and source_photo_id is not null
do update set
  profile_id = excluded.profile_id,
  adventure_id = excluded.adventure_id,
  memory_id = excluded.memory_id,
  image_url = excluded.image_url,
  caption = excluded.caption,
  reflection = excluded.reflection,
  visibility = 'public',
  media_type = excluded.media_type,
  moderation_status = excluded.moderation_status;
