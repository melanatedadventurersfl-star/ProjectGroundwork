# Go Melanated Emotional Journey V1

## Product intent

Go Melanated should feel like the place where a member's outdoor life lives, not only a feed of posts and event listings. The V1 emotional-design release turns completed adventures, memories, places and milestones into a visible personal story that becomes more valuable over time.

## Experience principles

1. **Continuity over isolated screens.** Every completed adventure should become part of a member's ongoing story.
2. **People + place + memory.** Experiences should connect where the member went, what they did and the memories they saved.
3. **Progress without gamification clutter.** Milestones should feel like chapters, not a trophy cabinet.
4. **Shareable by design.** Key summary states should read well in a screenshot and support native sharing.
5. **Progressive enhancement.** Existing Passport and `member_journey` data remain the source of truth. This release must not fork a second history model.
6. **Graceful empty states.** New members should see aspiration, not an empty dashboard.

## V1 scope

### A. Your Trail

Add a full-screen Trail experience reachable from the member hub.

The screen contains:

- Header: `YOUR OUTDOOR LIFE, REMEMBERED` / `Your Trail`.
- Personal summary card with:
  - adventures completed,
  - unique places explored,
  - total saved memory photos,
  - active years represented in the journey.
- A milestone callout derived from completed adventure count.
- A chronological trail grouped by year.
- Every journey node includes:
  - adventure title,
  - city and state,
  - experienced date,
  - category,
  - photo count,
  - optional highlight.
- Journey nodes link into the existing adventure memory album.
- Empty state links to Explore.
- Native share action produces a concise text summary of the member's current Trail.

### B. Emotional milestone language

Milestones are derived from actual journey data. Initial thresholds:

- 1: `Your first adventure is in the books.`
- 5: `Five adventures. Your Trail is taking shape.`
- 10: `Double digits. Ten adventures are now part of your story.`
- 25: `Twenty-five adventures. This is becoming a way of life.`
- 50: `Fifty adventures. That's a serious outdoor autobiography.`

The highest earned threshold is shown. Before the next threshold, the interface may show the remaining count.

### C. Existing-data integration

V1 intentionally reuses:

- `member_journey` via `getJourney()` for completed adventures,
- `adventure_memory_photos` counts already hydrated into Journey items,
- the existing Memories album routes,
- member profile data via `getMemberBasecamp()`.

No new database table is required for V1.

## V1.1 follow-on: outing lifecycle

The next release extends the same emotional system into outings with three temporal states:

### Before
- countdown,
- TrailMates attending,
- packing / schedule / arrival shortcuts,
- increasingly prominent treatment at 7 days and 24 hours.

### During
- `YOU'RE HERE` state,
- today's schedule,
- camp/outings updates,
- quick community check-in / activity posts.

### After
- `YOU WERE THERE` recap,
- nights / attendees / shared photos / people,
- add memories,
- share recap,
- automatically represented on Your Trail.

## V1.2 follow-on: relationship memory

Introduce shared-history surfaces after the attendance relationship can be calculated reliably:

- `You and Maya have adventured together 5 times.`
- shared places,
- first adventure together,
- last adventure together,
- shared recap cards.

## V1.3 follow-on: Year Outside

Aggregate the Journey into a seasonal/yearly story:

- adventures,
- unique places,
- active months,
- saved memories,
- most active month,
- most frequent adventure category,
- most-traveled TrailMate when relationship data is available.

## Design system

### Palette
Use the existing Go Melanated member surfaces:

- deep forest: `#0F1713`
- elevated forest: `#17211C`
- elevated highlight: `#223128`
- warm cream: `#FFF8E8`
- muted text: `#98A49C`
- gold: `#D7B45A`
- soft gold: `#F0D083`

### Trail component anatomy

Each Trail item uses a continuous vertical rail with a gold node. The timeline should feel editorial, not like a logistics schedule. Photos are optional and never required for the item to render.

### Copy rules

- Prefer human phrases over database language.
- Avoid `achievement unlocked` language.
- Use `adventure`, `memory`, `Trail`, `people`, `place`, `year` and `story` consistently.
- Metrics support the story; they are not the story.

## Accessibility

- Minimum 44px touch targets.
- Do not use color alone to communicate state.
- Ensure muted text maintains readable contrast on forest surfaces.
- Trail chronology must remain understandable to screen-reader users without relying on the vertical rail.
- Native text scaling should not clip essential labels.

## Analytics

Track:

- `trail_opened`
- `trail_memory_opened`
- `trail_shared`
- `trail_empty_explore_pressed`
- `trail_milestone_seen`

Do not block V1 launch on analytics plumbing if a centralized analytics client is not yet available.

## Acceptance criteria

1. Member hub exposes a clearly labeled `Your Trail` destination.
2. Your Trail loads from the existing Journey source of truth.
3. Summary numbers are derived from actual journey records.
4. Unique place count deduplicates normalized `city + state`.
5. Timeline groups by experienced year and sorts newest first.
6. Tapping an adventure opens its existing memory album.
7. Empty state is useful and links to Explore.
8. Share action works through the native share sheet.
9. Screen renders with zero completed adventures without throwing.
10. No schema migration is required for this release.

## Product threshold

V1 is successful when Go Melanated begins to answer two emotional questions in-product:

- **Where have I been?**
- **What have I lived through this community?**

The next two releases add:

- **Who did I experience it with?**
- **What am I looking forward to?**
