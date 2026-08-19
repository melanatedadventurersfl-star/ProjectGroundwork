# Melanated Adventures Passport Stamp Library

This folder is the canonical visual source for Passport event stamps used in the mobile app.

## Core rules

- One event stamp per image file. Never store or ship stamp sheets, collages, or cropped sections of a larger composition.
- Each stamp must be a complete standalone asset with the full silhouette visible.
- Master assets should be high-resolution PNG files with transparency outside the stamp silhouette.
- Do not bake a square or rectangular background behind the stamp.
- The app should render stamp art with `contain`, never `cover`, so perforations, arches, and outer edges are never cropped.
- Preserve readable event title, date, location, and MA identity within the stamp artwork.
- People shown in event artwork should be melanated unless the stamp intentionally contains no people.
- Artwork should feel collectible, travel-oriented, and specific to the event experience rather than generic outdoor stock art.
- Approved artwork is the source of truth. Do not substitute legacy SVGs, temporary placeholders, or low-resolution raster copies.

## Asset quality

- Recommended master size: at least 1024 px on the long side.
- Preferred format: transparent PNG.
- Use clean alpha around the stamp silhouette.
- Avoid compression artifacts, progressive JPEGs, or tiny production sources that become blurry when scaled.
- Keep distressed texture inside the design, but keep the outer asset edge clean enough for app rendering.

## Naming convention

Use stable lowercase filenames with the year first:

`YYYY-event-slug.png`

Examples:

- `2025-group-launch.png`
- `2025-huguenot-camping.png`
- `2025-float-out.png`
- `2026-beach-escape.png`
- `2026-splash-after-dark.png`

The filename should remain stable even if marketing copy changes later.

## 2025 visual system

**Shape:** perforated rectangular postage stamp.

**Art direction:** vintage travel-poster / screen-print illustration with aged paper, distressed ink, retro typography, and strong event-specific scenery.

**Shared characteristics:**

- Cream perforated postage edge
- Rectangular portrait silhouette
- Vintage print grain and distressed texture
- Bold retro headline typography
- Event date shown as a clear stamp/date block
- Location shown in a dedicated footer or destination panel
- MA seal or medallion integrated into the composition
- Each event may use its own palette while retaining the same structural family

Current 2025 collection:

- MA Official Group Launch
- Huguenot Park Camping Trip
- Great Melanated Float-Out
- Black & Breezy: The Summer Cool-Down
- Great Melanated Fire Dragon Conquest
- Great Melanated Wet & Wild Adventure

## 2026 visual system

**Shape:** tall rounded-arch travel label.

**Art direction:** vintage destination badge / travel-label illustration with a cream aged border, arched top, distressed print texture, and a more vertically framed scene than the 2025 postage stamps.

**Shared characteristics:**

- Tall rounded-arch silhouette
- Cream distressed outer edge
- Strong title hierarchy in the upper portion
- Event illustration fills the central field
- Date block integrated on the side or within the label structure
- Location anchored at the bottom
- MA identity integrated into the art
- Event-specific color palette while preserving the shared 2026 silhouette

Current 2026 collection:

- The Great Melanated Beach Escape
- Float Out: Juneteenth Edition
- C.H.A.M.P.s Summer Session
- Splash After Dark

## 2027 visual system

**Status: design direction not yet locked.**

2027 must introduce a clearly new annual silhouette while still reading as part of the same Passport collection. Do not reuse the 2025 perforated rectangle or the 2026 rounded-arch label as the primary shape.

The 2027 system should retain these collection-wide traits:

- Strong year-specific silhouette
- Vintage collectible travel identity
- Full event title, date, and location integrated into the stamp
- MA identity present but secondary to the event
- Event-specific illustration and palette
- Distressed print or tactile analog texture
- High legibility at mobile-card size
- Transparent standalone PNG masters

Once the 2027 shape, border treatment, typography system, and information hierarchy are approved, document them here before producing the full 2027 collection.

## App implementation rules

- Map event/stamp codes to explicit local image assets.
- Never infer artwork from titles at runtime.
- Never crop a stamp from a contact sheet.
- Never upscale a tiny thumbnail into production use.
- Keep legacy artwork separate from the active approved collection.
- If an approved stamp is missing, fail visibly in development rather than silently substituting unrelated artwork.

## Recommended metadata per stamp

Each stamp record should ultimately include:

- `code`
- `year`
- `eventTitle`
- `eventDate`
- `location`
- `assetPath`
- `adventureId` when applicable
- `status` (`draft`, `approved`, `live`, `retired`)
- `version`

Only `approved` or `live` assets should appear in production Passport views.
