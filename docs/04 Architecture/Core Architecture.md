# Core Architecture

## Project Groundwork

Groundwork is designed as an organizational operating system built around purpose-driven workspaces, reusable capabilities, and structured operational knowledge.

The architecture exists to keep the platform flexible without becoming chaotic.

---

# Foundational Layers

Groundwork is organized into five layers:

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

Each layer has a clear responsibility.

| Layer | Responsibility |
|---|---|
| Organization | Owns the account, people, settings, branding, permissions, and billing |
| System | Represents a permanent operational function |
| Workspace | Provides the user-facing home for meaningful work |
| Capability | Provides reusable tools within workspaces |
| Object | Represents structured information managed by the platform |

---

# Organization

An Organization is the top-level owner of work inside Groundwork.

An Organization may represent a company, nonprofit, community group, chapter, department, or team.

Organizations own people, systems, workspaces, settings, templates, and knowledge.

The Organization layer answers:

> Who owns this work?

---

# System

A System is a permanent operational function inside an Organization.

Examples include:

- Experience System
- Inventory System
- Volunteer System
- Marketing System
- Finance System
- Fleet System
- Knowledge System
- Communications System

Systems are important internally, but they should not dominate the user interface.

The System layer answers:

> What operational area does this belong to?

---

# Workspace

A Workspace is the primary user-facing home for work.

Workspaces organize people, tasks, timelines, documents, resources, communication, and knowledge around a specific purpose.

Examples include:

- Little Camp of Horrors
- Float Out
- Trailer Inventory
- Build-A-Camp Client Booking
- Marketing Campaign
- Volunteer Onboarding
- Product Development

The Workspace layer answers:

> What are we working on?

---

# Capability

A Capability is a reusable tool that can be enabled inside a Workspace.

Examples include:

- Tasks
- Timeline
- Budget
- Documents
- Inventory
- Communications
- Forms
- Ticketing
- Knowledge Base
- Analytics
- AI Assistance

Capabilities are designed once and reused across many Workspace types.

The Capability layer answers:

> What tools does this Workspace need?

---

# Object

Objects are the structured pieces of information managed by Groundwork.

Examples include:

- Person
- Venue
- Task
- Inventory Item
- Vehicle
- Budget
- Expense
- Vendor
- Sponsor
- Document
- Communication
- Lesson Learned

Objects should have identity, context, ownership, status, history, and relationships.

The Object layer answers:

> What information are we managing?

---

# Primary Architecture Rule

Groundwork uses Workspaces as the primary user-facing concept.

This decision is captured in:

`adr/ADR-0001-Workspaces-Are-Primary.md`

Users should primarily navigate to the work they care about, not to disconnected modules.

---

# Architecture Standard

Groundwork should remain flexible at the architecture level and simple at the user experience level.

The platform should support complex organizations without forcing complexity onto everyday users.
