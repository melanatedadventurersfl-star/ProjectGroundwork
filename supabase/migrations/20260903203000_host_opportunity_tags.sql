alter table public.host_opportunities
  add column if not exists tags text[] not null default '{}';

comment on column public.host_opportunities.tags is
  'Host-defined labels for organizing saved opportunities. Tags are user-entered and are not identity or verification claims.';
