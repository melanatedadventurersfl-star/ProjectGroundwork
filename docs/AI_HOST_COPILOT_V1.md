# AI Host Copilot V1

## Product intent

Go Melanated should use AI as an operating layer for approved hosts, not as a generic chatbot. The Host Copilot should reduce planning work, improve consistency, surface missing details, and intentionally direct community spending toward verified Black- and brown-owned places when those places fit the outing.

## Core principles

1. **Host stays in control.** AI proposes. The host reviews, edits, and publishes.
2. **Community-centered ranking.** Verified Black- and brown-owned businesses and venues receive a positive ranking signal when relevant.
3. **Never infer ownership.** Ownership labels can only come from verified structured records. AI must never infer ownership from names, photos, neighborhoods, cuisine, language, or demographics.
4. **Safety assistance, not safety guarantees.** AI may flag weather, timing, logistics, accessibility, or preparedness concerns, but it cannot certify that an outing is safe.
5. **Structured output first.** Copilot output should populate real outing fields instead of leaving the host with a wall of prose.
6. **Graceful degradation.** If the AI provider is unavailable, the host still receives a deterministic planning scaffold and can continue manually.

## V1 scope

### 1. Describe your outing
Approved hosts can enter a rough prompt, for example:

> Beginner sunset hike near Tampa next Saturday for about 15 people. I'd like a local Black- or brown-owned food stop afterward if we have a verified option nearby.

The Copilot returns a structured draft:

- title
- short hook
- description
- category
- difficulty
- local start/end time when confidently resolvable
- city/state
- suggested venue name when grounded
- capacity
- meeting instructions
- safety/readiness notes
- backup-plan suggestion
- verified community-centered stops
- confidence / host-review notes

### 2. Apply to draft
The host sees the suggestion before it touches the outing form. A single **Use this plan** action fills the draft fields. The host can then edit anything before creating the draft.

### 3. Verified community-place priority
New `community_places` records provide structured recommendation context.

Required ownership controls:

- `ownership_tags`
- `ownership_verification_status`
- `verification_source_url`
- `verified_at`
- `verified_by`
- `community_endorsement_count`
- `is_active`

Only `ownership_verification_status = verified` records may be described using ownership labels.

Initial ownership tags may include:

- `black_owned`
- `latino_owned`
- `indigenous_owned`
- `asian_owned`
- `brown_owned`

The list is data, not an inference taxonomy. Admins can expand it as verification workflows mature.

### 4. AI service boundary
AI generation runs server-side through the authenticated `host-copilot` Supabase Edge Function.

The function:

- requires a signed-in user
- requires approved outing-host access
- retrieves only verified community-place ownership context
- calls the configured OpenAI model using a structured JSON schema
- strips any community stop whose `placeId` was not present in the verified context
- falls back to a deterministic planning scaffold if the provider is unavailable

The mobile client never receives the OpenAI API key.

## Recommendation ranking philosophy

V1 does not attempt to calculate a single opaque score. The model receives only relevant verified place candidates and explicit instructions to prefer community-centered options when they fit.

Future deterministic ranking should combine:

- activity relevance
- distance / geographic fit
- operating-hours fit
- accessibility fit
- community endorsements
- host/member prior experience
- verified Black- and brown-owned status
- venue reliability
- price fit

Ownership should be a meaningful positive signal, not a hard exclusion. If the best outdoor venue is public land, the Copilot can pair it with a verified community-owned coffee shop, restaurant, outfitter, bookstore, market, or other stop.

## Safety and trust rules

The Copilot must not:

- claim a route, venue, or activity is safe
- invent permits, closures, hours, accessibility, or weather
- invent business ownership
- publish an outing automatically
- change ticket pricing automatically
- send attendee communications without host review

The Copilot should:

- identify missing information
- recommend that hosts confirm current conditions and venue rules
- encourage precise meeting landmarks and arrival windows
- flag beginner/difficulty contradictions
- recommend contingency plans

## V1 mobile experience

On `Host > New Outing`:

1. **PLAN WITH COPILOT** card appears before manual fields.
2. Host enters a natural-language idea.
3. Host taps **Build my plan**.
4. Copilot preview shows:
   - suggested title
   - summary
   - category / difficulty / capacity
   - readiness notes
   - backup plan
   - verified community stops, when present
5. Host taps **Use this plan**.
6. Standard draft fields populate and remain fully editable.
7. Host creates the draft through the existing flow.

## Data and analytics

Recommended events for a follow-up analytics pass:

- `host_copilot_requested`
- `host_copilot_generated`
- `host_copilot_fallback_used`
- `host_copilot_plan_applied`
- `host_copilot_community_stop_shown`
- `host_copilot_community_stop_selected`
- `host_draft_created_from_copilot`

Do not send sensitive free-form prompts to third-party analytics platforms.

## Acceptance criteria

- Approved hosts can generate a structured outing plan from natural language.
- Non-approved users cannot call the Copilot endpoint.
- AI secrets remain server-side.
- The host must explicitly apply the suggestion before fields change.
- The host can edit all populated fields.
- Verified community places can be surfaced in the Copilot response.
- Ownership labels are never produced for unverified records.
- AI/provider failure does not block manual outing creation.
- Existing paid-host permission behavior is unchanged.

## Next phases

### V1.1 Host Readiness Brief
Generate a live pre-outing brief using weather, sunset, attendee count, meeting instructions, and known venue context.

### V1.2 Host Communications
Draft pre-trip, weather-change, arrival, check-in, and post-outing messages from live outing data. Every message remains review-before-send.

### V1.3 Event Mode
During an outing, show expected vs. checked-in attendees, unresolved arrival issues, and host action suggestions.

### V1.4 Post-Outing Intelligence
Summarize attendance, feedback, photos, operational friction, repeat-attendee signals, and recommended changes for the next outing.

### V1.5 Community Impact
Track verified community businesses included in an outing and, where data supports it, estimated local economic impact without overstating precision.
