# 09 — Component Library

**Status:** Milestone 2 foundation  
**Product:** Melanated Adventurers Member App  
**Purpose:** Define the reusable interface building blocks that will make the product consistent, scalable, accessible, and unmistakably Melanated Adventurers.

---

## 1. Why This Library Exists

The component library is the app’s field kit. Every screen should be assembled from a shared set of reliable pieces rather than designed from scratch.

A strong component system will:

- keep the product visually consistent;
- reduce design and development time;
- support responsive layouts across phone, tablet, and web;
- make accessibility easier to maintain;
- prevent duplicate patterns with different behavior;
- allow future MA, MANA, chapter, host, and Build-A-Camp modules to share one visual language;
- preserve the distinctive Live Tile and Adventure Passport experience as the platform grows.

The library should feel expressive without becoming chaotic. The app may use rich photography, motion, stamps, topographic details, and live content, but the underlying interaction patterns must remain predictable.

---

## 2. Component Principles

### 2.1 Build once, reuse everywhere

A component should solve a recurring interface problem. One Adventure Card should support Explore, Bucket List, recommendations, chapter pages, and related adventures through controlled variants.

### 2.2 Meaning before decoration

Every visual treatment must communicate hierarchy, status, action, place, progress, or emotion. Texture and motion should never obscure essential information.

### 2.3 Real-world action is the goal

Components should guide members toward discovering, preparing for, attending, and remembering adventures. They should not reward endless screen time.

### 2.4 Accessibility is structural

Keyboard support, screen-reader labels, touch targets, contrast, reduced-motion behavior, focus order, text scaling, and error communication belong inside the components.

### 2.5 Variants should be intentional

Variants may reflect size, purpose, status, or context. They should not exist merely because two screens were designed separately.

### 2.6 Components must survive imperfect data

Every component must account for missing photos, long names, sold-out events, unknown weather, slow connections, empty lists, failed media, and offline states.

---

## 3. Component Anatomy Standard

Every production component should be documented with:

1. **Purpose**
2. **Anatomy**
3. **Variants**
4. **States**
5. **Interactions**
6. **Content rules**
7. **Accessibility requirements**
8. **Responsive behavior**
9. **Data requirements**
10. **Analytics events**

Suggested naming pattern:

```text
Component
Component / Variant
Component / State
Component / Size
```

Example:

```text
Adventure Card / Featured
Adventure Card / Compact
Adventure Card / Sold Out
Adventure Card / Loading
```

---

# 4. Foundations

## 4.1 App Shell

The App Shell is the persistent structural frame around authenticated member experiences.

### Includes

- safe-area handling;
- page background;
- top app bar region;
- scroll container;
- bottom navigation region;
- modal and toast layers;
- offline and critical-alert layers.

### Rules

- Critical alerts may appear above normal navigation.
- Bottom navigation remains available on primary destinations but may collapse on focused flows such as payment or check-in.
- The shell must support reduced motion and larger text.

---

## 4.2 Page Header

### Purpose

Orient the member and expose the most relevant page action.

### Anatomy

- optional back action;
- eyebrow or contextual label;
- title;
- optional subtitle;
- optional trailing action;
- optional utility row for search, filters, or tabs.

### Variants

- Standard
- Immersive over image
- Compact sticky
- Passport chapter header
- Adventure detail header

### Rules

- Titles should describe the destination, not the interface type.
- Avoid more than two competing header actions.

---

## 4.3 Section Header

Used to divide content without creating visual walls.

### Anatomy

- title;
- optional helper text;
- optional count;
- optional “See all” action.

### Content rule

Use natural language such as “Coming up” or “Your latest stamps” rather than generic labels where clarity permits.

---

## 4.4 Divider and Surface

Surfaces create hierarchy through spacing, contrast, and elevation.

### Surface variants

- Base
- Raised
- Image overlay
- Glass overlay for limited immersive contexts
- Passport paper
- Alert
- Success

Surfaces should not become a stack of indistinguishable rounded rectangles. Large layout regions should rely first on spacing and typography.

---

# 5. Navigation Components

## 5.1 Bottom Navigation

### Launch destinations

- Trailhead
- Explore
- Community
- Passport
- More

Campfire may appear as a prominent action or notification entry depending on prototype testing.

