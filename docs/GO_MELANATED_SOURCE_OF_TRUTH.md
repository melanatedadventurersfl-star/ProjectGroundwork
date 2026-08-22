# Go Melanated Source of Truth

**Status:** Canonical  
**Product:** Go Melanated  
**Last updated:** 2026-08-21  
**Owner:** Product / Founder  

> This document is the canonical product-level source of truth for Go Melanated. When this document conflicts with an older project chat, mockup, obsolete documentation, or superseded design decision, this document wins unless the implementation has intentionally changed and this document has not yet been updated.

---

## 1. Purpose of this document

Go Melanated has evolved through product discussions, code changes, database records, design iterations, generated assets, and implementation decisions. This document consolidates the current product intent so the team does not have to reconstruct decisions from conversation history.

This is a living specification. Every meaningful product change should either:

1. remain consistent with this document, or
2. update this document in the same change that alters the product.

This document is not intended to duplicate every row in Supabase or every implementation detail in code. Instead, it defines the product contract, identifies canonical terminology and behavior, and points to the system that owns dynamic data.

---

## 2. Authority hierarchy

When sources conflict, use this order unless a section below states otherwise:

1. **This source-of-truth document** for product intent, terminology, UX rules, feature responsibility, and business rules.
2. **Supabase** for live operational data such as users, reservations, adventures, membership state, attendance, and other database-backed records.
3. **Repository code/configuration** for implementation details, routes, technical behavior, static configuration, and shipped assets.
4. **Current approved design assets/specifications** for visual execution where the source-of-truth document links or refers to them.
5. **Decision records / current supporting docs** for rationale and deeper implementation context.
6. **Historical project documentation, mockups, and chats** for background only.

If production code or data conflicts with a canonical product rule here, treat the discrepancy as one of two things:

- a bug, or
- an intentional product change that requires this document to be updated.

Do not silently allow product behavior and product documentation to drift apart.

---

## 3. Status vocabulary

Every significant requirement should be understood as one of the following:

- **Canonical**: Current approved behavior or definition.
- **Planned**: Approved direction that is not fully implemented.
- **Under Discussion**: Not approved for implementation yet.
- **Deprecated**: Previously used but intentionally retired.
- **Demo / Seed**: Exists to demonstrate, test, or populate the application and must not be mistaken for production truth.

Unless otherwise labeled, rules in this document are **Canonical**.

---

# PRODUCT IDENTITY

## 4. Official product name

**Go Melanated**

Use **Go Melanated** as the user-facing product name.

The repository may retain historical internal names such as `ProjectGroundwork`, but those names do not replace the current product brand.

When the mark appears by itself, the preferred short-form mark is **GO** in uppercase.

## 5. Product purpose

Go Melanated is a mobile-first outdoor discovery, adventure, community, and participation platform designed to make outdoor experiences easier to discover, join, organize, remember, and return to.

The product should connect four major needs:

1. **Discover** outdoor places, ideas, guidance, and experiences.
2. **Join** organized adventures and manage participation.
3. **Connect** with people and a community built around shared outdoor experiences.
4. **Grow** through participation, membership, identity, ranks, badges, and an evolving relationship with the outdoors.

The app should feel welcoming, capable, premium, culturally intentional, and useful before, during, and after an adventure.

## 6. Platform priority

The primary experience is **mobile-first**, with Android currently being a key development and testing target.

Tablet layouts may be used during development, but phone behavior is the design baseline. Tablet rendering must not redefine phone-scale spacing or component proportions.

---

# CORE PRODUCT LANGUAGE

## 7. Canonical terms

Use these terms consistently in user-facing copy and product discussions:

### Adventures
Organized experiences that users can discover, join, host, or manage according to permissions.

**Deprecated in primary navigation:** `Explore` when the destination is specifically the Adventures experience.

### Trail Guide
The discovery and education area for outdoor places, local outdoor information, guides, articles, camping information, tips, preparation guidance, and related discovery experiences.

Trail Guide is not primarily a reservations screen.

### Trailhead
A member-facing home / progress-oriented experience that may surface identity, rank, progress, relevant activity, and entry points into the broader Go Melanated experience.

### Outpost
A community-oriented destination and social gathering point within the product.

### Base Camp
Preferred language for personalized/community-oriented content sections where the former label `For You` was considered too generic.

### Reservations / Tickets
The user's confirmed or pending participation records for organized Adventures. Reservations should be accessible where contextually useful, but should not displace the Trail Guide's discovery purpose.

### Profile
A user's identity, participation, public-facing information, rank or status, and relevant community context subject to privacy rules.

### Go+
A premium membership tier / membership designation. Exact pricing and entitlement details must come from the current membership specification or database/configuration rather than being inferred from old conversations.

### Admin
An elevated product role used for administration, moderation, data management, operational functions, or testing as permitted by the application.

