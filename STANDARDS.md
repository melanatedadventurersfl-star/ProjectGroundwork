# Project Standards

## Project Groundwork

This document defines how Groundwork should be built, documented, reviewed, and maintained.

The goal is simple:

> Build Groundwork deliberately, consistently, and with a clear memory of why decisions were made.

---

# 1. Repository Purpose

This repository is the source of truth for Project Groundwork.

It should contain:

- Product vision
- Product principles
- Architecture decisions
- Ontology
- User experience planning
- Technical planning
- Design standards
- Future code

Major decisions should not live only in chat, memory, screenshots, or scattered notes.

If it matters, it belongs in the repository.

---

# 2. Documentation Standards

Documentation should be clear, practical, and decision-oriented.

Good documentation should answer at least one of these questions:

1. Why does this exist?
2. What problem does it solve?
3. How does it relate to the rest of Groundwork?
4. What decision has been made?
5. What should future contributors understand?

Avoid documentation that only sounds impressive but does not guide action.

---

# 3. Document Structure

Most product documents should follow this pattern:

```text
Title
Purpose
Context
Definition or Decision
Examples
Relationships
Open Questions
Related Documents
```

Ontology documents should follow this pattern:

```text
Title
Definition
Purpose
Core Properties
Relationships
Lifecycle
Actions
Permissions
Examples
Future Considerations
```

Architecture documents should follow this pattern:

```text
Title
Context
Decision or Model
Diagram
Implications
Tradeoffs
Related ADRs
Open Questions
```

---

# 4. Architecture Decision Records

Architecture Decision Records live in the `adr/` folder.

Use an ADR when a decision meaningfully affects product architecture, technical architecture, data modeling, permissions, navigation, or long-term direction.

ADR filenames should follow this format:

```text
ADR-0001-Short-Decision-Name.md
```

ADR status values:

- Proposed
- Accepted
- Superseded
- Rejected

Each ADR should include:

- Status
- Date
- Context
- Decision
- Alternatives considered
- Consequences
- Related documents

---

# 5. Decision Levels

Not every decision needs the same process.

## Level 1: Small Decision

Examples:

- Typo correction
- Small wording change
- Minor formatting cleanup

Documentation required:

- Commit message only

## Level 2: Product Decision

Examples:

- Add a new capability
- Change a workflow
- Rename a major concept

Documentation required:

- Update relevant product document

## Level 3: Architecture Decision

Examples:

- Change Workspace model
- Add a major system layer
- Change permission strategy

Documentation required:

- ADR
- Related document updates

## Level 4: Constitutional Decision

Examples:

- Change what Groundwork fundamentally is
- Change primary organizing principle
- Change core product philosophy

Documentation required:

- Discussion
- Product Constitution update
- ADR
- Related architecture updates

---

# 6. Naming Conventions

Use clear names that explain purpose.

## Files

Markdown files should use readable title case:

```text
Product Manifesto.md
Workspace Ontology.md
Core Architecture.md
```

ADR files should use numbered names:

```text
ADR-0001-Workspaces-Are-Primary.md
```

## Folders

Documentation folders should be numbered by reading order:

```text
01 Vision
02 Constitution
03 Vocabulary
04 Architecture
```

## Product Terms

Use vocabulary from:

```text
docs/03 Vocabulary/Groundwork Vocabulary.md
```

Do not introduce new major terms without updating the vocabulary.

---

# 7. Commit Message Standards

Use clear, lowercase prefixes.

Examples:

```text
docs: add product manifesto
adr: establish workspaces as primary user concept
chore: update documentation index
feat: add workspace model
fix: correct navigation wording
refactor: simplify capability definitions
```

Preferred prefixes:

- `docs:` documentation changes
- `adr:` architecture decision records
- `feat:` new feature or product addition
- `fix:` correction or bug fix
- `refactor:` restructure without changing meaning
- `chore:` maintenance work
- `test:` test-related work

Commit messages should explain the change, not just say that something changed.

---

# 8. Branch Standards

For now, direct commits to `main` are acceptable during early foundation work.

Once implementation begins, use branches.

Recommended branch patterns:

```text
docs/product-constitution
adr/workspaces-primary
feature/workspace-model
feature/mission-control
fix/navigation-copy
chore/repo-cleanup
```

Long-term, production code should flow through pull requests.

---

# 9. Definition of Done

A task is done when:

- The work is committed
- The related document is updated
- Related ADRs are created or updated if needed
- Vocabulary is updated if new terms are introduced
- Open questions are captured
- The change supports the Product Constitution

For code work, the definition of done will later include:

- Tests pass
- Linting passes
- Review completed
- Screenshots or demos attached when relevant

---

# 10. Product Review Checklist

Before accepting a new feature, ask:

1. Why does this exist?
2. What problem does it eliminate?
3. Which Groundwork principle does it support?
4. Does it belong in a Workspace, System, Capability, or Object?
5. Does it create duplicate information?
6. Does it make the user feel clearer or more burdened?
7. Can it become reusable knowledge later?

If these questions cannot be answered, the feature is not ready.

---

# 11. UX Standards

Groundwork should feel:

- Clear
- Calm
- Capable
- Organized
- Practical
- Action-oriented

Every screen should help answer:

> What should I do next?

Avoid screens that are only collections of data without context or action.

Navigation should begin with the user's work, not with database categories.

---

# 12. Technical Standards

The technical architecture should support:

- Multi-organization structure
- Workspace-level context
- Reusable capabilities
- Role-aware permissions
- Object history
- Templates
- Searchable knowledge
- Future mobile and web clients

Technical decisions should be documented before they become difficult to reverse.

---

# 13. AI Standards

AI features should be grounded in actual Groundwork data and clearly distinguish between:

- Known information
- Assumptions
- Suggestions

AI should help users plan, summarize, compare, and improve work.

AI should not replace human judgment.

---

# 14. Documentation Maintenance

Documentation is not a one-time activity.

When product thinking changes, update the documents.

When terminology changes, update the vocabulary.

When architecture changes, create or update an ADR.

When the roadmap changes, update the roadmap.

Stale documentation is worse than missing documentation because it creates false confidence.

---

# 15. Project Standard

Groundwork should be built with the same care it promises to give its users.

The product exists to reduce confusion, preserve knowledge, and make meaningful work easier to manage.

The way we build Groundwork should reflect that same philosophy.
