# ADR-0001: Workspaces Are the Primary User Concept

- **Status:** Accepted
- **Date:** 2026-07-07
- **Authors:** Jonathan Carr, Project Groundwork

---

# Context

During the foundation phase of Groundwork, we explored several possible architectural models.

Initial concepts centered around Experiences as the primary object. While this worked well for event planning, it limited the platform's ability to support operational work outside of events.

Examples included:

- Inventory Management
- Marketing Campaigns
- Product Development
- Volunteer Programs
- Fleet Management
- Client Bookings

These activities are not experiences themselves, but they still require collaboration, planning, documents, communication, timelines, and organizational knowledge.

A broader abstraction was needed.

---

# Decision

Groundwork will use **Workspaces** as the primary user-facing concept.

A Workspace represents a dedicated environment where meaningful work happens.

Every Workspace provides a consistent experience while enabling different capabilities depending on its purpose.

Examples include:

- Little Camp of Horrors
- Float Out
- Trailer Inventory
- Build-A-Camp Client #284
- Marketing Campaign
- Volunteer Onboarding
- Product Development

Users will primarily navigate between Workspaces rather than between application modules.

---

# Alternatives Considered

## Experiences as the Primary Object

### Advantages

- Simple for event planning.
- Familiar terminology.

### Disadvantages

- Does not naturally support operational work.
- Forces non-event activities into an event model.
- Limits future expansion.

Decision: Rejected.

---

## Systems as the Primary Object

### Advantages

- Clean architectural separation.
- Reflects organizational structure.

### Disadvantages

- Introduces unnecessary complexity for users.
- Users think about their work, not internal systems.
- Better suited as an implementation detail.

Decision: Rejected as the primary user experience.

Systems remain an internal architectural layer.

---

# Rationale

People organize around outcomes.

Not modules.

Not databases.

Not systems.

When someone opens Groundwork they think:

> I need to work on Little Camp of Horrors.

Not:

> I need to enter the Event Module.

Workspaces provide context.

Everything related to that work exists together:

- People
- Tasks
- Documents
- Budget
- Timeline
- Communications
- Knowledge
- Analytics

The Workspace becomes the center of the user's experience.

---

# Consequences

This decision establishes the core navigation model for Groundwork.

Internally, the architecture becomes:

```text
Organization
    ↓
Systems
    ↓
Workspaces
    ↓
Capabilities
    ↓
Objects
```

Externally, users primarily interact with Workspaces.

This allows Groundwork to support virtually any type of organized work without changing its core architecture.

---

# Benefits

- Future-proof architecture
- Consistent navigation
- Flexible capability model
- Reusable operational patterns
- Reduced cognitive load
- Domain-independent design

---

# Risks

Workspaces may become overloaded if capabilities are not carefully managed.

To mitigate this, capabilities will remain modular and enabled only when appropriate for a given Workspace.

---

# Related Documents

- Product Manifesto
- Product Constitution
- Core Architecture
- Workspace Ontology
- Capability Catalog

---

# Notes

This ADR represents the first major architectural decision of Project Groundwork.

Future architectural decisions should reference this document when determining how new features integrate into the platform.
