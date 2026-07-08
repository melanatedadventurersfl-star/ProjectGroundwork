# ADR-0003: Experience Is a Workspace Type

- **Status:** Accepted
- **Date:** 2026-07-07

---

# Context

Groundwork began with a strong connection to event and experience planning.

However, Groundwork is intended to become a broader operating system for repeatable work, not only event software.

If Experience becomes the top-level product concept, the platform may become too narrow.

---

# Decision

An **Experience** will be treated as a **Workspace Type**.

A Workspace is the primary user-facing home for work.

An Experience is a specialized Workspace used for real-world gatherings, trips, events, programs, and services.

---

# Rationale

This keeps Groundwork flexible.

The same platform can support:

- Little Camp of Horrors
- Trailer Inventory
- Build-A-Camp Client Booking
- Marketing Campaign
- Volunteer Onboarding
- Product Development

All of these can be Workspaces.

Experience is important, but it is not the whole product.

---

# Consequences

Groundwork should not use Experience as the highest-level navigation concept.

Users should navigate to Workspaces first.

Experience-specific features should be enabled through Workspace Type defaults and Capabilities.

---

# Related Documents

- `adr/ADR-0001-Workspaces-Are-Primary.md`
- `docs/05 Ontology/Workspace Ontology.md`
- `docs/05 Ontology/Experience Ontology.md`
