# Melanated Adventurers Passport Stamp System

Status: APPROVED
Approved: 2026-08-14

## Core decision

The collection boards are style, mood, and composition references only. They are not production assets. Do not crop, slice, or reuse any composite board image in the app.

Each stamp must be built as its own standalone asset or component and stored permanently in the repository.

## Stamp families

### 2025 collection
- Rectangular perforated postage-stamp silhouette
- Vintage printed poster composition
- Distressed texture and imperfect ink feel
- Compact scene with strong title hierarchy
- Integrated MA seal, location, and date block

### 2026 collection
- Tall arched commemorative passport-seal silhouette
- Richer border and framing treatment
- Scenic full-illustration composition
- Integrated MA seal, location, and date block
- More premium visual weight than 2025

## Global requirements

Every stamp must include:
- event title
- event date or date block
- location
- MA branding/seal
- event-specific illustrated scene
- distressed vintage print texture
- foreground, midground, and background depth
- readable typography at mobile card size

Never use:
- cropped collection-board images
- generic placeholder circles for designed completed events
- plain icon-only artwork
- mostly empty interiors
- generic line drawings
- one repeated scene template with swapped labels

## 2025 collection

### MA Official Group Launch
Date: Mar 4, 2025
Location: Jacksonville, FL
Scene: Jacksonville skyline, 3-4 members together in foreground, sunrise/radiant launch glow.
Palette: teal, gold, cream, muted green.
Mood: origin, unity, community, beginning.
Text: MA OFFICIAL / GROUP LAUNCH / Jacksonville, FL / MAR 04 2025.

### Huguenot Park Camping Trip
Date: Mar 28-30, 2025
Location: Huguenot Memorial Park, Jacksonville, FL
Scene: beachside campsite, tent, campfire, palms/coastal vegetation, campers around fire.
Palette: olive green, sand, burnt orange, charcoal.
Mood: grounded, outdoorsy, cozy.

### Great Melanated Float-Out
Date: Apr 26, 2025
Location: North Florida
Scene: river, people in tubes, warm sunset, lush banks, motion and fun.
Palette: warm gold, river teal, green, dark navy.
Mood: joyful, free, social, energetic.

### Black & Breezy: The Summer Cool-Down
Date: Jun 20-22, 2025
Location: Tomoka State Park, FL
Scene: hammock/lounge, palms, waterside campsite, purple-orange dusk.
Palette: purple, coral-orange, dusk pink, indigo.
Mood: relaxed, breezy, soulful.

### Great Melanated Fire Dragon Conquest
Date: Jul 12, 2025
Location: Jacksonville, FL
Scene: dramatic fire dragon, heroic confrontation, embers, fire-lit environment.
Palette: black, ember orange, deep red, bronze.
Mood: epic, fantasy adventure, conquest.

### Great Melanated Wet & Wild Adventure
Date: Jul 18, 2025
Location: Orlando / Kissimmee, FL
Scene: waterpark slides, people in tubes/pool, splash action and summer movement.
Palette: sky blue, aqua, yellow, leafy green.
Mood: playful, bright, high-energy.

## 2026 collection

### The Great Melanated Beach Escape
Date: Mar 27-29, 2026
Location: Huguenot Memorial Park, Jacksonville, FL
Scene: two seated figures facing ocean, beach chairs, palms, shoreline, glowing horizon.
Palette: turquoise, gold, sand, deep ocean teal.
Mood: restoration, coastal beauty, connection.

### The Great Melanated Float Out: Juneteenth Edition
Date: Jun 20, 2026
Location: William F. Sheffield Regional Park, Jacksonville, FL
Scene: river float celebration, people tubing, tasteful red/black/green Juneteenth accents.
Palette: deep green, gold, sunset orange, red accents.
Mood: celebration, community, freedom, pride.

### Melanated Adventures C.H.A.M.P.s Summer Session
Date: Jul 23, 2026
Location: Jacksonville Area
Scene: youth around campfire, tent, trees, learning/leadership environment.
Palette: burnt orange, forest green, firelight gold, deep brown/charcoal.
Mood: youth empowerment, mentorship, learning, warmth.

### Splash After Dark
Date: Jul 25, 2026
Location: Island H2O, Orlando Area
Scene: moonlit waterpark, illuminated slides, glowing water, silhouettes splashing.
Palette: midnight purple, electric blue, indigo, moonlight accents.
Mood: nightlife, water fun, electric summer night.

### Lake Louisa Trail Day
Date: Jul 2026
Location: Lake Louisa State Park area
Scene: hikers on trail, rolling terrain, lake glimpse, forward motion.
Palette: moss green, warm tan, golden light, muted blue.
Mood: movement, exploration, trail energy.

### Silver Springs Paddle Day
Date: Aug 2026
Location: Silver Springs
Scene: kayaking/paddling, clear spring water, lush vegetation, reflections.
Palette: spring blue, aqua, lush green, sunlight gold.
Mood: serene, aquatic, exploratory.

### Everglades Eco Day
Date: Aug 2026
Location: Everglades
Scene: marsh/wetland, sawgrass, waterway, eco-learning and wildlife cues.
Palette: marsh green, swamp teal, amber, earth tones.
Mood: ecological, educational, immersive.

## Stamp Book presentation

- Two-column layout may remain.
- The stamp must be the visual hero.
- Reduce empty card space.
- Preserve full artwork and aspect ratio.
- Never clip stamp tops/bottoms.
- Event title wraps cleanly below artwork.
- Month/year is secondary.
- Prefer year-grouped sections: 2026 then 2025.
- Remove fallback MA circles for all completed events with approved stamp designs.

## Implementation rules

Preferred asset strategies:
1. Individual SVG/React Native SVG stamp components, one per event; or
2. Individual high-resolution transparent PNG/SVG artwork files, one per event.

Never depend on a composite collection board at runtime.

Each event code must explicitly map to its stamp. Include mappings for all 13 approved designs, including Lake Louisa Trail Day, Silver Springs Paddle Day, and Everglades Eco Day.

## Acceptance criteria

The work is acceptable only when:
- no cropped board art is used
- all 13 approved stamps are unique and event-specific
- 2025 and 2026 families are visibly distinct
- all stamps display at correct aspect ratio
- no completed designed event displays an MA placeholder circle
- no stamp is clipped
- artwork retains readable detail on-device
- the Stamp Book reads as a collectible passport, not a generic event-card grid

This document is the approved source of truth for Passport stamp production and should govern future stamp implementation unless explicitly superseded by a later approved brief.