### Anatomy

- icon;
- text label;
- selected indicator;
- optional unread badge.

### Rules

- Labels are always visible.
- Maximum of five destinations.
- Selected state cannot rely on color alone.
- Badge counts above 99 display as `99+`.

### Accessibility

- minimum 44 × 44 point target;
- announces destination and selected state;
- unread count included in accessible label.

---

## 5.2 Top App Bar

### Possible actions

- back;
- search;
- Campfire;
- share;
- save;
- overflow menu.

The app bar should remain quiet. Primary actions belong in page content when they are central to the task.

---

## 5.3 Tab Bar

Used within a destination when two to four closely related views exist.

Examples:

- Community: Stories, Photos, Discussions
- Passport: Overview, Stamps, Trail Marks, Journey
- Adventures: Upcoming, Past, Saved

Tabs should not duplicate bottom navigation.

---

## 5.4 Breadcrumb or Progress Header

Used for multi-step flows such as registration, host setup, or Build-A-Camp requests.

### Variants

- step count: `Step 2 of 4`;
- labeled stages;
- compact progress bar.

Members must be able to move backward without losing entered information.

---

# 6. Trailhead and Live Tile Components

## 6.1 Live Tile

The Live Tile is the signature Trailhead component. It surfaces timely information in a compact, visual, and glanceable form.

### Core anatomy

- semantic title;
- primary content;
- supporting content;
- optional background image or texture;
- optional icon;
- optional status badge;
- optional live slide indicator;
- tap destination.

### Sizes

- Small: 1 × 1
- Medium: 2 × 1
- Tall: 1 × 2
- Large: 2 × 2
- Wide: full row for special moments

Exact grid dimensions will be finalized in the Design System.

### Content variants

- Next Adventure
- Campfire activity
- Weather
- Passport progress
- Pathfinder status
- Featured adventure
- Journey recap
- Packing reminder
- Chapter update
- Volunteer opportunity

### Motion

Tiles may rotate between two to four related pieces of information. Motion must be gentle, dismissible through reduced-motion settings, and never cause layout shift.

### Interaction

- tap opens the relevant destination;
- long press enters Trailhead edit mode in a later release;
- swipe is not required for essential information;
- animation pauses while focused or while the user is reading with assistive technology.

### States

- Default
- Updating
- New information
- Urgent
- Empty
- Offline
- Loading
- Error

### Content rules

- One clear idea per slide.
- Primary text should remain brief enough to understand at a glance.
- Urgent information must use explicit language, not color alone.
- Avoid auto-rotating transactional actions such as payment confirmation.

---

## 6.2 Tile Grid

### Purpose

Arrange Live Tiles into a distinctive modular dashboard.

### Requirements

- consistent gap system;
- responsive reflow;
- preserved reading order;
- no inaccessible masonry behavior;
- supports pinned priority tile;
- handles missing modules gracefully.

The visual grid may feel playful, but focus order must remain logical from top-left to bottom-right.

---

## 6.3 Trailhead Greeting

### Anatomy

- time-aware greeting;
- member first name or neutral fallback;
- one relevant sentence;
- optional contextual action.

Examples:

- “Your next adventure begins Saturday.”
- “Welcome back. Your Passport has a new stamp.”
- “Nothing scheduled yet. Let’s find your next trail.”

The greeting should be useful, not decorative chatter.

---

## 6.4 Dashboard Edit Handle

Future component for arranging tiles.

### Supports

- drag;
- resize;
- pin;
- hide;
- restore default layout.

Edit mode must provide non-drag alternatives for accessibility.

---

# 7. Adventure Discovery Components

## 7.1 Adventure Card

### Purpose

Present enough information for a member to understand and evaluate an adventure without opening its detail page.

### Anatomy

- image;
- adventure type;
- title;
- date and time;
- location;
- difficulty or readiness level;
- price or included status;
- availability;
- saved action;
- optional chapter or host;
- optional social proof.

### Variants

- Featured
- Standard vertical
- Horizontal compact
- List row
- Saved
- Upcoming registration
- Completed
- Related adventure

### Statuses

- Open
- Few spots left
- Waitlist
- Sold out
- Registration closed
- Cancelled
- Completed
- Draft for hosts

### Rules

