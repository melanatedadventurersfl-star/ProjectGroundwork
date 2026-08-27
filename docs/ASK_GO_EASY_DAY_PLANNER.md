# Ask Go Easy Day Planner

## Goal
Make Ask Go the fastest path from “I want to do something” to a usable day plan. The experience should borrow proven conversational patterns from leading AI assistants without copying their branding or UI.

## Product principles
1. Chat first, cards second. The conversation stays visually dominant.
2. One question at a time. Avoid form-like multi-question setup.
3. Quick replies reduce typing but never block free text.
4. Context persists. Follow-ups edit the current adventure unless the user starts over.
5. Direct mutations happen immediately. Choice mutations present options before changing the plan.
6. Old results collapse once a plan exists. The current plan is the active artifact.
7. The active plan stays compact, editable, and close to the composer.
8. History must work and reopen a real prior conversation.

## Fast day-planning flow
### Entry points
- Plan my day
- Build me an adventure
- Easy day near water
- What should I do this weekend?

### Plan my day
Step 1: Ask duration with quick replies: 2–3 hours, Half day, Full day.
Step 2: Ask vibe: Water, Trails, Relaxed, Surprise me.
Step 3: Build one recommended route with up to 3 stops.
Step 4: Offer compact actions: Add food, Swap a stop, Make shorter, Make easier, Schedule, Invite TrailMates.

## Mutation model
### Direct mutations
Apply without another decision:
- Make shorter
- Make beginner friendly
- Start later
- Remove a stop
- Undo

### Choice mutations
Enter selection mode first:
- Add food
- Add another activity
- Swap a stop
- Add coffee/dessert
- Add something for kids

For Add food, Ask Go asks what kind of stop fits: Quick bite, Sit-down, Coffee/dessert, Surprise me. It then requests nearby dining choices for the current route. A restaurant is added only after the member chooses it.

## Conversation UX
- Assistant confirmations should describe the user-facing change, not implementation details.
- Good: “Done. I made it easier and kept the same stops.”
- Avoid: “I updated the same adventure instead of starting over.”
- Suggested replies are context-aware and compact.
- In planning mode the composer placeholder becomes “Change this plan…”

## Visual hierarchy
- Header target height: ~56 px.
- Recommendation imagery is thumbnail-scale, not a giant hero.
- Older exchanges show only the user message and assistant answer.
- Only the latest exchange renders rich results.
- Plan rows use dense timeline spacing.
- Secondary recommendations are compact rows.
- Chips wrap instead of horizontal clipping.

## History
- History button is interactive.
- Store up to 12 recent Ask Go conversations locally.
- History shows opening prompt, city, last update, and plan summary.
- Resume restores the saved transcript and continues the same active session.
- Start fresh clears the visible thread but does not delete old history.

## Acceptance criteria
1. Plan my day can produce a useful plan in 2–3 taps.
2. Add food asks for food style before recommending options.
3. Add food never inserts a generic “Food stop” before selection.
4. Only the latest exchange displays rich cards and plan UI.
5. Existing plan remains visible and compact during refinements.
6. History button opens a history screen.
7. Tapping a history item restores that thread in Ask Go.
8. Quick replies remain optional; free text always works.
9. Existing Trail Guide detail navigation still works.
10. Mobile typecheck and lint pass.