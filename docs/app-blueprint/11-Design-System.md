# 11 — Design System

## Purpose

Create a visual and interaction language that feels unmistakably Melanated Adventurers while remaining accessible, scalable, and practical to build.

## Experience Direction

The interface should feel like a modern field journal illuminated by a campfire: grounded, warm, photographic, and alive. It should not feel rustic, cluttered, or costume-like.

## Brand Attributes

- Welcoming
- Adventurous
- Black-centered
- Capable
- Warm
- Premium
- Practical
- Story-rich

## Color Roles

Final hex values will be validated during visual prototyping. The system begins with semantic roles rather than decoration.

### Foundation

- `surface-deep`: primary dark background
- `surface-raised`: cards and tiles
- `surface-warm`: passport and journal surfaces
- `text-primary`: highest contrast text
- `text-secondary`: supporting copy
- `border-subtle`: separators and inactive outlines

### Brand accents

- `forest`: exploration and primary actions
- `ember`: Campfire, urgency, and warmth
- `sun`: progress, Trail Marks, and celebration
- `water`: paddling, weather, and informational states
- `earth`: Passport and memory surfaces

### Status

- success
- warning
- danger
- information
- disabled

Color is never the only status indicator.

## Typography

Use a two-family system:

1. **Display face** for large titles, adventure names, and Passport moments.
2. **Interface sans-serif** for navigation, controls, logistics, and body text.

Requirements:

- excellent mobile readability;
- broad weight range;
- tabular numerals for countdowns and prices;
- strong accessibility at small sizes;
- no decorative script fonts in functional UI.

## Type Scale

- Display: 40–48
- Page title: 28–32
- Section title: 22–24
- Card title: 18–20
- Body: 16
- Supporting: 14
- Label: 12–13

Body text must not fall below 16 px by default.

## Spacing

Base unit: 8 px.

Common tokens:

- 4: micro spacing
- 8: compact
- 16: standard
- 24: section spacing
- 32: major separation
- 48+: immersive breathing room

## Grid

### Mobile

- 4-column tile grid
- 16 px outer margin
- 8–12 px gutters
- tiles span 1, 2, or 4 columns

### Larger screens

- responsive 8- or 12-column grid
- content width constrained for readability
- mobile information hierarchy remains intact

## Shape

- Tiles: modest radius, not pill-shaped
- Buttons: medium radius
- Passport elements: slightly softer corners
- Status chips: compact pills
- Photography: edge-to-edge or contained according to context

Avoid excessive rounded-card soup.

## Elevation

Use depth sparingly:

- base surface
- raised card
- floating navigation/action
- modal/dialog

Prefer contrast, border, and layering over dramatic shadows.

## Iconography

- simple line icons with selected filled states;
- consistent stroke weight;
- recognizable symbols before branded vocabulary;
- labels accompany unfamiliar icons;
- custom icons reserved for Passport, Trail Marks, Campfire, and chapters.

## Photography

Photography is a primary storytelling material.

Rules:

- center Black and brown people authentically;
- show participation, joy, preparation, and rest;
- avoid generic stock-photo posing;
- reflect varied ages, body types, abilities, and experience levels;
- preserve environmental context;
- avoid placing critical text over visually noisy areas;
- never use duplicate people within the same designed scene.

## Illustration and Texture

Approved motifs:

- topographic contours
- map grids
- passport stamps
- trail markers
- subtle paper grain
- compass and coordinate details

Textures remain low contrast and never reduce legibility.

## Motion

Motion should communicate state and vitality.

### Approved uses

- live-tile content transitions;
- progress and check-in confirmation;
- Passport stamp arrival;
- Campfire activity arrival;
- page hierarchy transitions;
- drag-and-drop dashboard editing.

### Timing

- micro interaction: 100–180 ms
- standard transition: 180–280 ms
- celebratory moment: up to 600 ms

Reduced-motion settings must replace rotation, parallax, and large movement with fades or instant changes.

## Live Tile Visual Rules

- one primary message at a time;
- text remains readable over imagery;
- urgent content does not rotate away;
- no auto-rotation faster than five seconds;
- pause when screen reader or reduced-motion mode is active;
- notification counts remain stable while content rotates.

## Passport Visual Rules

- warm paper-inspired surfaces;
- identity page is formal and uncluttered;
- stamps may be expressive but must include readable labels;
- achievements cannot rely solely on ornamental graphics;
- stats use clear numeric hierarchy.

## Campfire Visual Rules

- ember accent identifies the hub;
- urgent logistics use explicit warning treatment, not decorative flames;
- activity cards distinguish operational, social, and achievement events;
- unread status is clear but calm.

## Controls

Minimum touch target: 44 × 44 px.

Buttons:

- Primary
- Secondary
- Tertiary/text
- Destructive
- Icon-only, with accessible label

Forms:

- persistent field labels;
- inline validation;
- visible focus states;
- clear required/optional language;
- keyboard-appropriate inputs.

## Accessibility Baseline

- WCAG 2.2 AA target;
- sufficient contrast in all themes;
- dynamic text support;
- logical focus order;
- complete screen-reader labels;
- captions and alt text for media;
- no essential information communicated by color, sound, or motion alone;
- offline and low-connectivity behavior treated as accessibility concerns.

## Themes

Launch should support a dark-first brand theme. Architecture must allow a light or high-contrast theme later without redesigning components.

## Content Voice

- warm, direct, and capable;
- never condescending to beginners;
- logistical copy is plain and explicit;
- branded terms are introduced with context;
- errors explain what happened and what to do next.

## Current Decisions

- Dark-first visual foundation.
- Photography and live tiles lead the Trailhead.
- Passport receives a distinct warm-paper subtheme.
- Ember is reserved primarily for Campfire and urgency.
- Accessibility requirements are component-level standards.

## Open Questions

- Final font families and licensing.
- Exact color values after contrast testing.
- Whether the app launches with one theme or dark/light selection.
- Degree of texture appropriate for lower-end devices.

## Decision History

- Version 1.0 defines the semantic visual system before final high-fidelity mockups.