- Status language must be explicit.
- Price labels must identify what is and is not included.
- Difficulty must have a plain-language explanation available.
- Images should represent the actual experience whenever possible.

---

## 7.2 Adventure Hero

Used at the top of Adventure Detail.

### Anatomy

- primary image or gallery preview;
- category;
- title;
- date;
- location;
- save and share actions;
- status overlay where needed.

The hero should create anticipation while keeping critical facts readable.

---

## 7.3 Adventure Facts Strip

A concise collection of key logistics.

Possible facts:

- duration;
- difficulty;
- group size;
- age requirement;
- transportation;
- lodging type;
- meals;
- accessibility;
- distance from home.

Each fact includes an icon, label, and value. Icons never replace text.

---

## 7.4 Availability Meter

### Purpose

Communicate capacity without manufacturing pressure.

### Variants

- seats remaining;
- percentage full;
- waitlist count;
- registration deadline.

Do not use artificial scarcity. The component must reflect real inventory.

---

## 7.5 Adventure Category Chip

Examples:

- Camping
- Water
- Hiking
- Road Trip
- Workshop
- Volunteer
- International
- Family

Chips support filtering and context. They should remain concise and use a consistent taxonomy.

---

## 7.6 Search Bar

### Anatomy

- search icon;
- input;
- clear action;
- optional voice input if supported;
- optional filter action.

### States

- Empty
- Active
- Results
- No results
- Offline

Search suggestions should prioritize adventures, places, categories, chapters, and members only where privacy settings permit.

---

## 7.7 Filter Sheet

### Filters may include

- date;
- distance;
- category;
- difficulty;
- price;
- duration;
- accessibility;
- transportation;
- lodging;
- meals;
- availability;
- chapter.

### Requirements

- show active filter count;
- support reset;
- preserve selections while browsing;
- provide a live result count where practical;
- never rely on hidden gestures.

---

## 7.8 Sort Control

Options may include:

- Recommended
- Soonest
- Nearest
- Price: low to high
- Newly added

“Recommended” must eventually be explainable and should not silently prioritize paid placement.

---

## 7.9 Map Preview

### Purpose

Provide geographic context without forcing the member into a full map interface.

### Anatomy

- map image or interactive region;
- destination marker;
- distance;
- open-map action;
- privacy-aware approximation for sensitive locations.

Precise meetup coordinates may remain hidden until registration when safety requires it.

---

# 8. Registration and Preparation Components

## 8.1 Primary Action Bar

A sticky action region for the most important next step.

Examples:

- Join Adventure
- Join Waitlist
- Continue Registration
- View Packing List
- Check In
- Add Memories

### Rules

- one dominant action;
- optional secondary text action;
- safe-area aware;
- never hides critical content at large text sizes.

---

## 8.2 Ticket or Package Selector

### Anatomy

- option name;
- description;
- price;
- inclusions;
- availability;
- quantity control;
- selected state.

The component must clearly distinguish admission, transportation, lodging, food, rental, and add-on costs.

---

## 8.3 Add-On Card

Used for items such as tent packages, transportation, meals, rentals, or Build-A-Camp services.

### Rules

- state whether the add-on is per person, per group, or per reservation;
- communicate dependencies;
- prevent incompatible selections;
- show the running total.

---

## 8.4 Price Summary

### Anatomy

- subtotal;
- taxes and fees;
- discounts or credits;
- total;
- payment schedule where applicable;
- refund policy link.

No mandatory cost should appear for the first time after the member commits to purchase.

---

## 8.5 Form Field

### Types

- text;
- email;
- phone;
- date;
- select;
- multi-select;
- checkbox;
- radio;
- textarea;
- emergency contact;
- waiver acceptance.

### States

- Default
- Focus
- Filled
- Disabled
- Read-only
- Error
- Success

Errors must identify the problem and how to fix it.

---

## 8.6 Registration Confirmation Card

### Includes

- adventure title;
- registration status;
- attendee names;
- confirmation number;
- next action;
- calendar action;
- receipt link;
- preparation status.

Confirmation should feel celebratory but remain useful.

---

## 8.7 Preparation Checklist

### Item types

- packing item;
- document;
- payment;
- waiver;
- transportation selection;
- dietary information;
- emergency contact;
- host instruction.

### States

