# Outpost Section Card System

## Goal
Unify the Campfires tab around a single visual grammar: each major information area is one contained section card, while rows and featured content live inside that card. The result should feel intentional, premium, and easier to scan without turning Outpost into a stack of isolated cards.

## Core rule
- Major section = one outer card.
- Activity inside the section = rows, rails, or one featured content surface.
- Do not make every row its own outer card.
- Use hierarchy, spacing, and separators before adding another container.

## Campfires hierarchy
1. Filter control
2. Important
3. Coming Up
4. Around the Campfire

### Filter control
- For You / My Camps / Nearby sits inside one shallow segmented-control surface.
- Selected item gets gold outline/accent and a slightly stronger tonal fill.
- Unselected items remain quiet.
- Reduce the vertical gap between filters and the first section.

### Important card
- Smallest section card on the page unless there is genuinely critical activity.
- Header, subtitle, and optional View all action live inside the card.
- Empty state collapses to a compact success row: Nothing urgent right now / You’re all caught up.
- When populated, up to 3 notification rows appear inside the same outer card with separators.
- Individual notification rows do not get separate outer borders.

### Coming Up card
- Header, subtitle, and See all live inside the section card.
- Horizontal outing rail sits inside the same card.
- Individual outing cards remain rich visual cards, but with tighter sizing and padding so they read as content within a module.
- Maximum 4 in rail; full directory remains under Outings.

### Around the Campfire card
- Header, subtitle, and See all live inside the section card.
- Active/relevant camps rank above inactive camps.
- Each camp gets a header row with image, name, summary, and navigation.
- Active camps may surface one featured post beneath their header.
- Featured post may include image, author avatar/name, recency, body, reactions, and comments.
- Inactive camps stay compact and do not get a featured content surface.
- In For You, cap at 5 camps.

## Visual tokens
- Outer section card: dark tonal surface, subtle 1px border, 20px radius, 16px internal padding.
- Section spacing: 14-16px between modules.
- Internal separator: hairline border using existing BORDER color.
- Gold is for selection, action, and priority only.
- Green is for positive state and community/activity metadata.
- Avoid nested-border overload.

## Behavior retained
- Existing Campfires / Communities / Outings tabs.
- For You / My Camps / Nearby logic.
- Personalized relevance ranking.
- Pull to refresh.
- Partial data failure behavior.
- Notification read handling.
- RSVP behavior.
- New-user discovery state.
- Current Go Melanated dark forest / cream / gold visual language.

## Acceptance criteria
- Campfires uses contained section cards for Important, Coming Up, and Around the Campfire.
- Section title/subtitle/action are inside each card.
- Filter controls are visually grouped in one shallow surface.
- Empty Important state is compact and does not leave excessive whitespace.
- Important rows share one container.
- Coming Up rail is visually contained within its section card.
- Around the Campfire content is visually contained within one section card.
- Active camps can show one human highlight; inactive camps remain compact.
- No infinite raw post stream is introduced.
- No render-time impure Date.now calls are introduced.
- Mobile lint/typecheck should pass.
