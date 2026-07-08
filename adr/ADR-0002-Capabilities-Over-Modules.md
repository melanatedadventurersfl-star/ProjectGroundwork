# ADR-0002: Capabilities Over Modules

- **Status:** Accepted
- **Date:** 2026-07-07

---

# Context

Groundwork needs to support many kinds of work without becoming a separate app for every use case.

Examples include:

- Experiences
- Inventory
- Marketing
- Client bookings
- Volunteer programs
- Product development

A traditional module-based system could create silos and make the product harder to extend.

---

# Decision

Groundwork will use reusable **Capabilities** instead of rigid, hardcoded modules.

A Capability is a reusable tool that can be enabled inside a Workspace.

Examples:

- Tasks
- Timeline
- Documents
- Budget
- Inventory
- Notes
- Templates

---

# Rationale

Capabilities allow Groundwork to build flexible Workspace Types without duplicating the same feature in multiple places.

For example, an Experience Workspace and a Marketing Workspace may both need Tasks, Timeline, Documents, and Notes.

The capability model lets Groundwork build once and reuse often.

---

# Consequences

This decision affects:

- Product architecture
- Screen design
- Permissions
- Database planning
- Future feature development

New features should be evaluated as:

1. A reusable Capability
2. A feature inside an existing Capability
3. A new Object
4. A Workspace Type default

---

# Related Documents

- `docs/04 Architecture/Core Architecture.md`
- `docs/04 Architecture/Object Model.md`
- `docs/06 Capabilities/Capability Catalog.md`
