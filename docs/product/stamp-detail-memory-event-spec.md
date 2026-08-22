# Stamp Detail: Memory + Event Hub Specification

## Purpose

The Stamp Detail screen is the personal and social record attached to an earned adventure stamp. It separates the member's own memories from the shared event experience.

- **Stamp** answers: What did I earn?
- **My Memory** answers: What do I want to remember, and who was part of it?
- **Event** answers: What did the group share, and who can I connect with?

## Navigation and default state

- Earned stamps open with **My Memory** selected by default.
- The two top-level tabs are **My Memory** and **Event**.
- Unearned stamps remain preview-only and do not expose the event hub.

## My Memory

### Multiple memories

A stamp/adventure can contain any number of memory entries. A memory is a journal entry, not a single adventure-wide reflection.

Each memory may contain:

- optional title
- optional reflection/body text
- optional 1–5 rating
- zero or more photos
- zero or more tagged people
- visibility: **Private** or **Public**
- created/updated timestamps

A photo-only memory is valid.

### Photos belong to memories

Photos added while creating a memory are attached to that specific memory entry. The Stamp Detail screen no longer presents one separate, adventure-wide "Photo Memory" bucket.

### Tagging people

Members may tag multiple people in one memory when all of the following are true:

1. The tagged person participated in the same adventure.
2. The current member and tagged person have an accepted connection.

Pending connection requests cannot be tagged.

The Add Memory composer lists only eligible connected attendees. Existing historical tags remain part of a memory if the connection is later removed, but the person is no longer available for future tagging.

### Connected people section

The **My Memory** tab contains **Connected from this Adventure**.

- Shows accepted connections who participated in this adventure.
- Uses a compact avatar/name treatment.
- These are the people available for tagging in new memories.
- People with pending or no relationship do not appear here.

### Memory visibility

**Private** is the default for new memories.

- Private memory: visible only to the owner.
- Public memory: remains in My Memory and automatically appears under **Community Moments** for the adventure.
- Switching Public → Private removes it from Community Moments without deleting it.
- Switching Private → Public adds it to Community Moments without creating a duplicate.
- Attached photos follow the memory's visibility.

## Event

### Event Gallery

The Event tab contains an **Event Gallery** and **Add Photo** action.

Event photo upload supports:

- one or more photos
- optional caption
- visibility: **Public** or **Private**

**Public is the default for an Event photo upload.**

Behavior:

- Public event photo: enters moderation and automatically appears in the Event Gallery once approved.
- The uploader sees their own pending public photo in the gallery with a pending state.
- Private event photo: remains visible only to the uploader and never enters the shared gallery.
- Changing/removing the underlying content must remove it from the shared surface as appropriate.

Event Gallery photos and Memory photos are distinct publishing concepts. A public memory does not become an Event Gallery photo simply because it contains a photo.

### People you can connect to

The Event tab contains **People You Can Connect To**.

- Shows participating attendees who are not already connected to the current member.
- Accepted connections move out of this section and into My Memory's Connected from this Adventure section.

## Universal connection state model

Every connection affordance in the app must resolve from the same persisted `member_connections` relationship, not local screen state.

| Relationship | Button/state |
| --- | --- |
| No request exists | Connect |
| Current member sent pending request | Requested |
| Other member sent pending request | Accept |
| Accepted relationship | Connected |

Rules:

- **Requested must persist** after leaving and reopening the screen.
- If A sent B a request, B must see **Accept**, never a fresh Connect action.
- Selecting Accept updates the existing request to accepted.
- If a generic connect action encounters an incoming pending request, it accepts that request instead of creating a second request.
- The normalized user pair remains unique in `member_connections`.
- All screens should eventually consume this same direction-aware relationship state.

## Community Moments

Community Moments is the public-memory surface for the adventure.

- Reads public memory entries for that adventure.
- Displays the memory author, date, title/body when present, and tagged people.
- A member publishing a memory makes it appear here automatically.
- Making that memory private removes it automatically.
- Community Moments does not require the user to create a second community post.

## Data model

### `adventure_memories`

One row per memory entry.

Core fields:

- `id`
- `profile_id`
- `adventure_id`
- `title`
- `body`
- `rating`
- `visibility` (`private`, `public`)
- `created_at`
- `updated_at`

Existing `adventure_reflections` rows are migrated into an initial memory entry for backwards compatibility.

### `adventure_memory_tags`

Many-to-many memory tags.

- `memory_id`
- `tagged_profile_id`
- `created_at`

Insert policy requires an accepted connection and participation in the same adventure.

### `adventure_memory_photos`

Adds:

- `memory_id` for photos attached to a memory
- `source_kind = event_upload` for photos uploaded directly to the Event surface

Source semantics:

- `personal`: member-owned photo attached to a personal memory
- `event_gallery`: a private saved copy of an existing gallery photo
- `event_upload`: a direct event-photo upload, eligible for the Event Gallery when public and approved

## Moderation and privacy

- Existing photo moderation remains in force.
- Public photo content is not exposed to other members until approved.
- Owners may see their own pending uploads.
- Public memory text is readable through the Community Moments surface.
- Memory-tag write access is enforced server-side, not only by the UI.

## Acceptance criteria

1. An earned stamp opens to My Memory.
2. A member can create at least two separate memories for the same stamp and both persist.
3. Each memory can contain multiple photos.
4. A memory can tag multiple accepted connections from the same adventure.
5. A pending/non-connected attendee cannot be tagged.
6. Public memories appear in Community Moments; private memories do not.
7. Toggling a memory's visibility updates Community Moments without duplicating or deleting the memory.
8. My Memory shows connected attendees only.
9. Event shows non-connected attendees with Connect, Requested, or Accept based on persisted relationship direction.
10. A sent request still displays Requested after navigating away and returning.
11. An incoming request displays Accept and accepting it produces one accepted connection.
12. Once connected, that attendee moves from Event to My Memory after state refresh/update.
13. Event photo uploads default to Public.
14. Approved public event photos appear automatically in the Event Gallery.
15. Private event photos never appear to other members in the Event Gallery.
16. The uploader can see a pending state for their own public Event photo while moderation is in progress.
