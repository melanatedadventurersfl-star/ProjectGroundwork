# Ask Go Conversation Engine Test Cases

Use these as device smoke tests after CI passes.

1. **Plan continuity**
   - Build me an adventure
   - Make it beginner friendly
   - Near water
   - Add lunch
   - Expected: one evolving plan, not four unrelated recommendation searches.

2. **Reference resolution**
   - Build me an adventure
   - Swap the second stop
   - Expected: first stop remains, second stop changes.

3. **Rejection persistence**
   - What should I do this weekend?
   - Not that one
   - What else?
   - Expected: rejected first choice does not immediately return.

4. **Negative constraint**
   - Build me an adventure near water
   - Actually, no beach
   - Expected: subsequent ranking respects the exclusion instead of resetting.

5. **Plan undo**
   - Build me an adventure
   - Make it shorter
   - Go back
   - Expected: prior multi-stop plan is restored when available.

6. **Session persistence**
   - Build a plan and refine it.
   - Leave Ask Go or restart the app.
   - Return and say: Add lunch.
   - Expected: Go modifies the stored active plan.

7. **Reset**
   - Start over
   - What should I do this weekend?
   - Expected: old rejected places and plan constraints no longer control the new session.

8. **Fallback continuity**
   - Run the same flows while the Edge Function reports `source=fallback`.
   - Expected: stateful behavior remains intact.
