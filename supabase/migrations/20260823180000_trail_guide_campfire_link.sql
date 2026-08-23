alter table public.local_events
add column if not exists trail_guide_place_id text;

create index if not exists local_events_trail_guide_place_id_idx
on public.local_events (trail_guide_place_id)
where trail_guide_place_id is not null;

create or replace view public.local_event_discovery
with (security_invoker = true)
as
select e.id, e.host_id, coalesce(p.display_name, 'Member host') as host_name,
       e.title, e.description, e.category, e.starts_at, e.ends_at, e.city, e.state,
       e.venue_name, e.meeting_details, e.image_url, e.capacity, e.is_free,
       e.status, e.group_id, e.trail_guide_place_id,
       count(r.profile_id) filter (where r.status <> 'cancelled')::integer as rsvp_count
from public.local_events e
left join public.profile_directory p on p.id = e.host_id
left join public.local_event_rsvps r on r.local_event_id = e.id
group by e.id, p.display_name;

revoke all on public.local_event_discovery from anon;
grant select on public.local_event_discovery to authenticated, service_role;
