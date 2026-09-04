alter table public.host_opportunities
  add column if not exists notes text not null default '',
  add column if not exists follow_up_at timestamptz;

comment on column public.host_opportunities.notes is
  'Private host notes about the opportunity.';
comment on column public.host_opportunities.follow_up_at is
  'Optional host follow-up date used for Needs Attention.';

create index if not exists host_opportunities_follow_up_idx
  on public.host_opportunities(owner_profile_id, follow_up_at)
  where follow_up_at is not null and stage <> 'archived';
