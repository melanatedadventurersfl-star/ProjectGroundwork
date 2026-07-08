# Component Specs v1

## Project Groundwork

This document defines the first reusable UI components for Groundwork.

Components should make the product feel consistent, calm, and buildable.

---

# Purpose

Component specs help future design and development work by defining reusable interface pieces before screens are built repeatedly by hand.

Each component should have:

- Purpose
- Required content
- Optional content
- States
- Behavior
- Usage guidance

---

# Component Principles

## 1. Components should clarify context

A component should help the user understand something or take action.

## 2. Components should be reusable

Avoid one-off screen pieces when a reusable component would work.

## 3. Components should support role-aware views

Components may show different actions depending on the user role.

## 4. Components should handle empty data

Every component should have a graceful empty state where needed.

---

# Groundwork Button

## Purpose

Used for user actions.

## Types

- Primary
- Secondary
- Ghost
- Destructive
- Icon

## Required Content

- Label or icon
- Action

## Optional Content

- Loading state
- Disabled state
- Leading icon
- Trailing icon

## Usage

Use one primary button per major screen section when possible.

---

# Groundwork Card

## Purpose

Groups related information.

## Required Content

- Title
- Body content

## Optional Content

- Subtitle
- Status
- Metadata
- Action button
- Footer

## Usage

Cards should be scannable.

Avoid turning cards into mini-pages.

---

# Workspace Card

## Purpose

Represents a Workspace in lists and summaries.

## Required Content

- Workspace name
- Workspace type
- Status

## Optional Content

- Owner
- Key date
- Mission Health
- Next action
- Recent activity

## States

- Draft
- Planning
- Preparing
- Ready
- Active
- Reviewing
- Archived

---

# Mission Health Card

## Purpose

Summarizes readiness and attention areas.

## Required Content

- Overall health label
- Readiness indicator
- Supporting metrics

## Optional Content

- Open blockers
- Timeline status
- Task completion
- People coverage
- Resource readiness

## Usage

This card should make the current state understandable at a glance.

Do not overload it with every metric.

---

# Priority List Card

## Purpose

Shows the most important actions right now.

## Required Content

- Section title
- Priority items

## Optional Content

- Owners
- Due dates
- Related objects
- View all action

## Usage

Usually show three to five items.

---

# Task Card

## Purpose

Represents one Task.

## Required Content

- Task title
- Status

## Optional Content

- Owner
- Due date
- Priority
- Related milestone
- Related Workspace

## States

- Not Started
- In Progress
- Blocked
- Complete
- Cancelled

---

# Milestone Card

## Purpose

Represents an important date or phase marker.

## Required Content

- Milestone name
- Date
- Status

## Optional Content

- Related tasks
- Owner
- Description

---

# Person Chip

## Purpose

Shows a compact person reference.

## Required Content

- Name or initials

## Optional Content

- Avatar
- Role
- Status

## Usage

Use inside cards, task rows, people lists, and assignment summaries.

---

# Status Badge

## Purpose

Displays status in a compact, readable way.

## Required Content

- Status label

## Usage

Use plain language.

Do not rely on color alone.

---

# Empty State

## Purpose

Guides users when no content exists yet.

## Required Content

- Friendly explanation
- Suggested action

## Optional Content

- Illustration
- Secondary action

## Example

```text
No tasks yet.
Create the first task to start organizing this Workspace.
```

---

# Activity Item

## Purpose

Shows a recent change.

## Required Content

- Action summary
- Timestamp

## Optional Content

- Actor
- Related object
- Link

---

# Suggested Action Card

## Purpose

Suggests useful next steps.

## Required Content

- Recommendation
- Action button or link

## Optional Content

- Reason
- Related object
- Dismiss action

---

# Notes and Lessons Card

## Purpose

Surfaces useful context and memory.

## Required Content

- Notes or lessons summary

## Optional Content

- Add note action
- Capture lesson action
- Related object

---

# Component Build Priority

Build components in this order:

1. GroundworkButton
2. GroundworkCard
3. StatusBadge
4. WorkspaceCard
5. TaskCard
6. PersonChip
7. MilestoneCard
8. EmptyState
9. MissionHealthCard
10. ActivityItem
11. SuggestedActionCard
12. NotesAndLessonsCard

---

# Standard

A Groundwork component succeeds when it can be reused without making the screen feel generic.

The component should carry product meaning, not just visual shape.