- not started;
- in progress;
- completed;
- optional;
- blocked;
- changed.

The checklist should surface what changed and what requires action.

---

## 8.8 Packing List Item

### Anatomy

- checkbox;
- item name;
- category;
- quantity;
- optional note;
- supplied-by indicator;
- optional link to learn more.

Members can distinguish personal items from items provided by MA or Build-A-Camp.

---

## 8.9 Weather Readiness Card

### Includes

- forecast;
- date and place;
- confidence or last-updated time;
- relevant recommendation;
- severe-weather indicator;
- link to full forecast.

Recommendations should be practical, such as “Pack rain protection,” not alarmist.

---

## 8.10 Critical Update Banner

Used for meaningful changes such as time, location, cancellation, route, severe weather, or safety instructions.

### Requirements

- explicit title;
- timestamp;
- changed information;
- required action;
- acknowledgment state where needed;
- persistent placement until resolved.

Critical updates cannot disappear solely because they have been opened once.

---

# 9. Check-In and Adventure Mode Components

## 9.1 Check-In Card

### Variants

- QR code;
- staff confirmation;
- location-assisted;
- manual code;
- offline pending sync.

### States

- Ready
- Checked in
- Not yet available
- Needs assistance
- Failed
- Offline queued

The member must always have a human-support fallback.

---

## 9.2 QR Display and Scanner Frame

QR interfaces include clear instructions, brightness support, privacy guidance, and manual alternatives.

---

## 9.3 Adventure Mode Header

A simplified header active during an adventure.

### Includes

- adventure name;
- current day or phase;
- urgent help;
- itinerary;
- group updates;
- offline status.

Adventure Mode minimizes distraction and places logistics first.

---

## 9.4 Itinerary Timeline

### Anatomy

- time;
- activity;
- location;
- leader;
- status;
- optional note.

### Statuses

- Upcoming
- Current
- Completed
- Changed
- Cancelled

Changes should preserve the previous time in the update history when appropriate.

---

## 9.5 Safety Action

A visually distinct, persistent route to emergency instructions, staff contact, incident reporting, and location details.

It must not imply that the app replaces emergency services.

---

# 10. Passport, Progress, and Memory Components

## 10.1 Passport Cover

### Purpose

Introduce the member’s identity and progress with the visual character of a real travel document.

### Includes

- member photo;
- name;
- member since;
- home chapter;
- Pathfinder level;
- key stats;
- optional privacy controls.

The treatment should feel prestigious, warm, and personal rather than bureaucratic.

---

## 10.2 Passport Stamp

### Purpose

Represent a completed or verified experience.

### Anatomy

- adventure or place name;
- date;
- icon or custom mark;
- verification status;
- optional location;
- link to Journey entry.

### Variants

- Adventure stamp
- Place stamp
- Park stamp
- Chapter stamp
- Skill stamp
- Volunteer stamp
- Special edition stamp

### States

- Earned
- Pending verification
- Locked preview
- Private
- Legacy/imported

Stamps recognize real participation. They should not be awarded for passive scrolling.

---

## 10.3 Trail Mark Badge

### Purpose

Recognize milestones, contribution, growth, and community participation.

### Anatomy

- visual badge;
- title;
- explanation;
- earned date;
- progress;
- rarity or category where useful.

### Categories

- Exploration
- Skills
- Community
- Stewardship
- Leadership
- Consistency
- Special events

Avoid mechanics that create unhealthy competition or shame newer members.

---

## 10.4 Progress Ring or Meter

Used sparingly to show progress toward a meaningful goal.

Examples:

- two adventures until next Pathfinder level;
- three checklist items remaining;
- one volunteer activity until a Trail Mark.

Every meter includes a text equivalent.

---

## 10.5 Stat Tile

Examples:

- adventures completed;
- camping nights;
- parks visited;
- miles traveled;
- volunteer hours;
- states visited;
- skills completed.

Stats should be factual, optional to display publicly, and understandable without icons.

---

## 10.6 Journey Entry

### Purpose

Capture an adventure as a memory rather than a transaction.

### Anatomy

- date;
- adventure title;
- cover image;
- personal note;
- stamps and Trail Marks;
- photo count;
- people or chapter;
- privacy state.

### Variants

