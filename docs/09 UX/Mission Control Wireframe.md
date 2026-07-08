# Mission Control Wireframe

## Project Groundwork

This document provides the first low-fidelity wireframe for the Mission Control screen.

Mission Control is the primary screen inside a Workspace.

Its job is to help users quickly understand what is happening, what needs attention, and what should happen next.

---

# Design Goal

Mission Control should feel like a calm command center.

It should not feel like a pile of widgets.

The screen should prioritize:

1. Context
2. Readiness
3. Action
4. Progress
5. Knowledge

---

# Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workspace Header                                                            │
│                                                                              │
│ 🎃 Little Camp of Horrors                 Status: Planning    Health: On Track│
│ Experience Workspace                       Owner: Jonathan     Date: Oct 30   │
│                                                                              │
│ [Add Task] [Add Person] [Add Document] [More Actions]                        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Mission Health                       │ │ Today's Priorities                  │
│                                      │ │                                     │
│ Overall: On Track                    │ │ 1. Confirm venue details            │
│ Readiness: 78%                       │ │ 2. Assign setup lead                │
│ Tasks: 24 of 41 complete             │ │ 3. Add missing documents            │
│ Blockers: 2 open                     │ │                                     │
│                                      │ │ [View All Tasks]                    │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Upcoming Milestones                  │ │ Open Tasks                          │
│                                      │ │                                     │
│ • Crew Confirmed        Fri          │ │ • Review budget                     │
│ • Vendor List Final     Jul 20       │ │ • Add volunteer schedule            │
│ • Packing Begins        Oct 25       │ │ • Upload venue contract             │
│                                      │ │                                     │
│ [Open Timeline]                      │ │ [Open Tasks]                        │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ People / Crew                        │ │ Resources / Documents               │
│                                      │ │                                     │
│ Workspace Lead: Jonathan             │ │ Key Documents                       │
│ People Assigned: 8                   │ │ • Venue Notes                       │
│ Open Roles: 2                        │ │ • Budget Draft                      │
│ Pending Confirmations: 1             │ │ • Planning Checklist                │
│                                      │ │                                     │
│ [Manage People]                      │ │ [Open Documents]                    │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Recent Activity                      │ │ Suggested Next Actions              │
│                                      │ │                                     │
│ • Task completed by Shannette        │ │ • Add a venue contact               │
│ • Budget document added              │ │ • Create a packing checklist        │
│ • Timeline updated                   │ │ • Capture early planning notes      │
│                                      │ │                                     │
│ [View Activity]                      │ │ [Review Suggestions]                │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Notes and Lessons                                                           │
│                                                                              │
│ Important planning notes and lessons learned should surface here.             │
│                                                                              │
│ [Add Note] [Capture Lesson]                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Mobile Wireframe

```text
┌──────────────────────────────┐
│ Little Camp of Horrors       │
│ Planning • Oct 30            │
│ Health: On Track             │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Mission Health               │
│ Readiness: 78%               │
│ Blockers: 2                  │
│ Tasks: 24 / 41               │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Today's Priorities           │
│ 1. Confirm venue details     │
│ 2. Assign setup lead         │
│ 3. Add missing documents     │
└──────────────────────────────┘

┌──────────────────────────────┐
│ My Tasks                     │
│ • Review budget              │
│ • Upload contract            │
│ • Add volunteer schedule     │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Upcoming Milestones          │
│ Crew Confirmed • Fri         │
│ Vendor List Final • Jul 20   │
└──────────────────────────────┘

┌──────────────────────────────┐
│ People                       │
│ 8 assigned • 2 open roles    │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Recent Activity              │
│ Task completed               │
│ Budget document added        │
└──────────────────────────────┘
```

---

# Component Inventory

Mission Control uses these core components:

- Workspace Header
- Primary Action Bar
- Mission Health Card
- Priority List Card
- Milestone Card
- Task Summary Card
- People Summary Card
- Resource Summary Card
- Activity Card
- Suggested Actions Card
- Notes and Lessons Card

These components should later be added to the Groundwork Design System.

---

# Responsive Behavior

## Desktop

Use a two-column card layout below the header.

The page should feel spacious and scannable.

## Tablet

Use a mixed layout with full-width priority sections and two-column supporting cards.

## Mobile

Use a single-column stack.

Prioritize:

1. Header
2. Mission Health
3. Today's Priorities
4. My Tasks
5. Upcoming Milestones
6. People Summary
7. Recent Activity

---

# MVP Notes

The MVP version can be static and rule-based.

Mission Health does not need a complex algorithm at first.

Suggested Next Actions can be generated from simple rules such as:

- No tasks exist
- No people assigned
- No timeline milestones
- Missing documents
- Workspace ready to archive
- Template can be created

---

# Future Enhancements

Future versions may include:

- Role-specific layouts
- Drag-and-drop card ordering
- Custom cards by Workspace Type
- AI-generated summaries
- Workspace comparison
- Readiness trends
- Smart alerts

---

# Design Standard

Mission Control should not show everything.

It should show what matters now.

The screen succeeds when a user opens it and immediately feels oriented.
