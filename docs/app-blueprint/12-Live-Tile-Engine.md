# 12 — Live Tile Engine Specification

## Purpose

Define the reusable system that powers the Trailhead dashboard and selected informational surfaces across the app.

## Product Role

The Live Tile Engine replaces a conventional home feed with a glanceable, personalized view of the member's adventure life.

A member should understand within seconds:

1. What is happening next?
2. What requires attention?
3. What is new in the community?
4. How am I progressing?

## Tile Anatomy

Every tile may contain:

- title;
- icon or category marker;
- primary content;
- supporting content;
- background image, illustration, or semantic surface;
- status indicator;
- notification count;
- action target;
- optional content rotation;
- optional countdown;
- accessibility label.

## Tile Sizes

- Small: 1 × 1 grid unit
- Medium: 2 × 1
- Square: 2 × 2
- Wide: 4 × 1
- Hero: 4 × 2

Not every tile supports every size. Each tile declares approved variants.

## Launch Tiles

- Next Adventure
- Explore
- Community
- Passport
- Campfire
- Weather
- Featured Adventure
- My Journey
- Packing / Preparation
- Trail Mark Progress

## Priority Model

Tiles are ranked by:

1. safety and urgent changes;
2. time-sensitive adventure preparation;
3. upcoming registered adventures;
4. direct member activity;
5. discovery and inspiration;
6. progress and memories.

An urgent update may temporarily replace the rotating content of a relevant tile but cannot silently rearrange the dashboard.

## Content Rotation

A tile may rotate through up to four related messages.

Rules:

- minimum five seconds per message;
- user interaction pauses rotation;
- urgent messages remain fixed;
- content order is deterministic, not random;
- reduced-motion mode uses a fade or static highest-priority message;
- screen readers receive a stable summary rather than repeated announcements.

## Example Configuration

```json
{
  "type": "next_adventure",
  "size": "hero",
  "title": "Next Adventure",
  "action": "/adventures/123/hub",
  "priority": "high",
  "slides": [
    { "kind": "countdown", "value": "3 days" },
    { "kind": "status", "value": "Packing list ready" },
    { "kind": "weather", "value": "82°F • rain possible" }
  ]
}
```

## States

Each tile supports:

- loading;
- ready;
- no data;
- offline cached;
- unavailable;
- urgent;
- disabled by permission;
- personalization preview.

## Dashboard Layout

### Default launch layout

```text
[Next Adventure — Hero]
[Community] [Passport]
[Weather]   [Featured]
[My Journey — Wide]
```

Members without an upcoming adventure see Explore as the hero tile.

## Personalization

### Launch

- pin or unpin optional tiles;
- reorder optional tiles;
- restore default layout.

### Later

- resize approved tiles;
- multiple dashboard presets;
- chapter and host widgets;
- third-party widgets.

Critical tiles cannot be permanently removed when they contain urgent information.

## Edit Mode

Activated through a visible Customize action or long press.

In edit mode:

- tiles show drag handles;
- removable tiles show a remove control;
- supported sizes are selectable;
- changes are previewed before save;
- keyboard and assistive alternatives are provided.

## Data Contract

A tile adapter transforms domain data into a stable presentation model. UI components do not fetch raw domain objects directly.

Required fields:

- id
- type
- title
- size
- state
- priority
- action
- analytics context
- accessibility summary

Optional fields:

- slides
- image
- count
- timestamp
- badge
- progress
- cached timestamp

## Performance

- initial Trailhead shell renders before remote tile data;
- cached content appears where safe;
- imagery is responsive and lazy loaded;
- animation does not block interaction;
- failures are isolated to the affected tile;
- tile updates do not trigger full-dashboard rerenders.

## Analytics

Track:

- tile impressions;
- tile taps;
- slide displayed at tap;
- customization actions;
- dismissed optional tiles;
- recovery from tile errors;
- conversion from tile to adventure registration or preparation task.

Analytics must not expose private content in event names.

## Accessibility

- tiles are operable as single clear controls;
- nested actions are avoided;
- reading order matches visual order;
- drag-and-drop has move-up/move-down alternatives;
- countdowns include absolute dates;
- image backgrounds have sufficient overlays;
- rotation never steals focus.

## Security and Privacy

Private details must not appear on the lock screen or shared dashboard screenshots by default. Sensitive tiles should use generalized copy until the app is authenticated.

## Current Decisions

- Trailhead is tile-based rather than feed-based.
- Tile content is driven by adapters and semantic priority.
- Useful rotation is allowed, decorative rotation is not.
- Default layouts adapt to whether a member has an upcoming adventure.

## Open Questions

- Whether resizing belongs in launch or the first post-launch release.
- How many optional tiles should be available at launch.
- Whether weather is tied only to registered adventures or also the home location.

## Decision History

- Version 1.0 defines the launch engine, data contract, behavior, and accessibility rules.