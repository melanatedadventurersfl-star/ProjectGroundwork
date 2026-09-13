-- Camping completeness is database-enforced so a future ingestion run cannot
-- mark a campground complete while pricing or booking research is still absent.
-- Explicit dynamic and not-published pricing states count as researched.

create or replace function public.calculate_trail_guide_camping_completeness(p_place_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
with current_facts as (
  select f.field_key, f.value
  from public.trail_guide_facts f
  join public.trail_guide_sources s on s.id = f.source_id
  where f.place_id = p_place_id
    and f.is_current = true
    and s.status = 'active'
),
base_required(field_key) as (
  values
    ('visit.hours'),
    ('visit.admission'),
    ('parking.available'),
    ('amenities.restrooms'),
    ('pets.allowed'),
    ('camping.tent'),
    ('camping.rv'),
    ('camping.site_count'),
    ('electric.available'),
    ('water.hookup'),
    ('water.potable_central'),
    ('sewer.hookup'),
    ('dump_station.available'),
    ('amenities.showers'),
    ('check_in.time'),
    ('check_out.time'),
    ('quiet_hours.range')
),
base_score as (
  select count(*)::integer as points
  from base_required r
  where exists (
    select 1
    from current_facts f
    where f.field_key = r.field_key
  )
),
pricing as (
  select
    lower(coalesce((select value #>> '{}' from current_facts where field_key = 'pricing.status' limit 1), '')) as status,
    exists (
      select 1
      from current_facts
      where field_key in (
        'pricing.tent_base', 'pricing.tent_total',
        'pricing.rv_base', 'pricing.rv_total',
        'pricing.primitive_base', 'pricing.primitive_total',
        'pricing.electric_base', 'pricing.electric_total',
        'pricing.full_hookup_base', 'pricing.full_hookup_total',
        'pricing.cabin_base', 'pricing.cabin_total'
      )
    ) as has_rate,
    exists (select 1 from current_facts where field_key = 'pricing.currency') as has_currency
),
booking as (
  select
    lower(coalesce((select value #>> '{}' from current_facts where field_key = 'reservations.available' limit 1), '')) as availability,
    exists (
      select 1
      from current_facts
      where field_key = 'reservations.url'
        and nullif(value #>> '{}', '') is not null
    )
    or exists (
      select 1
      from public.trail_guide_sources
      where place_id = p_place_id
        and status = 'active'
        and source_type = 'reservation'
        and nullif(source_url, '') is not null
    ) as has_booking_path
),
points as (
  select
    base_score.points
    + case when booking.availability in ('true', 'false') then 1 else 0 end
    + case
        when booking.availability = 'false' then 1
        when booking.availability = 'true' and booking.has_booking_path then 1
        else 0
      end
    + case when pricing.status in ('published', 'dynamic', 'varies_by_date', 'not_published') then 1 else 0 end
    + case
        when pricing.status = 'published' and pricing.has_rate and pricing.has_currency then 1
        when pricing.status in ('dynamic', 'varies_by_date', 'not_published') then 1
        else 0
      end as earned
  from base_score, pricing, booking
)
select least(100, greatest(0, round((earned::numeric / 21::numeric) * 100)::integer))
from points;
$$;

create or replace function public.refresh_trail_guide_camping_completeness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id text;
begin
  if tg_op = 'DELETE' then
    v_place_id := old.place_id;
  else
    v_place_id := new.place_id;
  end if;

  update public.trail_guide_place_profiles
  set completeness_score = public.calculate_trail_guide_camping_completeness(v_place_id),
      updated_at = now()
  where place_id = v_place_id
    and category = 'Camping';

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_trail_guide_camping_completeness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category = 'Camping' then
    new.completeness_score := public.calculate_trail_guide_camping_completeness(new.place_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trail_guide_facts_refresh_camping_completeness on public.trail_guide_facts;
create trigger trail_guide_facts_refresh_camping_completeness
after insert or update or delete on public.trail_guide_facts
for each row execute function public.refresh_trail_guide_camping_completeness();

drop trigger if exists trail_guide_sources_refresh_camping_completeness on public.trail_guide_sources;
create trigger trail_guide_sources_refresh_camping_completeness
after insert or update or delete on public.trail_guide_sources
for each row execute function public.refresh_trail_guide_camping_completeness();

drop trigger if exists trail_guide_profiles_enforce_camping_completeness on public.trail_guide_place_profiles;
create trigger trail_guide_profiles_enforce_camping_completeness
before update of completeness_score, category on public.trail_guide_place_profiles
for each row execute function public.enforce_trail_guide_camping_completeness();

update public.trail_guide_place_profiles
set completeness_score = public.calculate_trail_guide_camping_completeness(place_id),
    updated_at = now()
where category = 'Camping';
