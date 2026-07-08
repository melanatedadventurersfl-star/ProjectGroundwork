# API Specification v1

## Project Groundwork

This document defines the first conceptual API specification for Groundwork.

This is not a final OpenAPI document.

It is a product-aligned map of the API resources the MVP will likely need.

---

# Purpose

The API should support the core Workspace model.

The MVP API should allow users to:

- Manage Organizations
- Manage People
- Manage Workspaces
- Manage Tasks
- Manage Timelines and Milestones
- Manage Documents
- Manage Notes
- Manage Lessons Learned
- Manage Templates
- Read Activity

---

# API Principles

## 1. Use product language

Endpoint names should align with the Object Model and Vocabulary.

## 2. Keep Workspace context clear

Workspace-scoped resources should be easy to query by Workspace.

## 3. Support role-aware access

API responses should respect permissions.

## 4. Keep MVP simple

Avoid advanced abstraction until the MVP proves the model.

---

# Resource Groups

Initial resource groups:

- Auth
- Organizations
- People
- Workspaces
- Tasks
- Timelines
- Milestones
- Documents
- Notes
- Lessons Learned
- Templates
- Activity

---

# Organizations

## List Organizations

```text
GET /organizations
```

Returns Organizations the current user can access.

## Get Organization

```text
GET /organizations/{organizationId}
```

Returns one Organization.

## Create Organization

```text
POST /organizations
```

Creates a new Organization.

## Update Organization

```text
PATCH /organizations/{organizationId}
```

Updates Organization settings.

---

# People

## List People

```text
GET /organizations/{organizationId}/people
```

Returns people in an Organization.

## Get Person

```text
GET /people/{personId}
```

Returns one Person.

## Create Person

```text
POST /organizations/{organizationId}/people
```

Creates a Person record.

## Update Person

```text
PATCH /people/{personId}
```

Updates a Person.

---

# Workspaces

## List Workspaces

```text
GET /organizations/{organizationId}/workspaces
```

Returns Workspaces available to the current user.

Possible filters:

```text
status
type
owner
search
```

## Get Workspace

```text
GET /workspaces/{workspaceId}
```

Returns Workspace details.

## Create Workspace

```text
POST /organizations/{organizationId}/workspaces
```

Creates a Workspace.

## Update Workspace

```text
PATCH /workspaces/{workspaceId}
```

Updates Workspace details.

## Archive Workspace

```text
POST /workspaces/{workspaceId}/archive
```

Archives a Workspace.

---

# Mission Control

## Get Mission Control Summary

```text
GET /workspaces/{workspaceId}/mission-control
```

Returns a summary used by the Mission Control screen.

Response may include:

- Workspace header data
- Mission Health
- Priorities
- Upcoming milestones
- Open tasks
- People summary
- Document summary
- Recent activity
- Suggested next actions

---

# Tasks

## List Workspace Tasks

```text
GET /workspaces/{workspaceId}/tasks
```

Returns Tasks in a Workspace.

## Get Task

```text
GET /tasks/{taskId}
```

Returns one Task.

## Create Task

```text
POST /workspaces/{workspaceId}/tasks
```

Creates a Task.

## Update Task

```text
PATCH /tasks/{taskId}
```

Updates a Task.

## Complete Task

```text
POST /tasks/{taskId}/complete
```

Marks a Task complete.

---

# Timeline and Milestones

## Get Workspace Timeline

```text
GET /workspaces/{workspaceId}/timeline
```

Returns Timeline and Milestones.

## Create Milestone

```text
POST /workspaces/{workspaceId}/milestones
```

Creates a Milestone.

## Update Milestone

```text
PATCH /milestones/{milestoneId}
```

Updates a Milestone.

---

# Workspace People

## List Workspace People

```text
GET /workspaces/{workspaceId}/people
```

Returns people connected to the Workspace.

## Add Person to Workspace

```text
POST /workspaces/{workspaceId}/people
```

Adds a Person to a Workspace with a role.

## Update Workspace Person

```text
PATCH /workspaces/{workspaceId}/people/{personId}
```

Updates role, status, or team assignment.

## Remove Person from Workspace

```text
DELETE /workspaces/{workspaceId}/people/{personId}
```

Removes a Person from the Workspace context.

---

# Documents

## List Workspace Documents

```text
GET /workspaces/{workspaceId}/documents
```

Returns Documents in a Workspace.

## Add Document

```text
POST /workspaces/{workspaceId}/documents
```

Adds a file reference or link.

## Update Document

```text
PATCH /documents/{documentId}
```

Updates document metadata.

---

# Notes

## List Workspace Notes

```text
GET /workspaces/{workspaceId}/notes
```

Returns Notes in a Workspace.

## Create Note

```text
POST /workspaces/{workspaceId}/notes
```

Creates a Note.

## Update Note

```text
PATCH /notes/{noteId}
```

Updates a Note.

---

# Lessons Learned

## List Lessons

```text
GET /workspaces/{workspaceId}/lessons-learned
```

Returns Lessons Learned for a Workspace.

## Create Lesson

```text
POST /workspaces/{workspaceId}/lessons-learned
```

Creates a Lesson Learned.

## Update Lesson

```text
PATCH /lessons-learned/{lessonId}
```

Updates a Lesson Learned.

---

# Templates

## List Templates

```text
GET /organizations/{organizationId}/templates
```

Returns available Templates.

## Create Template from Workspace

```text
POST /workspaces/{workspaceId}/create-template
```

Creates a Template from a Workspace.

## Create Workspace from Template

```text
POST /templates/{templateId}/create-workspace
```

Creates a Workspace using a Template.

---

# Activity

## List Workspace Activity

```text
GET /workspaces/{workspaceId}/activity
```

Returns recent activity in a Workspace.

## List Organization Activity

```text
GET /organizations/{organizationId}/activity
```

Returns recent activity across an Organization.

---

# Suggested Response Shape

Most API responses should use a predictable structure:

```json
{
  "data": {},
  "meta": {},
  "errors": []
}
```

List responses may include pagination:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 100
  },
  "errors": []
}
```

---

# Future API Areas

Future API resources may include:

- Capabilities
- Inventory
- Budget
- Registration
- Forms
- Communications
- Notifications
- Search
- Insights
- AI Assistance

---

# Open Questions

- Should the API be REST-first or GraphQL-first?
- Should Mission Control be a composed endpoint or assembled client-side?
- How much permission logic should be visible in API responses?
- Should templates use structured JSON or normalized resources first?

---

# Standard

The API should make Groundwork's product model easy to build, not harder to understand.
