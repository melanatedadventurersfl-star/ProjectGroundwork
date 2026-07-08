# Design System v1

## Project Groundwork

This document defines the first design system for Groundwork.

The design system is not only about colors and components.

It defines how Groundwork should feel, behave, and communicate.

---

# Design Goal

Groundwork should feel like a calm, capable coordinator.

The interface should reduce stress, clarify responsibility, and help users move work forward.

The product should feel:

- Clear
- Calm
- Organized
- Practical
- Trustworthy
- Action-oriented
- Warm without being noisy

---

# Design Principles

## 1. Action over decoration

Every screen should help the user understand or do something.

Do not add visual elements that do not support clarity, progress, or confidence.

## 2. Context before controls

Users should know where they are, what they are working on, and why it matters before being presented with actions.

## 3. Calm hierarchy

Important information should stand out without making the screen feel loud.

## 4. One clear next step

Whenever possible, the interface should make the next useful action obvious.

## 5. Reusable components

Groundwork should be built from consistent, reusable interface pieces.

---

# Visual Direction

Groundwork should feel grounded, modern, and operational.

The visual language should borrow from:

- Field guides
- Planning boards
- Mission control rooms
- Clean SaaS dashboards
- Outdoor systems and expedition planning

Avoid making the product feel like a generic corporate admin panel.

Avoid making it overly playful.

The product should feel capable first.

---

# Color System

Final brand colors will be decided later.

For v1, colors should support function.

## Suggested Color Roles

- Primary: main action color
- Background: app background
- Surface: cards and panels
- Border: separation and structure
- Text Primary: main reading text
- Text Secondary: supporting text
- Success: completed or healthy status
- Warning: needs attention
- Danger: blocked or critical status
- Info: neutral guidance

## Status Color Rules

Use status colors sparingly.

Color should support meaning, not decoration.

A screen with too many status colors becomes noise.

---

# Typography

Typography should be readable and calm.

Recommended type roles:

- Display: major page titles
- Heading: section titles
- Subheading: supporting labels
- Body: normal content
- Caption: metadata and helper text
- Label: buttons, badges, form labels

Typography should support scanning.

Users should be able to understand the page structure quickly.

---

# Spacing

Use consistent spacing to make the product feel organized.

Recommended spacing scale:

```text
4
8
12
16
24
32
48
64
```

Use more space around major sections.

Use tighter spacing inside grouped items.

Do not crowd Mission Control.

---

# Shape and Surface

Groundwork should use cards and panels to organize context.

Recommended surface rules:

- Cards should group related information
- Panels should hold larger sections
- Borders should be subtle
- Shadows should be minimal
- Corners should be soft but not bubbly

Suggested border radius:

- Small elements: 6px
- Cards: 12px
- Large panels: 16px

---

# Component Set v1

## Button

Used for primary and secondary actions.

Button types:

- Primary Button
- Secondary Button
- Ghost Button
- Destructive Button
- Icon Button

Primary buttons should be used sparingly.

Each screen should usually have one obvious primary action.

---

## Card

A container for related information.

Cards should include:

- Title
- Optional status or metadata
- Content
- Optional action

Cards should be scannable.

---

## Workspace Card

Used in Workspace lists.

Should show:

- Workspace name
- Workspace type
- Status
- Owner
- Key date
- Health or readiness signal
- Next action

---

## Mission Health Card

Used inside Mission Control.

Should show:

- Overall health
- Readiness
- Open blockers
- Key supporting metrics

The Mission Health Card should help users understand attention areas quickly.

---

## Priority Card

Shows the most important current actions.

Should usually show three to five items.

This should not become a full task list.

---

## Task Card

Represents a Task.

Should show:

- Task title
- Status
- Owner
- Due date
- Priority if needed
- Related Workspace or Milestone

---

## Milestone Card

Represents a Timeline milestone.

Should show:

- Milestone name
- Date
- Status
- Related tasks
- Owner if applicable

---

## Person Chip

A compact person indicator.

Should show:

- Avatar or initials
- Name
- Optional role

---

## Status Badge

A compact status label.

Examples:

- Draft
- Planning
- Preparing
- Ready
- Active
- Reviewing
- Archived
- Blocked
- Complete

Status badges should use plain language.

---

## Empty State

Used when a section has no content yet.

Empty states should:

- Explain what belongs here
- Suggest the next action
- Avoid sounding like an error

Example:

> No tasks yet. Create the first task to start organizing this Workspace.

---

## Activity Item

Shows a recent change.

Should show:

- What changed
- Who changed it
- When it happened
- Link to related object when useful

---

# Screen Patterns

## Header Pattern

Every major screen should start with clear context.

A header may include:

- Title
- Type
- Status
- Owner
- Key date
- Primary action

## Summary Pattern

Complex screens should include a summary before detailed lists.

## Detail Pattern

Object detail screens should show:

- Identity
- Status
- Owner
- Relationships
- Activity
- Actions

## Empty Workspace Pattern

New Workspaces should show guided next steps.

Do not leave users staring at blank panels.

---

# Mission Control Component Priority

Mission Control should use these components first:

1. Workspace Header
2. Mission Health Card
3. Priority Card
4. Milestone Card
5. Task Summary Card
6. People Summary Card
7. Document Summary Card
8. Activity Card
9. Suggested Action Card
10. Notes and Lessons Card

---

# Voice and Copy

Groundwork should speak clearly.

Preferred style:

- Direct
- Calm
- Useful
- Specific
- Human

Avoid:

- Vague labels
- Corporate filler
- Overly technical language
- Overly playful language in operational moments

Good product copy should help users act.

---

# Accessibility

Groundwork should be designed with accessibility from the start.

Initial standards:

- Do not rely on color alone
- Use readable contrast
- Use clear labels
- Support keyboard navigation in web views
- Keep tap targets comfortable on mobile
- Avoid tiny metadata that carries important meaning

---

# Design Tokens Placeholder

Future implementation should define design tokens for:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Motion
- Breakpoints
- Status styles

These tokens should become shared across Flutter, web, and design files.

---

# Future Work

Future design system documents should include:

- Color palette
- Typography scale
- Icon system
- Component specs
- Layout grid
- Form patterns
- Table patterns
- Mobile navigation
- Motion guidelines
- Accessibility checklist

---

# Design Standard

A Groundwork screen succeeds when a user feels oriented, prepared, and able to move forward.

Beauty matters.

But clarity wins first.
