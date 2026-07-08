# Flutter App Architecture

## Project Groundwork

This document defines the initial architecture direction for a future Flutter implementation of Groundwork.

It is not final code structure.

It is a planning document to keep the Flutter app aligned with the product architecture.

---

# Goal

The Flutter app should be organized around Groundwork's product model:

```text
Organization
    ↓
Workspace
    ↓
Capability
    ↓
Object
```

The app should make Workspaces feel central, calm, and actionable.

---

# Recommended App Layers

Recommended Flutter structure:

```text
presentation
application
domain
data
core
```

---

# presentation

The presentation layer contains UI.

Examples:

- Screens
- Widgets
- Components
- Navigation
- View models or controllers

Responsibilities:

- Render interface
- Capture user actions
- Display loading and error states
- Use design system components
- Avoid business logic where possible

---

# application

The application layer coordinates use cases.

Examples:

- CreateWorkspaceUseCase
- AddTaskUseCase
- AssignPersonUseCase
- ArchiveWorkspaceUseCase
- CreateTemplateUseCase

Responsibilities:

- Coordinate domain objects
- Call repositories
- Prepare screen state
- Apply workflow rules

---

# domain

The domain layer contains core product models and rules.

Examples:

- Organization
- Workspace
- Person
- Role
- Task
- Timeline
- Milestone
- Document
- Template

Responsibilities:

- Define entities
- Define value objects
- Preserve product meaning
- Avoid UI or database details

---

# data

The data layer handles persistence and external communication.

Examples:

- API clients
- Repositories
- DTOs
- Local storage
- Serialization

Responsibilities:

- Fetch data
- Save data
- Map API responses to domain models
- Handle caching if needed

---

# core

The core layer contains shared utilities.

Examples:

- Theme
- Routing helpers
- Constants
- Error handling
- Shared widgets
- App configuration

---

# Suggested Folder Structure

```text
lib/
  core/
    theme/
    routing/
    errors/
    utils/
  design_system/
    components/
    tokens/
  features/
    home/
    workspaces/
    mission_control/
    tasks/
    timeline/
    people/
    documents/
    notes/
    lessons/
    templates/
    settings/
  domain/
    models/
    repositories/
    value_objects/
  data/
    api/
    dto/
    repositories/
```

---

# Feature Structure

Each feature may use this pattern:

```text
feature_name/
  presentation/
    screens/
    widgets/
    controllers/
  application/
    use_cases/
  data/
    dto/
    repositories/
```

For MVP, avoid excessive abstraction.

Use structure where it helps clarity.

---

# State Management

State management should be chosen later.

Options to consider:

- Riverpod
- Bloc
- Provider

Selection criteria:

- Easy to test
- Clear separation of state and UI
- Works well with async data
- Supports future app complexity
- Does not overcomplicate MVP

---

# Routing

Routing should support:

- Home
- Workspace list
- Workspace detail
- Workspace tabs
- Object detail screens
- Settings

Route examples:

```text
/home
/workspaces
/workspaces/:workspaceId/mission-control
/workspaces/:workspaceId/tasks
/workspaces/:workspaceId/timeline
/workspaces/:workspaceId/people
/workspaces/:workspaceId/documents
/settings
```

---

# Design System Usage

Flutter screens should be built from shared components.

Initial components:

- GroundworkButton
- GroundworkCard
- WorkspaceCard
- MissionHealthCard
- StatusBadge
- PersonChip
- TaskCard
- MilestoneCard
- EmptyState
- ActivityItem

Avoid building one-off components when a reusable component is appropriate.

---

# MVP Build Order

Recommended Flutter MVP order:

1. App shell and theme
2. Routing
3. Home screen
4. Workspace list
5. Create Workspace
6. Mission Control
7. Tasks
8. Timeline
9. People
10. Documents
11. Notes
12. Lessons Learned
13. Templates

---

# Testing Direction

Future testing should include:

- Widget tests for components
- Unit tests for domain logic
- Use case tests
- Repository tests
- Integration tests for primary flows

MVP testing can start small but should not be ignored.

---

# Flutter Principles

## 1. Keep product language visible

Use names from the Vocabulary and Object Model.

## 2. Build reusable components early

Mission Control should not become a pile of custom cards.

## 3. Separate UI from product logic

Screens should display state, not invent rules.

## 4. Design for mobile and web

Groundwork may need both.

## 5. Keep the MVP buildable

Architecture should guide the app, not suffocate it.

---

# Open Questions

- Which state management package should be used?
- Will the first version target mobile, web, or both?
- What authentication provider should be used?
- Should offline support be considered early?
- How much of the design system should be coded before MVP screens?

---

# Standard

The Flutter app should feel like the product architecture made visible.

Workspaces first.

Actions clear.

Components reusable.
