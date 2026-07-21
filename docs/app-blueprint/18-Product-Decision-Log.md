# 18. Product Decision Log

## Purpose

The Product Decision Log records important choices, their reasoning, rejected alternatives, assumptions, and conditions for reconsideration. It prevents the platform from repeatedly reopening settled questions without new evidence.

## Decision Format

Each decision should include:
- ID
- date
- status
- decision
- rationale
- alternatives considered
- consequences
- assumptions
- revisit trigger

Statuses:
- Proposed
- Accepted
- Superseded
- Rejected
- Revisit Required

---

## D-001: Use the Existing ProjectGroundwork Repository

**Status:** Accepted

**Decision:** Build the app documentation and future application code inside the existing `ProjectGroundwork` repository using clearly separated folders.

**Rationale:** A single repository is easier for the current team to navigate and maintain. It keeps the landing page, app blueprint, and future shared services in one accessible workspace.

**Alternative considered:** Create a separate app repository.

**Consequence:** Repository organization and naming discipline become important as the platform grows.

**Revisit trigger:** Independent engineering teams require separate release cycles or access controls.

---

## D-002: Trailhead Uses Live Tiles

**Status:** Accepted

**Decision:** The member home experience, called Trailhead, uses a modular Live Tile layout rather than a conventional scrolling social feed.

**Rationale:** Tiles surface the member's next actions, create a recognizable visual identity, and support information such as countdowns, weather, preparation, community activity, and Passport progress.

**Alternative considered:** Standard card feed.

**Consequence:** The tile system must remain accessible, calm, and useful rather than becoming an animated billboard.

**Revisit trigger:** User testing shows the layout causes confusion or reduces completion of core tasks.

---

## D-003: No Direct Messaging at Launch

**Status:** Accepted

**Decision:** The launch product does not include private member-to-member messaging.

**Rationale:** Direct messaging adds moderation, harassment, privacy, reporting, and safety complexity before the community model is proven inside the app.

**Alternative considered:** Basic one-to-one chat.

**Consequence:** Members communicate through event discussions, community posts, and official updates.

**Revisit trigger:** Strong repeated demand, adequate moderation capacity, and a complete safety design.

---

## D-004: Passport Replaces the Conventional Profile Center

**Status:** Accepted

**Decision:** The primary member identity and progress area is the Adventure Passport.

**Rationale:** Passport turns participation into a meaningful record of experiences, growth, memories, and contribution. It is more distinctive than a generic profile page.

**Consequence:** Personal progress must not become a shallow points competition.

**Revisit trigger:** Testing shows members cannot find ordinary profile and account functions.

---

## D-005: Campfire Replaces a Generic Notification Center

**Status:** Accepted

**Decision:** In-app updates live in Campfire and are organized around meaningful activity and required actions.

**Rationale:** Campfire is on-brand and allows prioritization by urgency, adventure, and relevance rather than presenting a noisy chronological pile.

**Consequence:** Critical operational alerts must still use clear language and familiar urgency patterns.

**Revisit trigger:** Members miss important updates or find the terminology unclear.

---

## D-006: Attendance Unlocks Completion

**Status:** Accepted

**Decision:** Paying or registering does not automatically create a completed Passport stamp. Verified attendance or approved completion does.

**Rationale:** The Passport should represent lived experience, not purchases.

**Consequence:** Check-in and correction workflows become essential.

**Revisit trigger:** Certain remote, educational, or self-guided experiences require a different completion model.

---

## D-007: Community Is Adventure-Centered

**Status:** Accepted

**Decision:** Community content is organized around stories, photos, questions, trail reports, gear reviews, and shared experiences rather than an unrestricted general-purpose feed.

**Rationale:** This keeps the app tied to its mission and reduces the pressure to imitate large social networks.

**Revisit trigger:** Member research identifies valuable community formats not connected to a specific adventure.

---

## D-008: Build-A-Camp Remains a Future Module

**Status:** Accepted

**Decision:** The launch member app may surface Build-A-Camp contextually, but full rentals, inventory, staffing, and fulfillment remain outside launch scope.

**Rationale:** Build-A-Camp has different workflows and operational users. Mixing it into the first release would blur the member experience.

**Revisit trigger:** Core adventure registration and operations are stable.

---

## D-009: Members May Hold Multiple Roles

**Status:** Accepted

**Decision:** Roles are assignments, not a single permanent member type.

**Rationale:** A person may simultaneously be a member, volunteer, host, or chapter leader.

**Consequence:** Permissions require both role and resource-level checks.

---

## D-010: Safety Access Is Separate

**Status:** Accepted

**Decision:** Safety and incident records are not automatically accessible to all staff or administrators performing ordinary event work.

**Rationale:** These records are sensitive and should use least-privilege access.

**Consequence:** Safety workflows require dedicated permissions and audit history.

---

## D-011: Mobile-First, Not Mobile-Only

**Status:** Accepted

**Decision:** The member experience is designed mobile-first, while architecture and responsive patterns allow browser access and future tablet or desktop operational tools.

**Rationale:** Members will use the product during travel and adventures, while staff and hosts may need larger-screen tools.

---

## D-012: Offline Support for Adventure Essentials

**Status:** Accepted

**Decision:** Upcoming adventure essentials, preparation details, directions, itinerary, and check-in credentials should remain available with weak or absent service.

**Rationale:** Outdoor environments frequently have unreliable connectivity.

**Consequence:** Offline state and synchronization are launch-quality concerns, not decorative future enhancements.

---

## D-013: Progress Celebrates Participation, Not Popularity

**Status:** Accepted

**Decision:** Trail Marks and ranks are earned through verified experiences, learning, volunteering, and contribution. Follower counts and public popularity are not core progression metrics.

**Rationale:** The platform should encourage real-world growth and belonging rather than status anxiety.

---

## D-014: Critical Alerts May Leave the App

**Status:** Accepted

**Decision:** Campfire is the in-app source of truth, but critical operational changes may also use push, email, or SMS based on urgency and member preference.

**Rationale:** Weather, departure, cancellation, and safety information cannot depend on a member opening the app.

---

## D-015: Launch Uses a Modular Backend

**Status:** Accepted

**Decision:** Build clear domain boundaries behind a single application API instead of prematurely creating many independent microservices.

**Rationale:** This balances maintainability with the size of the initial team.

**Revisit trigger:** Scale, reliability, or team ownership requires independent deployment.

---

## D-016: Nature and People Remain the Visual Heroes

**Status:** Accepted

**Decision:** Photography and member experiences lead the visual system. Decorative technology effects remain secondary.

**Rationale:** The product exists to move people toward real outdoor experiences.

---

## D-017: User-Generated Media Requires Moderation and Accessibility Metadata

**Status:** Accepted

**Decision:** Uploaded media stores moderation state and supports alternative text or assisted descriptions.

**Rationale:** Community safety and accessibility must be part of the media model from the beginning.

---

## D-018: The First Prototype Follows the Core Adventure Loop

**Status:** Accepted

**Decision:** The first interactive prototype covers Trailhead, Explore, Adventure Detail, Registration, Preparation, Check-In, and Passport completion.

**Rationale:** This path tests the platform's central promise before secondary features receive heavy investment.

---

## Governance

New major decisions should be added when they affect:
- launch scope
- member safety
- platform architecture
- navigation
- brand vocabulary
- data ownership
- privacy
- progression rules
- integration commitments

Minor implementation choices belong in engineering notes unless they materially alter the product experience.
