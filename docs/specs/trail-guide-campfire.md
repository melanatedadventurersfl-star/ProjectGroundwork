# Trail Guide → Campfire

## Goal

Allow a member to turn any Trail Guide place into a casual Campfire without re-entering the place information, while preserving a permanent link between the Campfire and the Trail Guide destination.

## Entry point

Every Trail Guide place detail screen includes a prominent **Start Campfire** action directly below the summary and tags and before the rest of the place details.

The action should explain that the member is creating a casual, member-led plan at the selected place.

## Creation flow

Selecting **Start Campfire** opens the existing Campfire creation screen and passes the Trail Guide place context:

- Trail Guide place ID
- Place name
- Area
- Trail Guide city key
- Category

The Campfire composer pre-populates:

- Title: `<Place name> meetup`
- Description: `Thinking about heading to <Place name>. Who wants to join?`
- Venue: the Trail Guide place name
- State: Florida for current Trail Guide destinations
- City: Jacksonville or Orlando from the Trail Guide city key
- Campfire category mapped from the Trail Guide category

All pre-populated fields remain editable before publishing.

## Visual treatment

When the composer was opened from Trail Guide, it uses a **TRAIL GUIDE CAMPFIRE** eyebrow and displays a context card with the source place, area, and category. The rest of the Campfire creation flow remains unchanged.

## Persistence

`local_events` stores `trail_guide_place_id` when a Campfire originates from Trail Guide. `local_event_discovery` exposes the field so the relationship survives navigation, reloads, and future feed surfaces.

## Campfire detail

A Campfire with a Trail Guide origin shows a **FROM TRAIL GUIDE** card near the top of its detail page. Tapping the card opens the original Trail Guide place.

## Permissions

This feature does not bypass Campfire hosting permissions. Members who cannot create Campfires continue to see the existing hosting-access message.

## Data model

`public.local_events.trail_guide_place_id text null`

An index is added for non-null Trail Guide place IDs so future place-level Campfire queries can be efficient.

## Future extension

The persisted relationship enables the Trail Guide place screen to later show active Campfires for that location, conversation counts, and a direct path from Trail Guide → Campfire → Adventure without changing the current data model again.
