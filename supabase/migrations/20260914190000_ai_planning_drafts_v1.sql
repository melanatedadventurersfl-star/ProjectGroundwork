alter table public.host_event_imports drop constraint if exists host_event_imports_source_type_check;
alter table public.host_event_imports
  add constraint host_event_imports_source_type_check
  check (source_type in ('event_site','file_url','pasted_text','template','uploaded_files','ai_planner'));

create index if not exists host_event_imports_ai_planner_idx
  on public.host_event_imports(organization_id, owner_profile_id, updated_at desc)
  where source_type = 'ai_planner' and status = 'preview';
