# Navigation Model

## Project Groundwork

This document defines how users move through Groundwork.

Groundwork navigation should begin with the user's work, not with database categories.

---

# Navigation Principle

Users should not need to understand the internal architecture to use Groundwork.

The product should guide users from context to action.

Recommended user-facing flow:

```text
Home
    ↓
Workspaces
    ↓
Mission Control
    ↓
Actions and Detail Screens
```

---

# Top-Level Navigation

Initial top-level navigation:

1. Home
2. Workspaces
3. My Work
4. People
5. Resources
6. Insights
7. Settings

---

# Home

Home is the role-aware landing page.

Home should answer:

- What needs my attention?
- What am I responsible for?
- What is coming up?
- Where should I go next?

Home should route users into Workspaces, Tasks, or important updates.

---

# Workspaces

Workspaces is the primary product area.

Users should use Workspaces to access real bodies of work.

Examples:

- Little Camp of Horrors
- Trailer Inventory
- Build-A-Camp Client Booking
- Volunteer Onboarding
- Marketing Campaign

Workspace navigation should feel like entering a dedicated room for that work.

---

# Workspace Navigation

Inside a Workspace, navigation should be consistent.

Recommended Workspace tabs:

1. Mission Control
2. Timeline
3. Tasks
4. People
5. Documents
6. Resources
7. Notes
8. Lessons Learned
9. Settings

Additional tabs may appear when capabilities are enabled.

Examples:

- Budget
- Inventory
- Registration
- Forms
- Insights

---

# My Work

My Work shows the user's personal responsibilities.

It should collect assigned work across Workspaces.

Should include:

- My tasks
- Upcoming due dates
- My teams
- Workspaces I lead
- Workspaces needing my input

---

# People

People shows people connected to the Organization.

It should support:

- Members
- Guests
- Volunteers
- Workers
- Clients
- Vendors
- Partners
- Leads

People should not be duplicated just because a person has multiple roles.

---

# Resources

Resources is the place for reusable organizational assets.

Examples:

- Documents
- Templates
- Inventory
- Venues
- Vendors
- Vehicles
- Guides
- Knowledge

Resources should support reuse across Workspaces.

---

# Insights

Insights should summarize meaningful patterns.

Examples:

- Workspace progress
- Repeated blockers
- Task trends
- Resource usage
- Lessons learned
- Budget patterns

Insights should lead to action or understanding.

---

# Settings

Settings should be available based on role and permission.

Settings may include:

- Organization settings
- People and roles
- Workspace types
- Capabilities
- Branding
- Templates
- Billing

---

# Mobile Navigation

Mobile should focus on the most common actions.

Recommended mobile bottom navigation:

1. Home
2. Workspaces
3. My Work
4. Resources
5. More

The More tab may contain People, Insights, and Settings.

Inside a Workspace, mobile should use a compact tab or menu pattern.

---

# Breadcrumbs

Desktop views should support breadcrumbs when helpful.

Example:

```text
Home / Workspaces / Little Camp of Horrors / Tasks
```

Breadcrumbs should clarify location without replacing primary navigation.

---

# Navigation Rules

## 1. Start with context

Users should enter through Home or Workspaces.

## 2. Keep Workspace navigation stable

Users should not relearn navigation for every Workspace Type.

## 3. Hide unavailable capabilities

If a capability is not enabled, do not show an empty tab unless it helps users enable it.

## 4. Use role-aware views

Users should see what matches their responsibility.

## 5. Preserve orientation

Every screen should make it clear where the user is.

---

# Future Considerations

Future navigation may support:

- Global search
- Command palette
- Recent Workspaces
- Favorites
- Notifications
- Cross-Workspace views
- Public pages
- Client portals

---

# Design Standard

Navigation succeeds when users spend less time looking for work and more time moving work forward.
