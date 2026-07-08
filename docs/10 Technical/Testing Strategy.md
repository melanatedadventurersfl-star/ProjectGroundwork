# Testing Strategy

## Project Groundwork

This document defines the initial testing strategy for Groundwork.

Testing should protect product quality as Groundwork moves from documentation into implementation.

---

# Testing Goal

Groundwork should be tested at the levels where mistakes would hurt clarity, trust, or operations.

Testing should help ensure that:

- Core flows work
- Permissions behave correctly
- Data relationships are preserved
- UI components are reliable
- Product rules remain consistent
- Future changes do not break foundational behavior

---

# Testing Principles

## 1. Test product behavior, not just code

Tests should reflect what users need to accomplish.

## 2. Protect the Workspace model

Workspace-centered behavior is the heart of Groundwork.

## 3. Test permissions early

Access mistakes can create confusion and trust issues.

## 4. Keep MVP testing practical

Do not build an enormous test suite before the product exists.

Start with the most important flows.

---

# Test Types

## Unit Tests

Used for small pieces of logic.

Examples:

- Workspace status changes
- Task status rules
- Mission Health calculations
- Permission checks
- Template creation logic

---

## Widget Tests

Used for Flutter components.

Examples:

- GroundworkButton
- WorkspaceCard
- MissionHealthCard
- TaskCard
- StatusBadge
- EmptyState

---

## Use Case Tests

Used for application workflows.

Examples:

- Create Workspace
- Add Task
- Assign Person
- Archive Workspace
- Create Template
- Add Lesson Learned

---

## Integration Tests

Used for full flows across multiple layers.

Examples:

- User creates a Workspace and lands on Mission Control
- User creates tasks and sees them reflected in Mission Control
- User archives a Workspace after capturing lessons learned

---

## API Tests

Used for backend endpoints.

Examples:

- Create workspace endpoint
- List workspace tasks endpoint
- Mission Control summary endpoint
- Permission-protected endpoints

---

# MVP Test Priorities

The MVP should test:

1. Create Workspace
2. View Workspace List
3. View Mission Control
4. Create Task
5. Assign Task
6. Add Person to Workspace
7. Add Document
8. Add Note
9. Add Lesson Learned
10. Create Template from Workspace
11. Archive Workspace

---

# Permission Test Priorities

Permission tests should verify:

- Organization Owner can manage organization-level settings
- Workspace Lead can manage assigned Workspace
- Team Lead can manage team-related work
- Worker can view and update assigned tasks
- Volunteer can view and update assigned tasks
- Member cannot view internal planning screens
- Guest cannot view private Workspace data

---

# Component Test Priorities

Design system components should be tested for:

- Required content appears
- Status labels render correctly
- Empty states display appropriate guidance
- Buttons trigger expected callbacks
- Cards handle missing optional values gracefully

---

# Test Data

Use realistic sample data.

Recommended sample Workspace:

**Little Camp of Horrors**

Recommended sample objects:

- Workspace Lead
- Team Lead
- Volunteer
- Task
- Milestone
- Document
- Lesson Learned
- Template

Sample data should feel real enough to reveal product issues.

---

# Definition of Tested

A feature is tested when:

- Core success path is covered
- At least one failure or empty state is covered
- Permissions are covered when relevant
- UI state is covered when relevant
- Related product rules are protected

---

# Future Testing Work

Future testing plans should include:

- End-to-end test suite
- Accessibility testing
- Performance testing
- Offline behavior testing
- Data migration tests
- Security testing
- Regression suite for major flows

---

# Standard

Testing should help Groundwork stay dependable as it grows.

The goal is not test theater.

The goal is confidence.