- Upcoming
- Completed
- Draft memory
- Shared story
- Private reflection

---

## 10.7 Memory Prompt

Used after an adventure to encourage reflection.

Examples:

- “What moment do you want to remember?”
- “What surprised you?”
- “Who helped make this adventure special?”

Prompts should be optional and varied.

---

## 10.8 Photo Gallery

### Supports

- grid;
- full-screen viewer;
- captions;
- alt text;
- contributor attribution;
- privacy and reporting;
- batch upload;
- low-bandwidth previews.

---

# 11. Community and Campfire Components

## 11.1 Story Card

### Anatomy

- author;
- context or adventure;
- timestamp;
- text excerpt;
- media;
- reactions;
- comments;
- save or share;
- moderation action.

The card should foreground experiences and useful stories rather than engagement bait.

---

## 11.2 Discussion Card

### Includes

- question or topic;
- category;
- author;
- response count;
- latest activity;
- answered or resolved state;
- related adventure or place.

---

## 11.3 Comment

### Supports

- reply depth limited for readability;
- edit indicator;
- reactions;
- report action;
- moderation state;
- deleted-content placeholder where context must remain.

---

## 11.4 Reaction Bar

Reactions should remain lightweight and relevant. A smaller intentional set is preferred over an enormous emoji cabinet.

Possible launch reactions:

- Inspired
- Helpful
- I’m in
- Celebrate

---

## 11.5 Member Card

### Anatomy

- photo;
- name;
- Pathfinder level;
- chapter;
- shared context;
- connection action where enabled;
- privacy-aware profile link.

Do not reveal precise location or participation details beyond the member’s settings.

---

## 11.6 Campfire Activity Item

### Purpose

Replace a generic notification with a meaningful activity update.

### Types

- adventure update;
- registration action;
- new memory;
- mention or reply;
- Trail Mark earned;
- friend or chapter activity;
- weather or safety update;
- volunteer opportunity;
- payment or refund update.

### Anatomy

- source icon or avatar;
- concise message;
- timestamp;
- unread state;
- urgency;
- tap destination;
- optional quick action.

### Grouping

Related low-priority activities may be grouped. Critical updates are never hidden inside a generic bundle.

---

## 11.7 Empty Community Prompt

Empty states should invite meaningful first actions such as:

- share a completed adventure;
- ask a preparation question;
- browse upcoming events;
- follow a chapter.

They should not guilt the member into posting.

---

# 12. Feedback and Status Components

## 12.1 Toast

Used for brief confirmation that does not require a decision.

Examples:

- Saved to Bucket List
- Packing item completed
- Link copied

Toasts should remain visible long enough to read and must not carry critical information alone.

---

## 12.2 Inline Alert

### Types

- Information
- Success
- Warning
- Error
- Critical

Includes icon, title, message, and optional action. Meaning cannot rely on color alone.

---

## 12.3 Modal Dialog

Used only when attention or confirmation is necessary.

Appropriate uses:

- cancellation confirmation;
- destructive action;
- critical acknowledgment;
- permission explanation.

Avoid using modals for ordinary information.

---

## 12.4 Bottom Sheet

Used for focused mobile tasks such as filters, sharing, ticket selection, and context menus.

It must be dismissible, keyboard accessible, and usable at large text sizes.

---

## 12.5 Loading Skeleton

Skeletons should approximate the final layout without creating a flickering carnival. Use progress indicators for actions whose duration matters.

---

## 12.6 Empty State

### Anatomy

- clear title;
- plain explanation;
- relevant illustration or icon;
- one useful next action;
- optional secondary action.

Empty states must distinguish “nothing exists,” “nothing matches,” and “content failed to load.”

---

## 12.7 Error State

### Requirements

- explain what happened in human language;
- preserve user-entered data where possible;
- provide retry or recovery;
- offer support when the member cannot resolve it;
- include an internal error reference where useful without exposing technical clutter.

---

## 12.8 Offline Indicator

### States

- Offline
- Reconnecting
- Pending sync
- Synced
- Sync failed

Offline status should be calm and precise. Members must know which actions will be saved locally and which require a connection.

---

# 13. Actions and Input Components

## 13.1 Button

### Variants

- Primary
- Secondary
- Tertiary
- Destructive
- Icon-only
- Floating action

### Sizes

