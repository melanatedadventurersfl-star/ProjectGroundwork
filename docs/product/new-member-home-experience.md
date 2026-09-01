# New-member Home experience

## Goal

The first Trailhead visit after onboarding must prove that signup questions changed the member experience.

The member should not have to infer why Go Melanated asked about interests, home area, travel range, or experience level.

## First-session rule

When onboarding is complete and the member is still in the first two Trailhead setup actions, show a personalized payoff card directly beneath the Trailhead cover.

The card must:

1. Address the member by first or display name when available.
2. Label itself `BUILT FROM YOUR SIGNUP`.
3. Show up to four selected interests as readable chips.
4. Translate home city, state, and discovery radius into plain language.
5. Explain how experience level changes what the app favors.
6. Explain that selected interests guide what the app surfaces first.
7. Give the member one primary action: `See what matches me`.
8. Preserve access to the existing Trailhead setup flow through `Continue Trailhead setup`.

## Example

BUILT FROM YOUR SIGNUP

Jonathan, your Trailhead is already taking shape.

Camping · Water adventures · Road trips · Group events

- Showing options around Jacksonville, FL, up to 50 miles.
- We’ll favor beginner-friendly options and clearer planning details.
- Your selected interests will guide the adventures and places we surface first.

See what matches me

Continue Trailhead setup

## Behavior

The personalized payoff appears only for signed-in members with completed onboarding and at least one useful personalization signal.

Useful personalization signals are:

- one or more interests
- home city
- discovery radius

Once the member advances beyond the first two Trailhead setup actions, the normal Trailhead progress card returns.

Members who completed the guided tutorial do not see the starter card.

## Copy rules

Do not say the app has personalized something unless the corresponding profile field is present.

Do not expose raw database values when a clearer member-facing label exists.

Examples:

- `Beginner-friendly experiences` becomes `Beginner friendly`.
- `Festivals and group events` becomes `Group events`.
- `Family adventures` becomes `Family outings`.

## Acceptance criteria

- A newly onboarded member sees a personalized Trailhead payoff without opening another screen.
- The card reflects persisted onboarding data, not local onboarding form state.
- Missing profile fields are omitted or replaced with an actionable explanation.
- The primary CTA opens Explore.
- The secondary CTA continues the existing Trailhead setup flow.
- Existing members retain the normal Trailhead setup card.
- Tutorial completion behavior remains unchanged.
- Screen-reader labels on the existing progress experience remain intact.

## Next layer

The next iteration should make the same profile signals alter ordering and reason labels inside Trailhead sections themselves, especially Adventures and Upcoming Outings. Recommendation reason labels should state the specific match, for example `Matches Camping`, `Within your 50-mile range`, or `Beginner friendly`.
