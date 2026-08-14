alter table public.adventure_memory_photos
  add column if not exists moderation_source text,
  add column if not exists moderation_score numeric,
  add column if not exists moderation_reason text,
  add column if not exists moderation_categories jsonb not null default '{}'::jsonb,
  add column if not exists moderation_model text;

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_moderation_source_check;

alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_moderation_source_check
  check (moderation_source is null or moderation_source in ('ai', 'human'));

alter table public.adventure_memory_photos
  drop constraint if exists adventure_memory_photos_moderation_score_check;

alter table public.adventure_memory_photos
  add constraint adventure_memory_photos_moderation_score_check
  check (moderation_score is null or (moderation_score >= 0 and moderation_score <= 1));
