# Database Model v1

## Project Groundwork

This document defines the first conceptual database model for Groundwork.

This is not a final schema.

It is the first translation of the Object Model into likely data tables and relationships.

---

# Purpose

The Database Model should support the MVP while leaving room for future expansion.

It should preserve the core product architecture:

```text
Organization
    ↓
Workspace
    ↓
Capabilities and Objects
```

---

# MVP Tables

Initial MVP tables may include:

- organizations
- people
- users
- organization_memberships
- workspaces
- workspace_types
- workspace_people
- roles
- permissions
- tasks
- timelines
- milestones
- documents
- notes
- lessons_learned
- templates
- activities

---

# organizations

Represents a top-level organization.

Suggested fields:

- id
- name
- slug
- description
- brand_name
- status
- created_at
- updated_at

Relationships:

- Has many people
- Has many users through memberships
- Has many workspaces
- Has many templates

---

# people

Represents a human known to Groundwork.

Suggested fields:

- id
- organization_id
- first_name
- last_name
- display_name
- email
- phone
- status
- created_at
- updated_at

Notes:

A Person may exist without login access.

---

# users

Represents login access.

Suggested fields:

- id
- email
- auth_provider_id
- status
- created_at
- updated_at

Relationships:

- May connect to one or more people records depending on future account model

---

# organization_memberships

Connects users or people to organizations.

Suggested fields:

- id
- organization_id
- person_id
- user_id
- role_id
- status
- created_at
- updated_at

---

# workspace_types

Defines reusable Workspace patterns.

Suggested fields:

- id
- organization_id
- name
- description
- default_status
- is_system_default
- created_at
- updated_at

Examples:

- Experience
- Inventory
- Marketing
- Client Booking
- Training

---

# workspaces

Represents a dedicated home for work.

Suggested fields:

- id
- organization_id
- workspace_type_id
- name
- description
- status
- owner_person_id
- start_date
- target_date
- visibility
- archived_at
- created_at
- updated_at

Relationships:

- Belongs to organization
- Belongs to workspace type
- Has many tasks
- Has many milestones
- Has many documents
- Has many notes
- Has many lessons learned

---

# workspace_people

Connects people to workspaces.

Suggested fields:

- id
- workspace_id
- person_id
- role_id
- team_name
- status
- created_at
- updated_at

---

# roles

Defines named responsibility bundles.

Suggested fields:

- id
- organization_id
- name
- description
- scope
- is_system_default
- created_at
- updated_at

Example scopes:

- organization
- workspace
- team
- object

---

# permissions

Defines lower-level access controls.

Suggested fields:

- id
- key
- description
- category
- created_at
- updated_at

A future join table should connect roles to permissions.

---

# tasks

Represents a unit of work.

Suggested fields:

- id
- organization_id
- workspace_id
- title
- description
- status
- priority
- owner_person_id
- assigned_team
- due_date
- milestone_id
- created_at
- updated_at
- completed_at

---

# timelines

Represents a Workspace timeline.

Suggested fields:

- id
- workspace_id
- name
- description
- created_at
- updated_at

MVP may use one timeline per Workspace.

---

# milestones

Represents a significant date or phase marker.

Suggested fields:

- id
- timeline_id
- workspace_id
- name
- description
- status
- target_date
- owner_person_id
- created_at
- updated_at

---

# documents

Represents a file, link, or formal record.

Suggested fields:

- id
- organization_id
- workspace_id
- title
- description
- document_type
- url
- storage_path
- status
- owner_person_id
- created_at
- updated_at

---

# notes

Represents lightweight context.

Suggested fields:

- id
- organization_id
- workspace_id
- author_person_id
- title
- body
- pinned
- created_at
- updated_at

---

# lessons_learned

Represents reusable knowledge captured from work.

Suggested fields:

- id
- organization_id
- workspace_id
- title
- body
- category
- related_object_type
- related_object_id
- created_by_person_id
- created_at
- updated_at

---

# templates

Represents reusable Workspace structure.

Suggested fields:

- id
- organization_id
- source_workspace_id
- name
- description
- workspace_type_id
- template_data
- status
- created_by_person_id
- created_at
- updated_at

Notes:

The first version may store template content as structured JSON until the model becomes more mature.

---

# activities

Represents important changes across Groundwork.

Suggested fields:

- id
- organization_id
- workspace_id
- actor_person_id
- action
- object_type
- object_id
- summary
- created_at

---

# MVP Relationship Map

```text
organizations
    ├── people
    ├── workspace_types
    ├── roles
    ├── workspaces
    │       ├── workspace_people
    │       ├── tasks
    │       ├── timelines
    │       │       └── milestones
    │       ├── documents
    │       ├── notes
    │       ├── lessons_learned
    │       └── activities
    └── templates
```

---

# Database Principles

## 1. Organization scope first

Most records should include organization_id.

## 2. Workspace context matters

Most work records should connect to a Workspace.

## 3. Preserve history

Use activity records for meaningful changes.

## 4. Avoid premature complexity

Do not overbuild advanced relationships before the MVP proves the model.

## 5. Keep names aligned

Table and field names should align with the Groundwork Vocabulary where possible.

---

# Future Tables

Potential future tables:

- capabilities
- workspace_capabilities
- role_permissions
- teams
- inventory_items
- inventory_modules
- venues
- vendors
- budgets
- expenses
- revenue_records
- communications
- notifications
- attachments
- forms
- registrations
- insights

---

# Open Questions

- Should Person and User be separate from the start?
- How flexible should role scoping be in MVP?
- Should Workspace capabilities be explicit records in MVP?
- Should templates use JSON first or normalized template tables?
- What database technology should be used first?

---

# Standard

The database should support the product model without trapping Groundwork in a rigid early design.

Start simple, but do not erase the architecture.
