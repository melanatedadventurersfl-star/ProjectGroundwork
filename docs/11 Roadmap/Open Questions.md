# Open Questions

## Project Groundwork

This document collects unresolved questions that should be answered before or during implementation.

Open questions are not blockers by default.

They are places where the project needs future clarity.

---

# Product Questions

## Workspace Model

- Should every body of work be a Workspace?
- Are there any concepts that should exist outside Workspaces?
- Should Workspaces support parent-child relationships in MVP?
- How should recurring Workspaces work?

## Workspace Types

- Which Workspace Types should exist in MVP?
- Should Workspace Types be editable by Organization Owners?
- Should custom Workspace Types be allowed early?

## Mission Control

- Should Mission Health use a score, label, or both?
- Which Mission Control cards are required in MVP?
- Should users be able to customize card order?
- How should role-specific Mission Control views differ?

## Templates

- What should be included when creating a Template from a Workspace?
- Should users choose what gets copied?
- Should Lessons Learned be included by default?
- Should templates be organization-wide or personal?

---

# UX Questions

- Should the first version prioritize mobile, web, or both?
- Should navigation use tabs, sidebars, or a hybrid layout?
- Should Mission Control be more dashboard-like or checklist-like?
- How much setup guidance should a new Workspace show?
- Should empty states be conversational or minimal?

---

# Technical Questions

## Stack

- What backend should Groundwork use first?
- Should Supabase, Firebase, custom API, or another backend be considered?
- Should the MVP be Flutter web first, mobile first, or both?
- What authentication provider should be used?

## Database

- Should Person and User be separate from day one?
- Should templates use JSON first or normalized records?
- Should capabilities be explicit database records in MVP?
- How flexible should role scoping be in the first version?

## API

- Should the API be REST-first or GraphQL-first?
- Should Mission Control be served by one composed endpoint?
- Should the client assemble Mission Control from separate endpoints?
- How should pagination, filtering, and sorting be standardized?

---

# Permission Questions

- Should Members have login access in MVP?
- Should Guests exist as records before registration features?
- Should Team Lead be included in MVP?
- How much can Workspace Leads configure without Organization Owner approval?
- Should object-level permissions exist in MVP or later?

---

# Design System Questions

- What should the final Groundwork color palette be?
- Should the visual style lean more field-guide, SaaS, or command-center?
- What icon system should be used?
- What typography should be used in Flutter?
- Should dark mode be supported from the start?

---

# Business and Product Direction Questions

- Is Groundwork first an internal operating system for MA/BAC or a broader SaaS platform?
- What is the first external user segment?
- What should be free versus paid in the future?
- Should Groundwork eventually support multiple organizations under one account?
- Should client booking become a primary product line or a capability?

---

# Research Questions

- How do community organizers currently manage repeatable work?
- What information gets lost most often?
- What makes teams feel unprepared?
- Which planning tools do users already tolerate but dislike?
- What would make Groundwork feel obviously useful in the first 10 minutes?

---

# Standard

Open questions should be reviewed regularly.

When a question is answered, update the relevant document and create an ADR if the answer changes architecture.
