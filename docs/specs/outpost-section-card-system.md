# Outpost Section Card System

## Goal
Unify Campfires around one visual grammar: each major information area is one contained section card, while rows, rails, and featured content live inside that card. The experience should feel premium and easy to scan without becoming a pile of isolated cards.

## Core visual rule
- Major section = one outer card.
- Content inside = rows, a horizontal rail, or one featured post surface.
- Do not give every row its own outer card.
- Prefer spacing and separators before adding another container.

## Campfires hierarchy
1. Segmented filter control
2. Important
3. Coming Up
4. Around the Campfire

## Filter control
- For You / My Camps / Nearby sit inside one shallow rounded surface.
- The selected segment receives the gold accent and stronger tonal fill.
- Unselected segments stay quiet.
- Keep only a small gap before the first section card.

## Important
- Smallest major card unless there is genuinely critical content.
- Header, subtitle, and optional View all action live inside the card.
- Empty state collapses to one compact success row: “Nothing urgent right now” and “You’re all caught up.”
- Up to three priority notification rows share the same outer card with internal separators.
- Notification rows do not receive separate outer borders.

## Coming Up
- Header, subtitle, and See all action live inside the section card.
- Horizontal outing rail is contained inside the same card.
- Outing cards remain visual, but are sized as content within the module.
- Show up to four; the full directory stays in Outings.

## Around the Campfire
- Header, subtitle, and See all action live inside one section card.
- Active/relevant camps rank above inactive camps.
- Each camp gets a header row with image, name, activity summary, and navigation.
- Active camps may show one highlighted human post beneath the header.
- Featured post can include image, author/avatar, recency, body, reactions, and comments.
- Inactive camps remain compact and do not receive a featured surface.
- For You remains capped at five camps.

## Visual tokens
- Outer section card: existing dark forest tonal surface, subtle 1px border, 20px radius, 16px padding.
- Major cards separated by 14–16px.
- Internal separators use existing BORDER/hairline styling.
- Gold = selection/action/priority.
- Green = positive status/community activity.
- Avoid nested-border overload.

## Retained behavior
- Campfires / Communities / Outings tabs.
- For You / My Camps / Nearby logic.
- Personalized activity ranking.
- Pull to refresh.
- Partial-failure states.
- Notification read handling.
- RSVP behavior.
- New-user discovery state.
- Current Go Melanated dark forest / cream / gold design language.

## Acceptance criteria
- Important, Coming Up, and Around the Campfire are each contained major cards.
- Section title, supporting text, and action are inside their card.
- Filters read as one segmented-control surface.
- Empty Important is compact and does not leave a large blank area.
- Priority rows share a single container.
- Coming Up rail stays within its card.
- Around the Campfire activity stays within its card.
- Active camps can show one human highlight; inactive camps remain compact.
- No raw infinite feed is introduced.
- No render-time impure Date.now calls are introduced.
- Mobile lint/typecheck should pass.
