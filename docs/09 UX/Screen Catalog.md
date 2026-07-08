# Screen Catalog

## Project Groundwork

This document defines the initial screen inventory for Groundwork.

The Screen Catalog is a product planning tool. It helps define what screens exist, what each screen is responsible for, and how screens relate to user roles and capabilities.

---

# Purpose

The Screen Catalog should help future design and development work by answering:

- What screens does Groundwork need?
- What is each screen responsible for?
- Which users need each screen?
- Which capabilities support each screen?
- Which screens belong in the MVP?

---

# MVP Screen Set

The MVP should focus on a small set of screens that prove the Workspace model.

Recommended MVP screens:

1. Home
2. Workspace List
3. Create Workspace
4. Workspace Mission Control
5. Workspace Tasks
6. Workspace Timeline
7. Workspace People
8. Workspace Documents
9. Workspace Notes
10. Lessons Learned
11. Templates
12. Settings

---

# Home

## Purpose

Home gives each user a role-aware starting point.

## Primary Users

- Organization Owner
- Workspace Lead
- Team Lead
- Worker
- Volunteer

## Should Show

- Active Workspaces
- Assigned work
- Upcoming milestones
- Items needing attention
- Recent activity
- Suggested next actions

## MVP Requirement

Home can be simple in the first version.

It should link users to their Workspaces and assigned tasks.

---

# Workspace List

## Purpose

Shows Workspaces the user can access.

## Primary Users

- Organization Owner
- Workspace Lead
- Team Lead
- Worker
- Volunteer

## Should Show

- Workspace name
- Workspace type
- Status
- Owner
- Key date
- Mission Health or readiness signal
- Next action

## Filters

- Type
- Status
- Owner
- Date
- Recent activity

---

# Create Workspace

## Purpose

Guides users through creating a new Workspace.

## Should Capture

- Workspace name
- Workspace type
- Description
- Owner
- Start date
- Target date
- Visibility
- Template selection
- Enabled capabilities

## MVP Requirement

The first version should support creating a Workspace from scratch or from a basic template.

---

# Workspace Mission Control

## Purpose

Provides the main operational view of a Workspace.

## Should Show

- Workspace header
- Mission Health
- Today's priorities
- Upcoming milestones
- Open tasks
- People summary
- Documents summary
- Recent activity
- Suggested next actions

## Related Documents

- `Mission Control Screen Spec.md`
- `Mission Control Wireframe.md`

---

# Workspace Tasks

## Purpose

Manages all tasks connected to a Workspace.

## Should Support

- Create task
- Edit task
- Assign task
- Set due date
- Set status
- Filter tasks
- Group by owner, status, or milestone

## MVP Requirement

A list view is enough for MVP.

Board and calendar views can come later.

---

# Workspace Timeline

## Purpose

Shows phases, milestones, and important dates.

## Should Support

- Add milestone
- Set date
- Link tasks
- Mark milestone status
- View upcoming milestones

## MVP Requirement

A simple milestone list is enough for MVP.

---

# Workspace People

## Purpose

Shows people connected to a Workspace and their roles.

## Should Support

- Add person
- Assign role
- Group by team
- Show responsibility
- Show pending roles

## MVP Requirement

Support people, roles, and basic teams.

---

# Workspace Documents

## Purpose

Stores files, links, and structured records related to a Workspace.

## Should Support

- Add document
- Add link
- Add description
- Assign type
- View recent documents
- Connect document to tasks or milestones

## MVP Requirement

Documents can start as links or file references.

---

# Workspace Notes

## Purpose

Captures lightweight context that may not belong in a formal object yet.

## Should Support

- Add note
- Edit note
- Pin important note
- Connect note to an object
- Convert note into a task or lesson later

---

# Lessons Learned

## Purpose

Captures reusable knowledge from completed work.

## Should Support

- Add lesson
- Categorize lesson
- Connect lesson to Workspace, Venue, Vendor, Inventory, or Task
- Include lesson in future templates

## MVP Requirement

A simple lesson list is enough for MVP.

---

# Templates

## Purpose

Turns repeatable work into reusable starting points.

## Should Support

- View templates
- Create template from Workspace
- Use template to create Workspace
- Include tasks, timeline, roles, documents, and lessons learned

## MVP Requirement

Support creating and using a basic Workspace template.

---

# Settings

## Purpose

Manages configuration.

## Should Support

- Organization settings
- People and roles
- Workspace types
- Capabilities
- Branding
- Templates

## MVP Requirement

Settings can start small and expand later.

---

# Future Screens

Potential future screens:

- Inventory Dashboard
- Budget Dashboard
- Registration Management
- Form Builder
- Public Experience Page
- Client Booking Portal
- Vendor Portal
- Member Profile
- Insights Dashboard
- Search Results
- Notification Center
- Admin Console

---

# Screen Design Standard

Every screen should answer:

> What is this for, what matters here, and what should the user do next?

Screens should not exist just because data exists.

Screens exist to help people move work forward.
