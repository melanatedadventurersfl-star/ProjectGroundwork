# Ask Go Intelligence V2 acceptance conversations

Run these against a real device/build and record the backend diagnostic source for each turn.

## 1. Campsgiving clarification

User: `I want to plan a Campsgiving trip in Jacksonville.`

Expected:
- response mode is clarification
- no day plan yet
- asks one useful planning question
- offers quick replies such as full weekend / camping + activities / activities only / food + activities
- does not reuse an unrelated active outing

## 2. New topic isolation

Start with an active Little Talbot outing.

User: `I want to plan a Campsgiving trip in Jacksonville.`

Expected:
- topicChanged diagnostic is true
- Little Talbot and Amelia Island are not inherited merely because they were in the previous plan
- new trip starts from a clean planning state

## 3. What else novelty

User: `What should I do this weekend?`
Then: `What else?`
Then: `Show me something different.`

Expected:
- later recommendation sets avoid places shown in the first set when alternatives exist
- rejected/recently shown IDs receive a strong novelty penalty

## 4. Surprise me novelty

User: `Surprise me nearby.`
Repeat it after receiving results.

Expected:
- second response is materially different when the candidate pool allows it

## 5. Rejection persistence

User: `Not the first one.`
Then: `What else?`

Expected:
- rejected first result does not return unless explicitly requested back

## 6. Question, not plan

User: `Is November a good time to camp in Jacksonville?`

Expected:
- answers the question conversationally
- does not manufacture a day itinerary

## 7. Underspecified trip

User: `Help me plan a camping weekend.`

Expected:
- asks a concise clarification before generating a trip

## 8. Ready day-plan request

User: `Plan a relaxed half day near water in Jacksonville.`

Expected:
- enough detail exists to discover and then plan
- itinerary is based on chosen candidates
- timing is not forced into the old fixed 10:00 / noon / 1:30 pattern unless genuinely appropriate

## 9. Change isolation

With a multi-stop active plan:

User: `Swap the second stop.`

Expected:
- first stop remains intact
- only second stop is replaced when possible

## 10. Fallback without AI key

Run with AI generation unavailable.

Expected:
- diagnostic source is `catalog_fallback`
- fallback reason is explicit internally
- fallback does not create a canned multi-day itinerary
- recently shown and rejected places are still penalized

## 11. Empty completion fallback

Simulate an empty model completion.

Expected:
- fallback reason is `empty_completion`
- member receives useful diversified matching, not a fake AI claim

## 12. OpenAI non-OK fallback

Simulate upstream failure.

Expected:
- fallback reason is `openai_non_ok`
- no crash
- no canned trip plan

## 13. Community stop integrity

Request a community-owned dining/business stop.

Expected:
- ownership is surfaced only for verified records from community_places
- no ownership identity is inferred

## 14. Memory restraint

User: `What should I do this weekend?`

Expected:
- unrelated personal journey history is not injected

Then:
User: `Where did I hike last summer?`

Expected:
- relevant journey history may be surfaced

## 15. Five-minute loop test

Have a tester freely use Ask Go for five minutes, including at least one topic change and one `what else` request.

Failure conditions:
- same 2-3 places dominate without relevance justification
- old plan bleeds into new trip
- vague requests become canned itineraries
- repeated implementation-sounding copy
- rejected places repeatedly resurface
