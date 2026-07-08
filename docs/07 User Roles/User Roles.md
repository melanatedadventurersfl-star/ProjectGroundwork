# User Roles

## Project Groundwork

This document defines the initial roles used by Groundwork.

Roles describe what a person is responsible for and what they should be able to see or do.

Groundwork should be role-aware. Each person should see the information and actions that match their responsibility.

---

# Role Principles

## 1. People can have multiple roles

A person may be a Member in one context, a Volunteer in another, and a Lead in another.

## 2. Roles are contextual

A role may apply to an Organization, System, Workspace, Team, or specific task.

## 3. Permissions should be additive

People should receive only the access needed to complete their responsibility.

## 4. Temporary access should be possible

Some roles may only apply for a specific Workspace or time period.

## 5. The interface should adapt to the role

A volunteer should not see the same view as an organization owner.

---

# Initial Role Hierarchy

```text
Platform Owner
    ↓
Organization Owner
    ↓
Chapter Lead
    ↓
Workspace Lead
    ↓
Team Lead
    ↓
Worker / Volunteer
    ↓
Member
    ↓
Guest
```

This hierarchy is a starting point, not a rigid rule.

---

# Platform Owner

Responsible for the Groundwork platform itself.

May manage:

- Platform settings
- Product configuration
- Global templates
- System-level controls
- Technical administration

This role is internal to the Groundwork product team.

---

# Organization Owner

Responsible for an Organization inside Groundwork.

May manage:

- Organization settings
- Branding
- People
- Roles
- Workspaces
- Systems
- Templates
- Billing
- Organization-wide reporting

---

# Chapter Lead

Responsible for a regional chapter, local group, department, or sub-organization.

May manage:

- Local Workspaces
- Local People
- Local resources
- Chapter-level reporting
- Chapter templates
- Local operations

---

# Workspace Lead

Responsible for a specific Workspace.

May manage:

- Workspace overview
- Timeline
- Tasks
- People
- Documents
- Resources
- Budget
- Communications
- Lessons Learned
- Workspace completion

---

# Team Lead

Responsible for a specific Team inside a Workspace.

May manage:

- Team members
- Team tasks
- Team schedule
- Assigned resources
- Team updates
- Team completion status

---

# Worker

A person performing paid operational work.

May be able to:

- View assignments
- Accept work
- Update task status
- View schedule
- Submit work notes
- View work history

---

# Volunteer

A person helping without being treated as paid staff.

May be able to:

- View assignments
- Join a team
- Update task status
- View schedule
- Receive updates
- Complete checklists

---

# Member

A community participant connected to an Organization.

May be able to:

- View public or member Workspaces
- Register for Experiences
- View itinerary information
- Receive updates
- Upload approved content
- Maintain a profile

---

# Guest

A person with limited or no account access.

May be able to:

- View public pages
- Register or request information
- Receive instructions
- Complete forms

Guests should not see internal planning information.

---

# Client

A person or organization receiving a service.

May be able to:

- View booking details
- Submit information
- Review documents
- Make selections
- View status
- Communicate with the service team

---

# Vendor

An external provider connected to a Workspace or Organization.

May be able to:

- View relevant details
- Upload documents
- Confirm service details
- Communicate with Workspace owners

Vendor access should be limited and contextual.

---

# Role-Aware Home

Groundwork should adapt the home view based on role.

Every user should be able to answer:

1. What am I responsible for?
2. What needs my attention now?
3. What happens next?
4. Who do I need to work with?

---

# Permission Model

Roles should eventually be built from permissions.

A permission may control whether someone can:

- View
- Create
- Edit
- Assign
- Approve
- Archive
- Export
- Configure

Roles are named bundles of permissions.

Permissions are the underlying controls.

---

# Design Standard

Roles should make Groundwork simpler.

A person should not need to understand the entire platform to complete their part of the work.
