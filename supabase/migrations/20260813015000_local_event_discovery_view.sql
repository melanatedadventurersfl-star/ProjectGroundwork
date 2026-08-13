create or replace view public.local_event_discovery as
select
  e.id,
  e.host_id,
  coalesce(p.display_name, p.first_name, 'Member host') as host_name,
  e.title,
  e.description,
  e.category,
  e.starts_at,
  e.ends_at,
  e.city,
  e.state,
  e.venue_name,
  e.meeting_details,
  e.image_url,
  e.capacity,
  e.is_free,
  e.status,
  e.group_id,
  count(r.profile_id) filter (where r.status <> 'cancelled')::int as rsvp_count
from public.local_events e
join public.profiles p on p.id = e.host_id
left join public.local_event_rsvps r on r.local_event_id = e.id
where e.status in ('published', 'completed')
group by e.id, p.display_name, p.first_name;

grant select on public.local_event_discovery to authenticated;
