# Ask Go Polish V2

## Goal

Turn Ask Go from a visually polished recommendation screen into a dependable, trustworthy outdoor concierge that remains useful when AI generation is degraded.

## Problems observed

1. Place imagery can be misleading because catalog-level category images are reused across unrelated destinations.
2. Broad planning prompts such as “Build me an adventure” are treated as search prompts instead of producing an itinerary.
3. Fallback mode exposes implementation state through the “closest matches” strip even when usable results are already present.
4. Fallback recommendation reasons are generic and do not explain why a destination fits.
5. The sticky composer can visually overlap the lower portion of long result cards.
6. Refinement actions clip horizontally on tablet-width layouts.
7. Primary destination cards are visually oversized relative to the viewport.
8. Secondary cards do not maintain a consistent content rhythm.
9. “Show more” looks actionable but is not a proper press target.
10. Result copy should sound decisive and destination-specific rather than mechanical.

## Experience principles

- Trust before decoration.
- One dominant recommendation, then compact alternatives.
- Never show a misleading destination photo.
- Ask Go should infer intent before asking follow-up questions.
- Fallback mode should still feel intentional and useful.
- The screen should always preserve enough bottom clearance for the composer and persistent navigation.

## Functional requirements

### 1. Planning intent

Recognize plan-oriented language including:
- build
- plan
- itinerary
- half-day
- full-day
- make me an adventure

When planning intent is detected and the server returns fallback mode, generate a simple itinerary with:
- first outdoor stop
- break/lunch step
- second outdoor stop

The plan must use valid Trail Guide place IDs for destination steps.

### 2. Broad discovery fallback

Broad prompts such as:
- What should I do this weekend?
- Give me something fun
- Surprise me
- I need to get outside

must return up to three nearby candidates even when the AI route is unavailable.

### 3. Destination-specific fallback reasoning

Fallback reasons should be generated from known place metadata and mention useful traits such as:
- water access
- walkable trails
- approachable pace
- scenery / historic context
- camping / longer outing potential

Avoid generic repeated copy when metadata supports something more specific.

### 4. Fallback disclosure

Do not show the fallback warning strip solely because `source === fallback`.

Only expose a widening action when the system truly lacks usable recommendations.

### 5. Image trust rules

Ask Go recommendation cards must prefer a place-specific curated image.

If no curated image is available, do not display a generic category image as though it depicts that destination. Render a branded visual placeholder instead.

### 6. Result hierarchy

Primary recommendation:
- one full-width card
- shorter image footprint than V1
- title, area/category, useful traits, one concise reason
- one primary CTA: View adventure

Alternatives:
- maximum two visible initially
- equal card heights
- consistent image ratio
- two-line title cap
- concise reason

### 7. Show more

“Show more” must be a real press target.

If more candidates are already present in the result, reveal them. If not, trigger a follow-up request for additional nearby options.

### 8. Refinement actions

Refinement actions should wrap across rows instead of clipping offscreen.

Preferred compact labels:
- Beginner friendly
- Half-day plan
- Near water
- Add food
- Closer
- Shorter

### 9. Composer clearance

Scrollable content must reserve enough bottom space for:
- sticky composer
- persistent bottom nav
- safe-area spacing

No destination CTA or refinement control may sit behind the composer.

## Visual requirements

- Dark forest surface remains the base.
- Gold remains the primary action/accent color.
- Green is reserved for fit/positive trait signals.
- Hero image target height: approximately 125–140 px on tablet layout.
- Section spacing: 16–20 px.
- Alternative cards should read as a matched pair.
- Long chips wrap instead of forcing horizontal clipping.

## Acceptance criteria

1. “Build me an adventure” returns a usable plan in fallback mode.
2. “What should I do this weekend?” returns three nearby options in fallback mode.
3. Fallback recommendations have destination-specific reason copy.
4. Ask Go does not show a misleading category stock image when no curated place image exists.
5. No fallback warning strip appears when recommendations are already visible.
6. Refinement chips fit without clipping.
7. Composer does not cover result content.
8. `npm run mobile:typecheck` passes.
9. `npm run mobile:lint` passes.