- Small
- Standard
- Large

### States

- Default
- Hover where applicable
- Pressed
- Focused
- Loading
- Disabled

Buttons use verbs that describe the result: “Join Adventure,” “Save Changes,” or “Add to Passport.” Avoid vague labels such as “Submit” where a clearer verb exists.

---

## 13.2 Icon Button

Every icon button requires an accessible name and a tooltip on pointer-based interfaces. Unfamiliar actions should include visible labels.

---

## 13.3 Floating Action Button

Potential uses:

- create Community post;
- add memory;
- scan check-in code.

Only one floating action should appear on a screen, and only when the action is central and frequent.

---

## 13.4 Checkbox, Radio, Switch, and Segmented Control

- Checkbox: multiple selections or acknowledgments
- Radio: one choice from a list
- Switch: immediate on/off setting
- Segmented control: two to four closely related views

A switch should not trigger a destructive or expensive action without confirmation.

---

## 13.5 Date and Time Picker

Use native behavior where it improves accessibility and familiarity. Adventure date selection should also support clear preset ranges such as “This weekend” and “Next month.”

---

## 13.6 Quantity Stepper

Used for tickets, guests, and add-ons. It must show minimum, maximum, price impact, and disabled limits clearly.

---

# 14. Host, Chapter, MANA, and Build-A-Camp Extensions

These components may not appear in the first member-app release, but they should inherit the same design language.

## 14.1 Host Task Card

Displays event-planning tasks, due dates, assignees, blockers, and status.

## 14.2 Volunteer Shift Card

Includes role, date, time, location, capacity, requirements, and sign-up state.

## 14.3 Chapter Card

Includes chapter identity, service area, upcoming adventures, member count where appropriate, and follow or join action.

## 14.4 Skill Module Card

For MANA lessons and workshops. Includes skill level, estimated time, format, prerequisites, completion, and related adventures.

## 14.5 Build-A-Camp Package Card

Includes package name, guest capacity, included equipment, setup type, price basis, availability, and comparison action.

## 14.6 Equipment Item

Includes category, quantity, status, condition, assignment, and maintenance history for operational tools.

---

# 15. Component State Matrix

Every major component should consider the following shared states:

| State | Meaning |
|---|---|
| Default | Normal usable state |
| Hover | Pointer indication where supported |
| Focus | Keyboard or assistive focus |
| Pressed | Active touch or click |
| Selected | Chosen item or current destination |
| Disabled | Unavailable with explanation when needed |
| Loading | Data or action in progress |
| Empty | Valid state with no content |
| Error | Failed content or action |
| Offline | Network unavailable |
| Pending | Awaiting confirmation or sync |
| Success | Completed action |
| Warning | Attention recommended |
| Critical | Immediate safety or logistics attention |

No component is considered finished until its relevant states are designed.

---

# 16. Content Standards

## Labels

- use plain language;
- lead with the member’s task;
- prefer verbs for actions;
- avoid unnecessary jargon;
- introduce branded vocabulary with enough context to remain understandable.

## Dates and times

- show local timezone when ambiguity exists;
- use friendly dates for nearby events and absolute dates for confirmations;
- preserve year where records may be revisited later;
- clearly identify changed times.

## Prices

- always include currency;
- identify per-person, per-group, or per-reservation basis;
- distinguish deposits from total cost;
- surface mandatory fees early.

## Counts

- use exact numbers when useful;
- avoid inflated social-proof language;
- explain what the count represents.

---

# 17. Accessibility Requirements

All components must support:

- minimum touch targets;
- visible focus indicators;
- logical focus order;
- screen-reader names, roles, values, and states;
- text scaling without clipped content;
- sufficient contrast;
- non-color status cues;
- reduced motion;
- captions and alt text for meaningful media;
- clear error identification;
- keyboard operation on web and desktop;
- alternatives to drag, swipe, hover, and long press;
- plain-language safety and payment information.

Passport textures, live tiles, overlays, and photography must never reduce legibility.

---

# 18. Responsive Behavior

## Phone

- one- or two-column content depending on component;
- bottom navigation;
- bottom sheets for secondary tasks;
- sticky action bars for important actions.

## Tablet

- expanded tile grid;
- master-detail layouts where useful;
- side panels for filters and preparation details;
- larger photo and Passport presentations.

