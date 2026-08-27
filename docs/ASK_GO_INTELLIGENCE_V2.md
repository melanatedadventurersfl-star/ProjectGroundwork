# Ask Go Intelligence V2

## Goal

Turn Ask Go from a fixed-catalog recommendation shell into a planning assistant that understands the request before recommending, knows when to clarify, detects new topics, avoids recycling the same places, uses multiple trusted data sources, and only builds an itinerary after it has enough information.

## Definition of done

V2 is done when Ask Go can reliably complete this decision loop:

`understand -> detect topic -> classify -> clarify if needed -> retrieve -> diversify -> rank -> validate -> answer/plan -> preserve state -> mutate only what changed`

## 1. Intent classification

Every turn is classified as one of:

- `answer`
- `clarify`
- `discover`
- `plan`
- `modify`
- `compare`

Questions do not automatically become itineraries. Modification requests operate on the existing plan. New planning goals can create a fresh topic.

## 2. Clarification gate

Before generating a plan, Ask Go checks whether missing information would materially change the result.

Examples that should clarify before planning:

- `I want to plan a Campsgiving trip in Jacksonville.`
- `Help me plan a camping weekend.`
- `Plan a trip for us.`

The response must contain one concise question and up to four useful quick replies. No itinerary should be generated while the request is still materially underspecified.

## 3. Topic-change detection

A named trip/event, explicit new trip, vacation, road trip, or other new planning goal must not inherit an unrelated active outing.

When a topic change is detected:

- active plan is cleared for the new topic
- selected/rejected place state is reset for the new topic
- prior conversation can remain visible as transcript history
- the new request is evaluated independently

## 4. Session is authoritative

The server receives structured session state including:

- current mode
- constraints
- selected place IDs
- rejected place IDs
- active plan
- previous plan
- last intent

The AI prompt treats this structured session as the source of truth, not merely the transcript.

## 5. Novelty and recommendation ledger

Recently selected or rejected places receive a novelty penalty. Rejected places are excluded unless the member explicitly asks for them back.

For requests such as:

- `What else?`
- `Show me something different.`
- `Surprise me.`
- `Build a different day.`

Ask Go strongly avoids places already shown in the current planning context.

## 6. Candidate retrieval

V2 retrieves from the trusted sources currently available to the member-guide backend:

- Trail Guide candidates
- community_places
- verified community-owned/community-centered business records
- member journey/history when the request actually calls for it

The architecture treats each as a source, not as the answer itself.

Future retrieval adapters can add live events, live local-business discovery, operating hours, and routing without changing the planner contract.

## 7. Planning after discovery

The planner must not begin with a fixed timeline template.

It first chooses candidate stops that fit the request. Then it decides whether an itinerary is appropriate. It does not automatically force every plan into `10:00 -> food -> 1:30`.

Fallback mode is explicitly prohibited from creating a canned multi-stop itinerary when duration or trip structure is still unknown.

## 8. Multi-day planning awareness

The planner distinguishes a quick outing from multi-day planning requests such as:

- weekend trip
- Campsgiving
- camping trip
- vacation
- road trip

These requests must not be squeezed into the single-day itinerary model unless the member explicitly asks for one day of the trip.

## 9. Change isolation

A modification should change only what the member requested where possible.

Examples:

- `Change dinner` should not rebuild Saturday morning.
- `Swap the second stop` should retain the first stop.
- `Make Saturday easier` should not replace the entire weekend.

## 10. Confidence-aware fallback

The backend exposes internal diagnostic source information:

- `ai`
- `planner_clarification`
- `catalog_fallback`

Fallback diagnostics include a reason such as:

- `missing_openai_key`
- `openai_non_ok`
- `empty_completion`

Fallback mode should remain useful but should not pretend to be generated intelligence.

## 11. Response contract

V2 model output includes:

- `responseMode`
- `answer`
- `clarificationQuestion`
- `clarificationOptions`
- `places`
- `communityStops`
- `memoryHits`
- `dayPlan`
- `followUps`
- `confidenceNotes`
- `whyThisPlan`

The existing mobile UI remains backward-compatible because the original fields are preserved.

## 12. Acceptance bar

V2 should not be considered done until realistic conversation testing shows that a member can use Ask Go for at least five minutes without encountering:

- repeated Little Talbot / Amelia Island loops
- a canned itinerary structure on unrelated requests
- a new trip inheriting an old outing
- a vague multi-day request immediately turning into a finished itinerary
- rejected recommendations resurfacing during `what else` flows
- implementation-language responses such as `I updated the same adventure instead of starting over`

## Known boundary

This release creates the retrieval/planning architecture and uses the trusted sources currently available in the app database. True live local-business/event discovery requires a dedicated live retrieval provider or API and is intentionally an adapter boundary rather than being fabricated from model knowledge.