---

# INFORMATION ARCHITECTURE

## 8. Major product areas

The current product should be understood as containing these major areas:

- Authentication / onboarding
- Trailhead
- Adventures
- Adventure detail
- Adventure creation / management
- Reservations / tickets
- Trail Guide
- Places / local outdoor discovery
- Outpost / community
- Profiles
- Membership
- Ranks and badges
- Favorites / saved items
- Notifications
- Admin / operational tooling

Navigation labels and component placement may evolve, but the responsibility of each area should remain coherent.

## 9. Screen responsibility rule

Each screen should have a clear primary job. Do not add controls simply because data is available.

Before adding a card, field, button, or section, ask:

1. Does it directly support the screen's primary job?
2. Is this the best point in the user's journey for this information?
3. Is the same information already available in a clearer location?
4. Does it create redundancy with another card, status, or label?

The app should prefer useful density over clutter.

---

# ADVENTURES

## 10. Adventure discovery

The primary user-facing label for browsing organized experiences is **Adventures**.

Do not use `Explore` as the primary label when the destination is specifically the Adventures section.

## 11. Adventure visibility

New Adventures should default to **Public** unless a future approved product rule changes this behavior.

Users with appropriate permission may change an Adventure to **Private**.

Visibility controls must work, accurately persist the selected value, and clearly reflect the current state.

## 12. Adventure creation content

The creation flow should stay focused on information necessary to define and publish the Adventure.

Canonical direction:

- Adventure location belongs with the core title / summary information.
- A separate meeting-point requirement should not be forced into the initial creation flow unless the product explicitly reintroduces it.
- Weather should not be a required Adventure-creation card.
- Extra preparation information may be surfaced later in the lifecycle when it is useful to confirmed participants rather than burdening initial creation.

## 13. Adventure status language

Avoid redundant status labels.

For example, do not simultaneously communicate the same participation state with labels such as `Reserved` and `Confirmed` unless they represent genuinely different states.

User-facing status text must correspond to actual business states.

## 14. Attendee visibility

The ability to see other attendees must respect privacy and profile visibility rules.

If attendee counts and visible member lists differ because of privacy, the UI should avoid implying that the count is incorrect.

---

# TRAIL GUIDE

## 15. Trail Guide purpose

Trail Guide is a discovery, education, and outdoors intelligence experience.

It may include:

- outdoor places near the user
- local parks, trails, waterways, and recreation destinations
- city / regional outdoor guides
- camping guidance
- beginner education
- tips and techniques
- packing / preparation content
- articles or blog-style editorial content
- conditions or weather-aware presentation where useful
- location discovery without requiring a reservation

It should help users answer: **Where can I go, what can I do, and what should I know?**

## 16. Nearby places presentation

Nearby destinations should primarily be useful as browsable lists/cards in the app. Maps can supplement discovery, but the experience should not reduce nearby content to map-only links.

## 17. Offline expectation

Trail Guide and the broader application should degrade gracefully when connectivity is unavailable.

Where technically feasible, the application should preserve useful previously loaded or locally available information such as:

- current / saved Adventures
- existing tickets or reservation information
- cached or fallback imagery
- essential navigation
- previously available guidance/content

Screens should use stable fallback backgrounds, placeholders, or cached assets rather than flashing unrelated previous content while data resolves.

---

# TRAILHEAD

## 18. Trailhead purpose

Trailhead should feel like a member's starting point and progress surface rather than a generic dashboard.

It can surface the user's relationship with Go Melanated, such as:

- rank / progression
- relevant Adventure activity
- membership context
- badges / achievements
- next steps
- personalized entry points

## 19. Trailhead imagery

Rank-based or status-based banners should feel visually connected to the broader Go Melanated design language.

Banner proportions must be appropriate for phone layouts, not optimized only for tablet screenshots.

When variants represent weather or time conditions, the core environment should remain recognizable rather than becoming a completely different location.

---

# OUTPOST / COMMUNITY

## 20. Outpost purpose

Outpost is the community destination. It should feel distinct from Profile and from purely transactional Adventure management.

The Outpost menu must route to the actual product menu / intended navigation destination, not incorrectly open profile-specific navigation.

## 21. Community language

Use intentional, branded section names where they improve clarity. **Base Camp** is an approved replacement for generic `For You` labeling in relevant community/personalized contexts.

---

# PROFILES, PRIVACY, AND SOCIAL VISIBILITY

## 22. Profiles

A user's own profile and another member's profile should not be treated identically.

A viewed member profile should expose only information the viewer is allowed to see and should prioritize useful social context rather than owner-only controls.

## 23. Privacy

Privacy rules must apply consistently across:

- profile content
- Adventure attendance
- community identity
- activity visibility
- saved/private information

The UI should not reveal private data through counts, previews, or secondary surfaces when the primary surface correctly hides it.