## Desktop or Web

- persistent side navigation may replace bottom navigation;
- multi-column Explore layouts;
- keyboard and pointer affordances;
- constrained reading widths;
- no simple stretching of mobile components across the entire viewport.

Components should preserve meaning and hierarchy rather than merely changing width.

---

# 19. Analytics Standards

Analytics should measure whether components help members complete meaningful tasks, not merely whether they attract taps.

Common events may include:

- tile viewed;
- tile opened;
- adventure card opened;
- adventure saved;
- filter applied;
- registration started;
- registration completed;
- checklist item completed;
- critical update acknowledged;
- check-in completed;
- memory created;
- stamp viewed;
- Trail Mark earned;
- Community post created;
- error encountered;
- recovery completed.

Sensitive personal, location, payment, and health-related data must not be placed casually into analytics payloads.

---

# 20. Launch Component Set

The minimum component set required for the first interactive prototype is:

1. App Shell
2. Page Header
3. Bottom Navigation
4. Live Tile
5. Tile Grid
6. Trailhead Greeting
7. Adventure Card
8. Adventure Hero
9. Adventure Facts Strip
10. Search Bar
11. Filter Sheet
12. Primary Action Bar
13. Ticket Selector
14. Add-On Card
15. Form Field
16. Price Summary
17. Registration Confirmation Card
18. Preparation Checklist
19. Packing List Item
20. Critical Update Banner
21. Check-In Card
22. Passport Cover
23. Passport Stamp
24. Trail Mark Badge
25. Journey Entry
26. Campfire Activity Item
27. Button
28. Toast
29. Empty State
30. Error State
31. Loading Skeleton
32. Offline Indicator

This set is sufficient to prototype the primary journey:

```text
Trailhead
→ Explore
→ Adventure Detail
→ Registration
→ Preparation
→ Check-In
→ Passport
```

---

# 21. Component Governance

## Adding a component

A new component should be created only when:

- the pattern appears or is expected to appear in more than one context;
- an existing component cannot support the need without becoming confusing;
- the interaction has distinct behavior or accessibility requirements;
- the addition supports the product principles.

## Adding a variant

A variant is appropriate when the component retains the same essential purpose and anatomy but changes size, emphasis, context, or status.

## Deprecation

Deprecated components should include:

- replacement guidance;
- migration notes;
- removal target;
- known locations still using the component.

## Ownership

Each production component should have a named design and engineering owner, documented usage guidance, tests, and version history.

---

# 22. Open Questions

1. Should Campfire be a bottom-navigation destination, a prominent Trailhead tile, or both?
2. Which Live Tile sizes are necessary at launch versus later customization?
3. Should member-arranged tile layouts sync across devices?
4. How much of the Passport should visually imitate a physical passport before readability suffers?
5. Which Trail Marks are automatic, host-verified, or staff-approved?
6. Which Adventure Card information is essential above the fold for first-time users?
7. What offline content should be downloaded automatically before an adventure?
8. How will Community reactions be named and moderated?
9. Which components should be shared with the public landing page?
10. Which Build-A-Camp components belong in the member app versus a separate operational application?

---

# 23. Current Decisions

- Live Tiles are the defining Trailhead pattern.
- The component system will support branded vocabulary without sacrificing clarity.
- Passport, Journey, and Trail Marks represent real-world participation and memory.
- Community components revolve around adventures, skills, places, and relationships rather than an unrestricted general feed.
- Critical safety and logistics updates remain visually and behaviorally distinct from routine Campfire activity.
- Direct messages are not part of the initial launch component set.
- Components must be designed for missing data, offline conditions, and accessible alternatives from the beginning.
- Build-A-Camp, host, chapter, and MANA extensions will inherit the core system rather than create separate visual universes.

---

# 24. Next Deliverable

The next chapter is:

`10-Design-System.md`

It will define the visual and behavioral tokens that power these components, including:

- color;
- typography;
- spacing;
- grid;
- shape;
- elevation;
- iconography;
- photography;
- illustration;
- motion;
- responsive rules;
- accessibility standards;
- Live Tile layout specifications;
- Passport visual language.

The component library defines the pieces. The Design System will define the weather, terrain, and gravity that make them all feel born in the same world.
