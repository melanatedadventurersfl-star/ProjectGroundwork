# Trail Guide Smart Redesign

## Goal
Turn Trail Guide into a smart local outdoor concierge rather than a static directory. The screen should answer: **What can I do outside near me today?**

## Information hierarchy
1. **Compact city + weather hero**
2. **Quick Guides** directly below the hero
3. **Page-level activity filters**
4. **Recommended for today**
5. **Explore {city}** destination list

## Hero
- Reduce the hero height so useful content appears sooner.
- Keep city, location, current temperature, weather condition, feels-like temperature, rain chance, and wind.
- Keep the dynamic city/weather background.
- Add a concise weather signal when conditions are materially important, such as a high rain chance.
- Do not invent hourly timing unless hourly forecast data is available.

## Quick Guides
- Move Quick Guides immediately beneath the hero.
- Use compact horizontal cards so the section provides orientation without delaying destination discovery.
- Reorder guides according to the selected activity and current conditions.
- Examples:
  - Hiking: Day-Hike Safety, Florida Heat, Leave No Trace, Wildlife Awareness
  - Camping: Camping Essentials, First Camping Trip, Florida Heat, Wildlife Awareness
  - Water: Paddling Basics, Storm Season, Florida Heat, Wildlife Awareness
- When rain chance is high, Storm Season should be elevated.

## Activity filters
- Treat the activity chips as page-level state, not Explore-only filters.
- Display `For You` instead of `All` while preserving the existing internal `All` category value.
- Supported categories remain: Hiking, Camping, Parks, Water, Scenic.
- Changing the selected category must update:
  - recommendation candidates
  - recommendation heading
  - Quick Guide ordering
  - Explore inventory
  - Explore heading/count
- Reset `Show all` when the category changes.

## Recommendations
- `For You` uses the full ranked city inventory.
- A selected category uses only places in that category.
- Rank by current condition score first and distance second.
- Continue requiring a resolved destination photo for a recommendation card.
- Recommended cards should be larger than Explore rows and remain horizontally scrollable.
- Show two strong cards with a partial third card visible on common phone widths.
- Use condition-aware labels from the existing conditions system.
- Heading behavior:
  - For You: `Recommended for today`
  - Hiking: `Hiking picks for today`
  - Camping: `Camping picks for today`
  - etc.

## Explore inventory
- Explore must use the same active category as Recommendations.
- Heading behavior:
  - For You: `Explore Jacksonville`
  - Hiking: `Explore Hiking in Jacksonville`
  - etc.
- Exclude currently recommended places from the collapsed Explore preview to reduce immediate duplication.
- The expanded `See all` state may include the complete filtered inventory.
- Keep compact vertical destination rows around 100-110 px tall.
- Preserve distance and condition signals.
- Missing photos must render an intentional branded fallback, not a broken-image treatment.

## Weather behavior
- Weather affects ranking and visible condition signals.
- High rain chance should visibly influence guide priority and the hero condition callout.
- Activity selection never overrides safety logic. For example, Water can still surface cautionary condition labels when weather is poor.

## Interaction requirements
- Every destination card opens its existing Trail Guide detail route.
- Every Quick Guide card opens its existing guide route.
- Activity chips update the whole page immediately.
- No new dead-end buttons should be introduced before their destination or interaction exists.

## Acceptance criteria
- Selecting Hiking changes both Recommended and Explore to hiking content.
- Selecting Water changes both Recommended and Explore to water content.
- Selecting For You restores mixed recommendations and mixed Explore results.
- Quick Guides appear directly under the hero.
- Quick Guide order changes with activity selection.
- Recommendation heading reflects the selected activity.
- Explore heading and count reflect the selected activity.
- The collapsed Explore list does not immediately repeat recommendation cards.
- Existing destination/guide navigation still works.
- Existing weather, location, distance, photo-resolution, and condition-scoring systems remain in use.