---

# MEMBERSHIP, RANKS, AND BADGES

## 24. Membership

Go Melanated may provide multiple membership levels, including **Go+**.

Membership entitlements, billing details, trial behavior, and pricing are dynamic business data and must be sourced from the currently approved membership configuration / implementation.

Do not invent membership entitlements from historical discussions.

## 25. Ranks

Ranks are part of the member progression and identity system.

Known rank language used by the product includes labels such as **Trailblazer** and **Adventurer**. The complete ordered rank model and requirements must be maintained in the canonical rank configuration or dedicated specification.

## 26. Badges

Badges should use the approved badge design system and should represent accomplishments, participation, identity, or milestones according to their defined rules.

Badge artwork should not include redundant member names inside the badge itself unless a later specification explicitly requires personalization.

---

# BRAND AND VISUAL SYSTEM

## 27. Brand character

Go Melanated should feel:

- outdoors-forward
- culturally intentional
- warm
- premium without becoming inaccessible
- adventurous without becoming extreme
- modern
- grounded
- highly recognizable

## 28. Core visual language

The current approved visual direction uses a palette centered on deep greens, warm golds, cream / warm neutrals, and natural outdoor imagery.

Avoid making the entire interface excessively dark. Dark green can provide depth and identity, but important branding and content should retain contrast, warmth, and breathing room.

## 29. GO / Go Melanated mark

The primary standalone mark should read **GO** in uppercase.

When the full brand lockup is used, it should clearly communicate **GO MELANATED**.

The current loading / splash direction uses:

- large gold `GO`
- dark green `MELANATED`
- mountain / sunrise / evergreen landscape language
- warm cream and gold atmosphere
- premium but restrained metallic depth

The mark should avoid resemblance to unrelated platform logos through overly generic single-letter treatment.

## 30. App icon

The app icon must use the approved Go Melanated artwork and conform to Android launcher icon requirements, including correct safe-area treatment and adaptive-icon behavior.

Do not "fix" an icon by shrinking the entire old icon inside extra padding if that changes the intended artwork.

Approved icon files should live in the repository at the implementation path expected by the mobile build configuration.

## 31. Responsive design

Phone is the baseline.

Components should:

- scale without excessive empty space
- avoid tablet-derived oversized typography
- remain reachable around the on-screen keyboard
- respect safe areas
- preserve readable touch targets
- avoid clipped controls
- allow forms to scroll or shift when the keyboard is open

---

# DATA OWNERSHIP

## 32. Supabase as operational authority

Supabase is the authority for current database-backed records once those records are migrated / seeded into the production data model.

Examples may include:

- users and profiles
- Adventure records
- attendance
- reservations / tickets
- membership state
- rank / progression state where database-backed
- favorites
- privacy settings
- admin permissions

This document defines what those concepts mean. Supabase owns their live values.

## 33. Code/configuration authority

Repository code or configuration is authoritative for implementation facts such as:

- routes
- component behavior
- static enums
- feature flags
- asset references
- build configuration
- Android / Expo settings
- fallback resources

A code-level value that encodes a business rule should be traceable to this document or a dedicated linked specification.

## 34. Demo and seed data

Demo, seed, QA, and placeholder records must be distinguishable from production data.

Use explicit metadata / flags where possible instead of relying on users to recognize fake content by its name.

User-facing labels should correctly reflect the record type. If a record is demo content, it should not incorrectly show `Featured` merely because the old fixture used that value.

Never treat test accounts or seed roles as evidence of a production entitlement model.

---

# ASSETS

## 35. Asset ownership

Approved visual assets should be stored in the repository or in a deliberately managed canonical asset location.

For each important asset family, maintain:

- canonical filename
- repository path
- intended screen/use
- dimensions / aspect ratio where relevant
- whether it is approved, draft, or deprecated

Important asset families include:

- app icon / adaptive icon layers
- splash / loading imagery
- onboarding backgrounds
- Trailhead banners
- rank environments
- badge artwork
- Trail Guide city backgrounds
- weather/time variants
- Adventure / editorial imagery where static

## 36. City and weather image consistency

When multiple variants represent the same city or environment under different conditions, preserve recognizable composition and landmark/environment identity where the design calls for continuity.

Avoid generating unrelated scenes and presenting them as weather variants of the same place.

---

# UX QUALITY RULES

## 37. Avoid redundancy

Do not repeat the same fact in multiple adjacent cards, chips, headers, and statuses without a user benefit.

Examples of issues to avoid:

- duplicated reservation states
- location repeated across multiple creation sections
- unrelated setup fields appearing too early
- repeated navigation destinations under different labels

## 38. Stable loading states

Do not display stale content from the previously viewed item while the next item is loading.

Use a deterministic placeholder, cached asset associated with the current item, or neutral fallback.

## 39. Empty and error states

