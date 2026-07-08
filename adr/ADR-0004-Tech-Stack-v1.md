# ADR-0004: Tech Stack v1

- **Status:** Accepted
- **Date:** 2026-07-07

---

# Context

Groundwork is ready to move from product blueprinting into implementation planning.

The initial technical stack should support fast MVP development while preserving the long-term architecture.

The stack should support:

- Flutter app development
- Multi-organization data
- Authentication
- PostgreSQL-backed structured data
- File storage
- Role-aware permissions
- Future web and mobile clients
- Reasonable speed to MVP

---

# Decision

Groundwork will use the following initial stack:

- **Frontend:** Flutter
- **Backend:** Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **State Management:** Riverpod
- **Initial Hosting:** Flutter Web plus Supabase

---

# Rationale

Flutter allows Groundwork to target mobile and web from a shared codebase.

Supabase provides a fast path to authentication, PostgreSQL, storage, generated APIs, and security policies without requiring a custom backend on day one.

PostgreSQL fits Groundwork's structured object model and relationship-heavy architecture.

Riverpod gives the Flutter app a clean way to manage application state without making the MVP overly complex.

This stack lets Groundwork start building quickly while still supporting a serious long-term product foundation.

---

# Consequences

Groundwork can begin MVP development without first building a custom backend.

The project should still keep domain logic and product architecture clean so the system can evolve later if needed.

Supabase-specific implementation details should not be allowed to erase Groundwork's domain model.

The app should still be organized around:

```text
Organization
    ↓
Workspace
    ↓
Capability
    ↓
Object
```

---

# Tradeoffs

## Benefits

- Faster MVP path
- PostgreSQL database from the start
- Built-in authentication
- Built-in storage
- Good Flutter compatibility
- Less custom backend work early

## Risks

- Supabase choices may influence the data model too early
- Row-level security policies require careful planning
- Future migration may require work if the product outgrows the initial backend setup

---

# Guardrails

- Keep product language aligned with the Object Model.
- Do not let database convenience override Workspace architecture.
- Document major Supabase-specific decisions.
- Keep Flutter domain models separate from raw API/database structures.
- Create additional ADRs for authentication, database schema, and deployment if needed.

---

# Related Documents

- `docs/10 Technical/Technical Architecture.md`
- `docs/10 Technical/Flutter App Architecture.md`
- `docs/10 Technical/Database Model v1.md`
- `docs/10 Technical/API Specification v1.md`
- `docs/10 Technical/Permission Matrix v1.md`
