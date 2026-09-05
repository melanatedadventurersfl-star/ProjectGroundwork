# Host My Work V3.2 Specification

## Goal

My Work should answer four questions in the first screenful:

1. What needs my attention?
2. Which event needs it?
3. What should I work on next?
4. How do I add work quickly?

## Event cards

- Use each event's existing hero image from `HostCampaign.heroImageUrl`, sourced from `adventures.hero_image_url`.
- Keep a dark fallback when no image exists.
- Use identical card heights and internal spacing.
- Reserve a fixed two-line title region.
- Keep the date row fixed.
- Keep remaining tasks, critical count, and task completion aligned at the bottom.
- Long titles truncate instead of pushing metrics down.
- Use a dark overlay so text remains readable over images.

## Status row

Keep Open, Blocked, Critical, Overdue, and Needs Scheduling compact. Blocked and Critical retain stronger visual treatment.

## My Day

Show up to three tasks that are blocked, critical, due today, or due within the next 24 hours.

## Needs Attention

Keep the main-page list capped at five tasks and continue to use the shared Host Work integrity rules.

## Up Next

Show up to five tasks. Exclude tasks already shown in My Day or Needs Attention. Rank by trusted due-date proximity, priority, event proximity, then title.

## Work Areas

Keep cards compact. Continue to show `N open`, `Complete`, or `No tasks yet`. Sort Work Areas with blocked or critical tasks ahead of ordinary areas.

## Quick Add collapsed state

Quick Add is collapsed by default and shows one compact composer row.

## Quick Add expanded state

Expanded Quick Add includes:

- explicit collapse control
- compact event selector
- task title input
- due-date calendar control
- priority control
- work-area control
- submit control

Do not show horizontally scrolling event cards inside the composer.

## Collapse behavior

Collapse Quick Add when the user taps the collapse control, taps outside the composer, successfully creates a task, or presses the native Back action while it is open. Preserve the selected event when collapsing.

## Due date

The calendar control starts as `No due date`. The date editor supports Today, Tomorrow, In 7 days, manual `YYYY-MM-DD`, and Clear date.

A selected calendar date writes both `due_at` and a readable `due_label`. Calendar dates remain separate from relative timing and dependency timing. Warn before creation when a chosen date falls outside the shared trusted planning window.

## Priority

Default to Normal. Allow Normal, High, and Critical.

## Work area

Default to General. Allow General plus Marketing, Food, Vendors, Venue, Operations, Guest Communications, Safety, and Inventory.

## Mobile browser text zoom

Editable fields on My Work web use a minimum 16px font size. Do not disable browser pinch zoom or viewport accessibility.

## Successful creation

After creation, collapse Quick Add, clear title and due date, reset priority to Normal and work area to General, preserve the selected event, refresh counts, and show a concise confirmation.

## Acceptance criteria

- Event images appear when an event has a hero image.
- Event card text and metrics align across cards.
- Quick Add is collapsed by default and always has a visible collapse path when expanded.
- Expanded Quick Add uses a compact event modal.
- Quick Add can set due date, priority, and work area before creation.
- Web input font sizes avoid iPhone Safari focus zoom.
- Needs Attention remains capped at five.
- Up Next does not repeat My Day or Needs Attention tasks.
- Shared overdue and scheduling rules remain unchanged.
- No database migration is required.
