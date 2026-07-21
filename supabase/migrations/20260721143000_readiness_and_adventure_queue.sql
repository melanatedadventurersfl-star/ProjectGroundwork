create type public.readiness_category as enum ('registration','waiver','transportation','meal','packing','emergency','payment','other');
create type public.readiness_status as enum ('not_started','in_progress','complete','blocked','waived');

create table public.adventure_requirements (
  id uuid primary key default gen_random_uuid(),
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  category public.readiness_category not null,
  title text not null,
  description text,
  due_at timestamptz,
  is_required boolean not null default true,
  blocks_check_in boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_readiness_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  adventure_id uuid not null references public.adventures(id) on delete cascade,
  requirement_id uuid references public.adventure_requirements(id) on delete cascade,
  category public.readiness_category not null,
  title text not null,
  description text,
  due_at timestamptz,
  status public.readiness_status not null default 'not_started',
  is_required boolean not null default true,
  blocks_check_in boolean not null default false,
  completion_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, order_id, requirement_id)
);

create trigger adventure_requirements_set_updated_at
before update on public.adventure_requirements
for each row execute function public.set_updated_at();

create trigger member_readiness_items_set_updated_at
before update on public.member_readiness_items
for each row execute function public.set_updated_at();

create or replace function public.seed_member_readiness(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_order public.orders;
begin
  select * into target_order
  from public.orders
  where id = p_order_id and purchaser_id = auth.uid();

  if target_order.id is null then
    raise exception 'Order not found';
  end if;

  insert into public.member_readiness_items (
    profile_id, order_id, adventure_id, requirement_id, category, title,
    description, due_at, is_required, blocks_check_in
  )
  select auth.uid(), target_order.id, target_order.adventure_id, r.id, r.category,
    r.title, r.description, r.due_at, r.is_required, r.blocks_check_in
  from public.adventure_requirements r
  where r.adventure_id = target_order.adventure_id
  on conflict (profile_id, order_id, requirement_id) do nothing;
end;
$$;

create or replace view public.member_adventure_queue as
select
  o.id as order_id,
  o.purchaser_id as profile_id,
  a.id as adventure_id,
  a.title,
  a.summary,
  a.starts_at,
  a.ends_at,
  a.city,
  a.state,
  a.venue_name,
  o.status as order_status,
  count(mri.id) filter (where mri.is_required) as required_count,
  count(mri.id) filter (where mri.is_required and mri.status in ('complete','waived')) as completed_required_count,
  count(mri.id) filter (where mri.status = 'blocked' or (mri.blocks_check_in and mri.status not in ('complete','waived'))) as blocker_count,
  coalesce(
    round(
      100.0 * count(mri.id) filter (where mri.is_required and mri.status in ('complete','waived'))
      / nullif(count(mri.id) filter (where mri.is_required), 0)
    )::integer,
    100
  ) as readiness_score,
  min(mri.due_at) filter (where mri.status not in ('complete','waived')) as next_due_at
from public.orders o
join public.adventures a on a.id = o.adventure_id
left join public.member_readiness_items mri on mri.order_id = o.id and mri.profile_id = o.purchaser_id
where o.status in ('paid','confirmed')
group by o.id, a.id;

alter table public.adventure_requirements enable row level security;
alter table public.member_readiness_items enable row level security;

create policy "Published adventure requirements are readable"
on public.adventure_requirements for select
using (exists (
  select 1 from public.adventures a
  where a.id = adventure_requirements.adventure_id
    and a.status in ('published','sold_out','completed')
));

create policy "Members read their readiness"
on public.member_readiness_items for select
using (auth.uid() = profile_id);

create policy "Members update their readiness"
on public.member_readiness_items for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

grant select on public.member_adventure_queue to authenticated;
grant execute on function public.seed_member_readiness(uuid) to authenticated;
