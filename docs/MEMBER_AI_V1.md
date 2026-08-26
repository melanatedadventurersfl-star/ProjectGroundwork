# Member AI V1 — Ask Go

## Product intent

Ask Go is the member-facing intelligence layer for Go Melanated. It is not a generic chatbot. It uses the app's Trail Guide, current weather context, the member's own outdoor journey, and verified community-place records to help members find, understand, plan, and remember outdoor experiences.

## V1 jobs to be done

1. **Find** — understand natural-language requests such as “easy hike near water” and rank real Trail Guide places.
2. **Explain** — tell the member why each recommendation fits instead of returning opaque search results.
3. **Plan** — assemble a lightweight half-day/day plan from known Trail Guide places and verified community stops.
4. **Remember** — answer questions against the signed-in member's own `member_journey` history.
5. **Support community economics** — prioritize suitable verified Black- and brown-owned/community-centered businesses when available.

## Entry point

- Trail Guide screens surface a floating **Ask Go** control above the persistent bottom navigation.
- Selecting it opens `/trail-guide/ask`.
- Ask Go requires a signed-in member because personal journey context is private member data.

## Core interaction

Member types naturally, for example:

- “Beginner-friendly water near Tampa.”
- “Build me a half-day adventure.”
- “What was that spring I went to last summer?”
- “Something different from what I usually do.”
- “Add a verified Black- or brown-owned food stop afterward.”

Ask Go returns a conversational answer plus structured result cards when applicable:

- Trail Guide picks
- simple day plan
- verified community-centered stops
- memories from Your Trail
- suggested follow-up prompts

Trail Guide recommendations deep-link to the real place detail screen.

## Data sources and trust boundaries

### Trail Guide

The mobile client sends a bounded set of existing Trail Guide records for the selected city. The model can only return IDs from this candidate set. The server validates every returned ID before it reaches the member.

### Personal journey

The authenticated Edge Function reads the current user's RLS-scoped `member_journey` rows. Journey data is private context and is not written to a shared recommendation corpus by this feature.

### Community places

Only active records with `ownership_verification_status = 'verified'` are eligible for ownership-aware recommendations.

Ownership identities must come directly from `ownership_tags`. The AI must never infer ownership from:

- names
- photos
- neighborhoods
- cuisine
- language
- appearance
- assumed demographics

The server validates every returned community-place ID and replaces the model's name/tags with the authoritative database values before returning the result.

## Weather

The client supplies current Trail Guide weather context when available. Weather improves relevance but Ask Go must never certify that an activity or location is safe.

## Safety language

Ask Go is a planning assistant, not an authority on trail, water, weather, permit, accessibility, or venue safety. The experience reminds members to confirm current official information before leaving.

## Failure behavior

If OpenAI is unavailable or the API secret is absent, the service falls back to deterministic local matching using Trail Guide text and the member's journey records. Manual Trail Guide use remains fully available.

## AI architecture

Mobile:

- `apps/mobile/app/trail-guide/ask.tsx`
- `apps/mobile/src/trailGuide/assistant.ts`

Server:

- authenticated Supabase Edge Function `member-guide`
- OpenAI model is called only server-side
- no OpenAI key is shipped to the mobile client

## V1 exclusions

- autonomous booking or purchases
- automatic event publishing
- unverified ownership claims
- guarantees about safety/current conditions
- autonomous web browsing for places
- silently changing the member's preferences or profile

## Next releases

### V1.1 — richer day building

- route-aware sequencing
- duration and drive-time constraints
- save a generated day
- convert an AI plan into an Outing with one review step

### V1.2 — preference learning

Use explicit feedback and prior saves/visits to improve ranking without creating opaque permanent assumptions.

### V1.3 — live trip companion

Contextual weather/change alerts, nearby alternatives, and “what now?” assistance while preserving human judgment.

### V1.4 — community intelligence

Summarize verified member feedback, common accessibility notes, recurring parking friction, and community endorsements without exposing private member content.