Every major screen should define intentional behavior for:

- loading
- empty data
- offline
- partial data
- error / retry

An empty state should explain what the user can do next rather than looking broken.

## 40. Touch behavior

Interactive icons must be visibly and functionally tappable.

A decorative icon should not masquerade as an interactive control. A control such as Favorite, Visibility, Menu, or navigation affordance must perform the expected action consistently across screens.

---

# ROLES AND PERMISSIONS

## 41. Role model

The product may include at minimum these conceptual roles/states:

- Guest / signed-out user
- Member
- Go+ member
- Adventure host / organizer
- Admin

Ranks such as Trailblazer or Adventurer represent progression/identity and should not automatically be treated as security roles unless explicitly configured that way.

## 42. Permission principle

Security and administrative permission must be enforced by backend/database policy where appropriate, not solely by hiding UI controls.

The UI should reflect permissions, but it is not the permission boundary.

---

# PRODUCT DECISION MANAGEMENT

## 43. Change rule

A substantive product change should update this document when it changes any of the following:

- canonical terminology
- navigation responsibility
- feature behavior
- business rules
- role definitions
- privacy expectations
- membership model
- design-system rule
- data ownership
- offline behavior

## 44. Decision log

Use the repository's decision / ADR structure for deep rationale when a decision has significant technical or product consequences.

This document should contain the resulting rule; the ADR may contain the story of why.

## 45. Historical docs

Older `Groundwork` documentation remains useful as project history and design thinking, but it is not automatically canonical for Go Melanated.

A historical document should be migrated, updated, or explicitly linked here before relying on it for current product decisions.

---

# CURRENTLY PLANNED / EVOLVING AREAS

## 46. Areas that require dedicated canonical detail

The following should be expanded as implementation stabilizes:

- complete membership tier matrix and entitlements
- complete rank ladder and progression rules
- canonical badge inventory and unlock criteria
- final bottom-navigation map
- notification taxonomy and preferences
- full admin permission matrix
- Adventure cancellation/refund rules
- host approval / invitation flows
- Trail Guide content taxonomy
- offline cache policy by data type
- production event calendar and event-level authority rules
- complete brand token table

Until those sections are finalized, do not fill gaps by copying arbitrary values from old chats or demo fixtures.

---

# DEFINITION OF DONE FOR FUTURE CHANGES

## 47. Product-level completion checklist

A feature or material change is not fully done until the relevant items below are satisfied:

- User-facing terminology matches the canonical vocabulary.
- Phone-scale behavior has been considered.
- Loading, empty, error, and offline states are intentional where relevant.
- Privacy and permissions are enforced correctly.
- Demo/test state cannot be confused with production state.
- New assets are stored at canonical paths and referenced correctly.
- Redundant UI has been removed or justified.
- Relevant business rules are represented in code/data, not only visual state.
- This source-of-truth document is updated if the change modifies product intent.

---

# QUICK REFERENCE

## 48. Rules that should not require rediscovery

- The official product name is **Go Melanated**.
- The primary standalone word mark is **GO**.
- The organized-experience destination is **Adventures**, not generic `Explore`.
- Trail Guide is for outdoor discovery, places, guidance, and educational/editorial content, not primarily reservations.
- Adventure visibility defaults to **Public**, with Private available where permitted.
- Location belongs with an Adventure's core summary/title context.
- Meeting point and weather are not required initial Adventure-creation cards under the current direction.
- Avoid duplicate participation statuses such as `Reserved` plus `Confirmed` when they mean the same thing.
- Nearby outdoor places should be useful as in-app lists/cards; maps may supplement them.
- The app should degrade gracefully offline and should not flash stale imagery from a previous screen/item.
- Phone layouts are the baseline even when development screenshots come from a tablet.
- Profile and attendee visibility must respect privacy.
- Outpost is a community destination and should not incorrectly route menu actions into profile navigation.
- **Base Camp** is approved language in place of generic `For You` where applicable.
- Go+ is a membership designation; live entitlements/pricing must come from the current approved model.
- Ranks/badges are progression and identity systems, not automatically security roles.
- Demo/seed/test records must be explicitly distinguishable from production data.
- Supabase owns live operational data; this document owns product meaning and rules.
- Product changes that alter these rules must update this document.

---

# MAINTENANCE

## 49. Updating this source of truth

When changing this file:

1. Edit the rule in the relevant section instead of appending contradictory notes at the bottom.
2. If a prior rule is intentionally retired, mark it Deprecated or replace it and preserve deeper rationale in an ADR when useful.
3. Update the `Last updated` date.
4. Keep dynamic database values out of this document unless they are themselves business rules.
5. Prefer links to canonical implementation/configuration over duplicating large technical structures.

The goal is simple: one clear answer to **"What is Go Melanated supposed to do?"** without reconstructing the product from old conversations.