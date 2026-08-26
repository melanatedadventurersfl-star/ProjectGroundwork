# Ask Go Conversational V2

## Goal
Turn Ask Go from a one-shot recommendation form into an ongoing outdoor planning conversation.

## Experience principles
- The primary mental model is chat, not search.
- Go should respond in a warm, concise voice and then present useful structured cards.
- Follow-up questions should inherit the recent conversation so members do not have to restate the whole plan.
- Trail Guide recommendations, day plans, verified community-owned stops, and Your Trail memories remain grounded in first-party data.
- Ownership labels are never inferred. Only verified structured records can produce ownership claims.
- AI proposes. Members choose, save, open, or continue the conversation.

## V2 interaction model
1. Header: compact Ask Go identity, back navigation, short descriptor.
2. Empty state: Go opens the conversation and offers starter prompts.
3. Member message: right-aligned gold bubble.
4. Go response: left-aligned dark-green bubble followed by structured cards.
5. Results can include Trail Guide picks, a day plan, verified community-owned stops, or requested memories.
6. Follow-up suggestions appear as conversational chips directly beneath the latest response.
7. Composer remains at the bottom of the scroll content and is designed to feel like a messaging surface.
8. Each follow-up sends the recent conversation context to the member-guide function.

## Context policy
The mobile client sends only the most recent six turns, with role and text. The server clips each turn before passing it to the model. Structured database context remains authoritative for places, verified ownership, and member journey records.

## Safety and trust
- Never invent Trail Guide IDs.
- Never invent verified businesses or ownership labels.
- Never promise that a trail, venue, weather condition, route, or body of water is safe.
- Current hours, closures, permits, accessibility, water conditions, and weather must be treated as changeable.
- Fallback matching must be visibly labeled as a simpler non-generative result.
