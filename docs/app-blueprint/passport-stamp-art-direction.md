# Melanated Adventurers Passport Stamp Art Direction

## Purpose

Passport stamps are collectible visual records of completed Melanated Adventurers experiences. They are not generic badges, event cards, or screenshots cropped from collection boards. Each stamp is a native vector composition stored with the mobile application and tied to a specific event code.

The 2025 and 2026 collection boards are the visual reference for the system. They establish the vintage travel-poster / national-park-poster language, distressed print texture, bold display typography, event-specific illustration, integrated MA identity, date block, and location treatment.

## Collection language

### 2025 collection

- Rectangular vintage postage-stamp silhouette with perforated outer edge.
- Dense poster illustration that fills the stamp rather than floating inside a blank card.
- Cream paper edge with dark printed interior.
- Strong event title hierarchy.
- MA roundel incorporated into the stamp.
- Date block built into the artwork.
- Location integrated at the bottom.
- Palette changes by event while the collection remains visually related.

### 2026 collection

- Taller commemorative passport-plaque silhouette with a rounded / arched top.
- More cinematic illustrated scene with additional vertical breathing room.
- Cream outer keyline, dark saturated interior, distressed printed finish.
- MA identity, event title, date, and location are part of the stamp itself.
- The 2026 shape intentionally differs from 2025 so a member's Stamp Book develops visible eras over time.

## Approved event-specific designs

### MA Official Group Launch · March 4, 2025 · Jacksonville, FL

Visual story: the beginning of the community. Jacksonville skyline at sunrise with a small group of MA members in the foreground looking toward the city and the adventure ahead.

Palette: weathered teal, deep evergreen-black, warm sunrise gold, aged cream.

Stamp code: `legacy-event-2025-group-launch`

### Huguenot Park Camping Trip · March 28–30, 2025 · Huguenot Memorial Park · Jacksonville, FL

Visual story: coastal North Florida camping. Tent, campfire, palms / marsh landscape, and campers gathered around the fire.

Palette: pine green, moss, campfire orange, aged cream.

Stamp code: `legacy-event-2025-huguenot-camping`

### Great Melanated Float-Out · April 26, 2025 · North Florida

Visual story: a communal river float with multiple people in tubes, moving water, warm sun, and the sense of a group experience rather than a single generic water icon.

Palette: river teal, dark blue-green, sun orange, natural green, aged cream.

Stamp code: `legacy-event-2025-float-out`

### Black & Breezy: The Summer Cool-Down · June 20–22, 2025 · Tomoka State Park, FL

Visual story: sunset relaxation. Palms, water, hammock / lounging silhouette, and a deep summer-evening horizon.

Palette: plum, indigo, burnt coral, muted violet, aged cream.

Stamp code: `legacy-event-2025-black-breezy`

### Great Melanated Fire Dragon Conquest · July 12, 2025 · Jacksonville, FL

Visual story: fantasy-adventure interpretation of the event name. A dramatic dragon silhouette, fire, an adventurer facing the creature, and a smoky red-orange atmosphere.

Palette: oxblood, ember orange, black-brown, aged parchment.

Stamp code: `legacy-event-2025-fire-dragon`

### Great Melanated Wet & Wild Adventure · July 18, 2025 · Orlando / Kissimmee, FL

Visual story: a full water-park scene with large slides, water, tubes, and people. It should read as an energetic group outing rather than a generic wave symbol.

Palette: aqua teal, deep blue-green, sun yellow, weathered cream.

Stamp code: `legacy-event-2025-wet-wild`

### The Great Melanated Beach Escape · March 27–29, 2026 · Huguenot Memorial Park · Jacksonville, FL

Visual story: calm beach escape. Ocean, sunrise, palms, beach chairs with members looking over the water, and a small pier / coastal structure in the distance.

Emotional direction: relax, recharge, connect.

Palette: Atlantic teal, sunrise gold, sea-glass green, dark navy-green, aged cream.

Stamp code: `legacy-event-2026-beach-escape`

### The Great Melanated Float Out: Juneteenth Edition · June 20, 2026 · William F. Sheffield Regional Park · Jacksonville, FL

Visual story: community float-out on the water with multiple members in tubes. Juneteenth identity appears as a deliberate red / black / green flag detail rather than changing the entire MA brand palette.

Emotional direction: freedom, fun, community.

Palette: forest green, warm gold, river green, red / black / green accent, aged cream.

Stamp code: `legacy-event-2026-float-out-juneteenth`

### Melanated Adventures C.H.A.M.P.s Summer Session · July 23, 2026 · Jacksonville Area

Visual story: youth outdoor education. Tents, campfire, young participants, tree / mountain silhouettes, and a warm learning-around-the-fire atmosphere.

Emotional direction: learn, lead, explore.

Palette: burnt orange, dark brown, forest green, lantern gold, aged cream.

Stamp code: `legacy-event-2026-champs`

### Splash After Dark · July 25, 2026 · Island H2O · Orlando Area

Visual story: nighttime water park. Slides, pools, palms, moon, stars, and a group enjoying the water after dark. The design should feel neon-adjacent without becoming glossy or abandoning the distressed poster language.

Emotional direction: good vibes, big splashes.

Palette: midnight purple, indigo, electric blue-violet, moonlit cream.

Stamp code: `legacy-event-2026-splash-after-dark`

## Implementation rules

1. The collection-board images are references only. Do not crop them and ship the crops as production stamps.
2. The production source should remain editable and scalable. The current implementation uses `react-native-svg` vector artwork in `apps/mobile/src/passport/StampArt.tsx`.
3. Every approved legacy event must have unique scene composition, palette, date, and location.
4. A generic `MA` circle is not an acceptable substitute for an approved stamp.
5. Future events may temporarily lack a stamp, but should not be assigned fake earned artwork. Artwork is added when an event's visual design is approved.
6. 2025 and 2026 deliberately use different stamp silhouettes to make the Passport feel like a growing historical collection.
7. Stamp artwork should remain legible at mobile card size and support larger presentation on a stamp-detail / reflection screen without raster pixelation.
8. Do not bake the external event title and date into a second UI label if the same information is already clearly present inside the stamp unless accessibility or search context requires it.

## Current production mapping

The mobile Passport reads the earned stamp code and passes recognized legacy codes to `StampArt`. The redesign retains the same public `StampArt` and `isLegacyStampCode` API so the rest of the Passport data flow does not need to change.
