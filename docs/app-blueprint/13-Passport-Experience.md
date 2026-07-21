# 13 — Passport Experience Specification

## Purpose

Define the member profile, progress, history, and memory system as a distinctive Adventure Passport rather than a conventional profile page.

## Product Role

The Passport should make members feel proud of where they have been, curious about what comes next, and connected to the people and stories behind each experience.

It is not a public popularity score. It is a personal record of participation and growth.

## Passport Structure

1. Identity Page
2. Adventure Stats
3. Stamps
4. Trail Marks
5. Journey
6. Memories
7. Bucket List
8. Skills and Contributions
9. Privacy and Sharing

## Identity Page

Includes:

- profile photo;
- display name;
- member-since date;
- home chapter or region;
- Pathfinder rank;
- short adventure statement;
- optional pronouns;
- privacy-aware location;
- emergency and accessibility information stored separately and never public by default.

## Adventure Stats

Launch statistics may include:

- adventures completed;
- camping nights;
- activities tried;
- parks visited;
- cities or states visited;
- volunteer hours;
- hosted or supported adventures;
- consecutive years active.

Stats celebrate breadth and consistency without ranking members against one another.

## Passport Stamps

A stamp records a verified or member-added experience.

### Verified stamp

Created after eligible check-in or host confirmation.

Contains:

- adventure name;
- place;
- date;
- activity category;
- event artwork or stamp design;
- verification state;
- associated memories.

### Personal stamp

Members may record outside adventures. These are clearly identified as personal entries rather than MA-verified participation.

## Stamp Lifecycle

```text
Registered
→ Checked In
→ Adventure Completed
→ Stamp Ready
→ Member Reviews
→ Stamp Added to Passport
```

Members may correct visible details or report an incorrect stamp.

## Trail Marks

Trail Marks recognize meaningful participation, skills, service, or milestones.

Categories:

- Firsts
- Exploration
- Skills
- Community
- Service
- Leadership
- Seasonal
- Chapter-specific

Examples:

- First Campout
- First Float
- Campfire Keeper
- Trailblazer
- Early Riser
- Night Owl
- Community Builder
- Ten Camping Nights

## Trail Mark Rules

- criteria are visible before earning whenever practical;
- progress is understandable;
- awards cannot be purchased;
- recognition should not reward unsafe behavior or excessive consumption;
- limited achievements must not create social exclusion;
- manual awards require an audit record.

## Pathfinder Rank

Rank reflects participation and contribution, not social influence.

Possible progression:

```text
Explorer
Pathfinder I
Pathfinder II
Pathfinder III
Trail Guide
Community Steward
```

Final names and thresholds require testing. Rank should unlock guidance, recognition, or service opportunities rather than status theater.

## Journey

Journey is the chronological record within the Passport.

Entries include:

- completed adventures;
- upcoming registered adventures;
- stamps;
- Trail Marks;
- member memories;
- volunteer milestones;
- chapter and leadership moments.

Members can filter by year, activity, location, and entry type.

## Memories

A memory may contain:

- photos or short video;
- caption or journal note;
- tagged adventure;
- tagged members with consent;
- privacy setting;
- date and place;
- optional prompt such as “What surprised you?”

Memories belong to the member first. Sharing to Community is optional.

## Bucket List

Saved adventures and personal goals can appear as future Passport pages.

A Bucket List item may become:

- a registered MA adventure;
- a personal plan;
- a completed personal stamp;
- a suggested next step based on interests.

## Skills and Contributions

Later releases may include:

- completed MANA learning modules;
- outdoor certifications;
- host qualifications;
- volunteer roles;
- equipment familiarity;
- mentorship contributions.

Sensitive credentials use restricted visibility.

## Sharing

Members may share:

- a single stamp;
- selected Trail Marks;
- a Journey recap;
- a year-in-adventure summary;
- a limited public Passport card.

The full Passport is never public by default.

## Privacy

Visibility levels:

- Only me
- Adventure participants
- Adventure Circle
- Members
- Public share card

Location precision, attendance history, minors’ information, and safety details receive stricter defaults.

## Empty State

A new Passport should feel inviting, not barren.

It should show:

- the first achievable stamp;
- an explanation of verified experiences;
- suggested beginner-friendly adventures;
- a preview of how the Passport grows.

## Celebration

Stamp and Trail Mark arrivals may use short celebratory motion, haptics, and sound where enabled. The effect must be dismissible and respect reduced-motion and sound preferences.

## Analytics

Track:

- Passport visits;
- stamp review and acceptance;
- Trail Mark progress views;
- memory creation;
- sharing actions;
- privacy changes;
- conversion from suggested next adventure.

## Current Decisions

- Passport replaces the conventional profile concept.
- Verified and personal experiences coexist but remain distinguishable.
- Progress rewards real-world participation and contribution.
- Memories are private-first and optionally shared.
- Competitive leaderboards are not part of the core Passport.

## Open Questions

- Final Pathfinder rank names and thresholds.
- Whether members can reorder stamps manually.
- How personal adventures are verified, if at all.
- Which statistics are visible to other members by default.

## Decision History

- Version 1.0 establishes the Passport structure, progression philosophy, and privacy model.