# Permission Matrix v1

## Project Groundwork

This document defines the first permission model for Groundwork.

The permission model should support role-aware access without overwhelming the MVP.

---

# Purpose

Permissions should answer:

- Who can see this?
- Who can change this?
- Who owns this?
- What responsibility does this person have in this context?

Groundwork permissions must account for both Organization-level and Workspace-level responsibility.

---

# Permission Principles

## 1. Roles are contextual

A person may be an Organization Owner in one Organization and a Volunteer in another.

A person may be a Workspace Lead in one Workspace and a regular Member in another.

## 2. Access should match responsibility

Users should only see and change what they need for their role.

## 3. MVP should stay simple

The first version should avoid overly complex permission rules.

## 4. Permissions should be expandable

The model should support more granular access later.

---

# Initial Roles

MVP roles:

- Organization Owner
- Workspace Lead
- Team Lead
- Worker
- Volunteer
- Member
- Guest

Future roles:

- Client
- Vendor
- Sponsor
- Chapter Lead
- Platform Admin

---

# Permission Actions

Common permission actions:

- View
- Create
- Edit
- Assign
- Delete
- Archive
- Configure
- Export
- Invite
- Approve

Not every object needs every action.

---

# Organization-Level Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View organization | Yes | Limited | Limited | Limited | Limited | Limited | Public only |
| Edit organization | Yes | No | No | No | No | No | No |
| Manage people | Yes | Workspace only | Team only | No | No | No | No |
| Manage roles | Yes | No | No | No | No | No | No |
| View all workspaces | Yes | Assigned only | Assigned only | Assigned only | Assigned only | Public/member only | Public only |
| Manage templates | Yes | Limited | No | No | No | No | No |
| View insights | Yes | Workspace only | Team only | No | No | No | No |

---

# Workspace-Level Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View workspace | Yes | Yes | Assigned | Assigned | Assigned | Limited | Public only |
| Edit workspace | Yes | Yes | No | No | No | No | No |
| Archive workspace | Yes | Yes | No | No | No | No | No |
| Manage workspace people | Yes | Yes | Team only | No | No | No | No |
| View Mission Control | Yes | Yes | Role view | Role view | Role view | Limited | Public only |
| Configure capabilities | Yes | Yes | No | No | No | No | No |

---

# Task Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View tasks | Yes | Yes | Team tasks | Assigned tasks | Assigned tasks | No | No |
| Create tasks | Yes | Yes | Team tasks | No | No | No | No |
| Assign tasks | Yes | Yes | Team tasks | No | No | No | No |
| Edit own task status | Yes | Yes | Yes | Yes | Yes | No | No |
| Delete tasks | Yes | Yes | No | No | No | No | No |

---

# Document Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View internal documents | Yes | Yes | Assigned | Limited | Limited | No | No |
| Add documents | Yes | Yes | Yes | Limited | Limited | No | No |
| Edit documents | Yes | Yes | Own/team | Own only | Own only | No | No |
| Delete documents | Yes | Yes | No | No | No | No | No |

---

# Notes and Lessons Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View notes | Yes | Yes | Assigned | Limited | Limited | No | No |
| Add notes | Yes | Yes | Yes | Yes | Yes | No | No |
| Edit own notes | Yes | Yes | Yes | Yes | Yes | No | No |
| Add lessons learned | Yes | Yes | Yes | Limited | Limited | No | No |
| Approve lessons for template | Yes | Yes | No | No | No | No | No |

---

# Template Permissions

| Action | Organization Owner | Workspace Lead | Team Lead | Worker | Volunteer | Member | Guest |
|---|---|---|---|---|---|---|---|
| View templates | Yes | Yes | Limited | No | No | No | No |
| Use template | Yes | Yes | No | No | No | No | No |
| Create template | Yes | Yes | No | No | No | No | No |
| Edit template | Yes | Limited | No | No | No | No | No |
| Delete template | Yes | No | No | No | No | No | No |

---

# MVP Permission Strategy

The MVP should use role-based permissions with simple scopes:

- Organization scope
- Workspace scope
- Team scope
- Own-assignment scope

Avoid complex object-level permissions until needed.

---

# Future Permission Features

Future versions may support:

- Custom roles
- Permission bundles
- Object-level access
- Temporary access
- Client access
- Vendor access
- Public page visibility
- Approval workflows
- Audit logs

---

# Open Questions

- Should Team Lead exist in MVP or later?
- Should Members have login access in MVP?
- Should Guests exist as records before registration features?
- How much permission customization should Organization Owners have?

---

# Standard

Permissions should make Groundwork safer and clearer.

They should not make the product feel like a maze with locked doors everywhere.
