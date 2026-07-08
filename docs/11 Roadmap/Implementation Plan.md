# Implementation Plan

## Project Groundwork

This document defines the first build plan for Groundwork.

The implementation plan translates the product blueprint into a practical development sequence.

---

# Goal

Build the smallest complete version of Groundwork that proves the Workspace model.

The MVP should allow a user to:

- Create a Workspace
- Understand the Workspace through Mission Control
- Add people
- Create tasks
- Track milestones
- Add documents and notes
- Capture lessons learned
- Create a reusable template
- Archive completed work

---

# Build Phases

## Phase 1: App Foundation

Purpose:

Create the technical base of the application.

Deliverables:

- Flutter project setup
- App theme
- Routing
- Design system components
- Basic app shell
- Placeholder screens

Success criteria:

The app launches, routes between major screens, and uses shared components.

---

## Phase 2: Core Data Model

Purpose:

Implement the MVP domain models.

Deliverables:

- Organization model
- Person model
- Workspace model
- Workspace Type model
- Task model
- Timeline model
- Milestone model
- Document model
- Note model
- Lesson Learned model
- Template model

Success criteria:

The app can represent the core objects needed for MVP flows.

---

## Phase 3: Workspace Foundation

Purpose:

Make Workspaces real inside the app.

Deliverables:

- Workspace List screen
- Create Workspace screen
- Workspace detail route
- Workspace Header component
- Workspace status handling

Success criteria:

A user can create a Workspace and open it.

---

## Phase 4: Mission Control

Purpose:

Build the central Workspace screen.

Deliverables:

- Mission Control screen
- Mission Health Card
- Priority List Card
- Upcoming Milestones section
- Open Tasks section
- People summary
- Documents summary
- Recent Activity section
- Suggested Next Actions section

Success criteria:

A user can open a Workspace and understand what matters next.

---

## Phase 5: Task and Timeline MVP

Purpose:

Support basic planning and execution.

Deliverables:

- Task list
- Create task
- Update task
- Assign task
- Timeline view
- Create milestone
- Link tasks to milestones

Success criteria:

A user can organize work and track progress.

---

## Phase 6: People, Documents, Notes

Purpose:

Add supporting Workspace context.

Deliverables:

- Workspace People screen
- Add person to Workspace
- Assign roles
- Documents screen
- Add document or link
- Notes screen
- Add note

Success criteria:

A Workspace can hold the people and context needed to manage real work.

---

## Phase 7: Lessons and Templates

Purpose:

Preserve and reuse knowledge.

Deliverables:

- Lessons Learned screen
- Add lesson
- Create template from Workspace
- Template list
- Create Workspace from template

Success criteria:

A completed Workspace can become reusable knowledge.

---

## Phase 8: Archive and Polish

Purpose:

Complete the MVP loop.

Deliverables:

- Archive Workspace action
- Archive review prompt
- Empty states
- Loading states
- Error states
- UX polish
- Basic tests

Success criteria:

The MVP flow feels complete enough to test on a real use case.

---

# Suggested First Test Case

Use **Little Camp of Horrors** as the first real test Workspace.

It is a strong test case because it includes:

- Timeline
- Tasks
- People
- Documents
- Venue planning
- Inventory needs
- Notes
- Lessons learned
- Future template potential

---

# Build Order Summary

```text
App Shell
    ↓
Design System Components
    ↓
Core Models
    ↓
Workspace List
    ↓
Create Workspace
    ↓
Mission Control
    ↓
Tasks and Timeline
    ↓
People, Documents, Notes
    ↓
Lessons and Templates
    ↓
Archive and Test
```

---

# MVP Guardrails

Do not add these before the core loop works:

- Payments
- Full registration
- Advanced inventory
- Advanced analytics
- Complex automations
- Public marketplace
- Native mobile-specific features beyond core responsive needs

---

# Definition of MVP Complete

The MVP is complete when:

- A Workspace can be created
- Mission Control summarizes it
- Tasks can be created and completed
- People can be added
- Milestones can be tracked
- Documents and notes can be added
- Lessons can be captured
- A template can be created
- The Workspace can be archived
- The flow can be tested with a real operational use case

---

# Standard

Build Groundwork from the center outward.

The center is the Workspace.
