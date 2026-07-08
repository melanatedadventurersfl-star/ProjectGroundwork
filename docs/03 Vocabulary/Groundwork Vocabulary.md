# Groundwork Vocabulary

## Project Groundwork

This document defines the shared language of Groundwork.

Groundwork should feel like one coherent platform, not a patchwork of generic software terms. The words we use shape how people understand the product, how we design features, and how future contributors think about the system.

The goal of this vocabulary is clarity.

Terms should be simple enough for everyday users, precise enough for product and engineering decisions, and flexible enough to support Groundwork as it grows.

---

# Vocabulary Principles

## 1. Use language that reflects purpose

Groundwork organizes meaningful work. The language should focus on outcomes, coordination, readiness, and improvement.

## 2. Avoid generic software jargon when a clearer product term exists

Users should not feel like they are operating a database.

## 3. Keep user-facing language calm and action-oriented

The product should explain what something is, why it matters, and what happens next.

## 4. Separate internal architecture from user-facing language

Some terms are useful internally but should not dominate the interface.

Example: Systems are important architecturally, but most users should primarily interact with Workspaces.

## 5. Prefer consistency over cleverness

A charming word is not useful if people cannot understand it quickly.

---

# Core Terms

## Groundwork

The platform itself.

Groundwork is the organizational operating system for planning, preparing, executing, and improving meaningful work.

Use when referring to the product as a whole.

---

## Organization

The entity using Groundwork.

An Organization may be a business, nonprofit, community group, chapter, department, or team.

Organizations own Systems, Workspaces, People, Settings, Branding, Permissions, and Billing.

Examples:

- Melanated Adventurers
- Build-A-Camp
- JaxBlack
- MANA
- A future regional chapter
- A client organization

---

## System

A permanent operational function inside an Organization.

Systems are an architectural layer that help Groundwork organize related work.

Examples:

- Experience System
- Inventory System
- Volunteer System
- Marketing System
- Finance System
- Fleet System
- Knowledge System
- Communications System

Systems are usually not the primary user-facing navigation model.

Preferred user-facing concept: Workspace.

---

## Workspace

The primary place where work happens.

A Workspace is a dedicated environment created around a purpose, outcome, initiative, asset, event, booking, campaign, or operational area.

Examples:

- Little Camp of Horrors
- Float Out
- Trailer Inventory
- Build-A-Camp Client Booking
- Marketing Campaign
- Volunteer Onboarding
- Product Development
- Venue Partnership

A Workspace may contain capabilities such as Tasks, Timeline, Budget, Documents, Inventory, Communications, Forms, Analytics, and AI Assistance.

Workspaces are the primary user-facing concept in Groundwork.

---

## Capability

A reusable tool that can be enabled inside a Workspace.

Capabilities are not hardcoded modules. They are building blocks.

Examples:

- Tasks
- Timeline
- Budget
- Documents
- Inventory
- Communications
- Forms
- Ticketing
- Knowledge Base
- Analytics
- AI Assistance

Capabilities should be designed once and reused across many Workspace types.

---

## Object

A structured piece of information managed by Groundwork.

Examples:

- Person
- Venue
- Task
- Inventory Item
- Vehicle
- Budget
- Expense
- Vendor
- Sponsor
- Document
- Communication
- Lesson Learned

Objects should have context, ownership, history, and relationships.

---

## Experience

A type of Workspace focused on creating a real-world event, trip, service, program, or gathering.

Examples:

- Campout
- Festival
- Workshop
- Float Out
- Networking Event
- Build-A-Camp Booking
- Retreat
- Volunteer Program

Experience is not the top-level product concept.

Experience is a Workspace type.

---

## Mission

A purpose-driven body of work inside a Workspace.

Mission may be used as a brand-flavored synonym for active work, especially in UI moments such as Mission Control or Mission Health.

Use carefully. Mission should create energy and clarity, not confusion.

---

## Mission Control

The main operational view for a Workspace.

Mission Control should show the current state of the work, priorities, blockers, progress, and next actions.

It should answer:

- What is happening?
- What needs attention?
- What happens next?
- Who is responsible?

Mission Control is a user-facing product concept.

---

## Mission Health

A summary of the readiness, risk, and momentum of a Workspace.

Mission Health should help users understand whether work is on track.

It may include signals such as:

- Timeline Status
- Budget Status
- Crew Coverage
- Inventory Readiness
- Document Completion
- Open Blockers
- Communication Status

Mission Health should be meaningful, not decorative.

---

## Timeline

A sequence of milestones, dates, deadlines, and phases that describe how work moves from start to finish.

A Timeline is not just a calendar.

It should show progress through the life of a Workspace.

---

## Task

A specific unit of work that needs to be completed.

A Task should have context, ownership, due date, status, and relationship to a Workspace or Object.

Use Task as the standard product term.

Avoid overusing Assignment unless referring to work specifically given to a person or crew.

---

## Assignment

A Task or responsibility assigned to a specific person, role, team, or crew member.

Assignments should appear in role-aware views such as Today, My Work, or Crew View.

---

## Checklist

A reusable or one-time list of steps used to complete a process.

Checklists may generate Tasks or remain lightweight completion lists.

Examples:

- Venue Evaluation Checklist
- Packing Checklist
- Setup Checklist
- Breakdown Checklist
- Client Booking Checklist

Templates should often include Checklists.

---

## Template

A reusable structure created from previous work or designed in advance.

Templates preserve institutional memory.

Examples:

- Experience Template
- Workspace Template
- Budget Template
- Timeline Template
- Checklist Template
- Packing Template
- Communication Template

Templates should help users repeat successful work without starting from zero.

---

## Person

Any human represented in Groundwork.

A Person may have multiple relationships to an Organization or Workspace.

Examples:

- Member
- Guest
- Volunteer
- Worker
- Team Lead
- Organizer
- Client
- Vendor Contact
- Sponsor Contact
- Partner
- Administrator

A Person is not the same as a User.

A Person may exist in Groundwork before they have a login.

---

## User

A Person with access to log into Groundwork.

Use User primarily in technical or permission contexts.

For user-facing product language, prefer the person's role:

- Member
- Volunteer
- Worker
- Organizer
- Client
- Admin

---

## Member

A person connected to an Organization or community.

Members may attend experiences, join groups, receive communications, participate in community activity, and maintain a profile.

Member is usually a community-facing role.

---

## Guest

A person attending or viewing an Experience without deeper membership or operational responsibilities.

Guests may purchase tickets, RSVP, receive instructions, complete forms, and attend experiences.

---

## Volunteer

A person who helps with work without being treated as paid staff.

Volunteers may receive Assignments, join Teams, view schedules, check in, and complete Tasks.

---

## Worker

A person performing paid operational work.

Workers may accept jobs, view assignments, submit hours, update task statuses, and receive payment-related records.

---

## Crew

A group of people working together on a Workspace.

Crew may include volunteers, workers, team leads, and organizers.

Use Crew when referring to the operational group responsible for execution.

---

## Team

A defined group within a Workspace or Organization.

Examples:

- Kitchen Team
- Setup Team
- Check-In Team
- Marketing Team
- Transportation Team
- Cleanup Team

Team is more structured than Crew.

Crew can be broad. Team is specific.

---

## Lead

A person responsible for a specific area of work.

Examples:

- Experience Lead
- Kitchen Lead
- Setup Lead
- Volunteer Lead
- Marketing Lead
- Transportation Lead

Leads should have role-specific permissions and responsibilities.

---

## Resource

A broad term for something used to complete work.

Resources may include documents, inventory, vehicles, people, templates, venues, vendors, and knowledge.

Use Resource when the category is intentionally broad.

Use a more specific term when possible.

---

## Inventory Item

A specific physical item tracked by Groundwork.

Examples:

- Canopy
- Propane Tank
- Generator
- Air Mattress
- Folding Table
- Speaker
- Extension Cord

Inventory Items should have status, location, condition, history, and usage records.

---

## Inventory Module

A reusable grouping of Inventory Items designed for a purpose.

Examples:

- Kitchen Module
- Power Module
- Check-In Module
- Bedding Module
- Lounge Module
- Cleaning Module
- Decor Module

Inventory Modules support repeatable packing, storage, setup, and expansion.

---

## Venue

A physical or virtual location where an Experience or Workspace activity takes place.

A Venue should preserve scouting notes, rules, contacts, costs, capacity, access details, photos, and history.

Venues should become smarter over time as they are reused.

---

## Vendor

An external provider of goods or services.

Examples:

- Food vendor
- Equipment rental company
- Photographer
- Transportation provider
- Venue supplier

Vendors may connect to Workspaces, Expenses, Documents, Contracts, Ratings, and Notes.

---

## Sponsor

A person or organization providing financial, material, promotional, or strategic support.

Sponsors may connect to Workspaces, Campaigns, Agreements, Deliverables, and Communications.

---

## Document

A file or structured record attached to a Workspace, Object, or Organization.

Examples:

- Contract
- Permit
- Insurance Certificate
- Flyer
- Map
- Menu
- Budget Export
- Waiver
- Vendor Quote

Documents should have context, type, owner, status, and expiration date when relevant.

---

## Communication

A message, announcement, notification, email, SMS, chat, or update connected to a Workspace or Object.

Communications should preserve context and audience.

Examples:

- Guest announcement
- Crew update
- Vendor email
- Internal note
- Ticket holder reminder

---

## Lesson Learned

A piece of knowledge captured from completed work.

Lessons Learned should help future Workspaces improve.

Examples:

- Open check-in earlier
- Order more supplies for summer events
- Use larger parking signs
- Confirm access instructions earlier

Lessons Learned are part of Groundwork's institutional memory.

---

## Insight

A meaningful observation generated from data, history, or user activity.

Insights should help users understand progress, risk, performance, or opportunity.

Examples:

- Ticket sales are behind the previous event
- Inventory readiness is incomplete
- A venue has repeated parking concerns
- Food costs exceeded budget

Insights should lead to action.

---

## Readiness

The degree to which a Workspace is prepared for execution.

Readiness may include tasks completed, inventory assigned, people confirmed, documents approved, budget status, and blockers resolved.

Readiness should be understandable at a glance.

---

## Risk

A potential issue that could affect success.

Risks should include likelihood, impact, owner, mitigation, and status.

Examples:

- Weather risk
- Low registration
- Volunteer shortage
- Missing permit
- Equipment issue
- Budget overrun

---

## Blocker

Something preventing progress.

A Blocker should be visible, assigned, and resolved quickly.

Examples:

- Venue contract unsigned
- Budget not approved
- Required inventory unavailable
- Missing insurance document
- No assigned team lead

---

## Archive

The state of a Workspace or Object after active work is complete and preserved for history.

Archived work should remain searchable and reusable.

Archive does not mean forgotten.

---

# Preferred Term Map

| Avoid | Prefer | Reason |
|---|---|---|
| Project | Workspace | Broader and more purpose-driven |
| Module | Capability | More flexible and reusable |
| Event | Experience | Broader than traditional events |
| Dashboard | Mission Control | More action-oriented |
| Status | Mission Health | Better communicates readiness and risk |
| Files | Documents or Resources | More specific and contextual |
| Employees | Workers or Crew | Better fits mixed volunteer and paid operations |
| Users | People or Role Name | More human and role-aware |
| Reports | Insights | Focuses on meaning, not raw output |
| To-Do | Task or Assignment | More operationally clear |

---

# Internal vs User-Facing Terms

## Internal Architecture Terms

These terms may appear in documentation, engineering, or advanced admin settings:

- System
- Object
- Capability
- Permission
- Data Model
- Entity
- Relationship
- Schema

## User-Facing Terms

These terms should appear more often in the product interface:

- Workspace
- Mission Control
- Task
- Assignment
- Timeline
- Crew
- Team
- Document
- Resource
- Insight
- Mission Health
- Readiness
- Lesson Learned

---

# Naming Rules

## Use singular names for object definitions

Correct:

- Person
- Venue
- Task
- Workspace

## Use plural names for navigation collections

Correct:

- Workspaces
- People
- Documents
- Tasks

## Use action-oriented labels for buttons

Prefer:

- Create Workspace
- Assign Task
- Add Document
- Review Budget
- Confirm Crew
- Archive Workspace

Avoid vague labels:

- Submit
- Save Stuff
- Manage
- Process

## Use plain language for statuses

Preferred statuses should be obvious to non-technical users.

Examples:

- Draft
- Planning
- Preparing
- Ready
- Active
- Recovering
- Reviewing
- Archived

---

# Product Voice

Groundwork should sound:

- Clear
- Calm
- Capable
- Practical
- Encouraging
- Direct

Groundwork should not sound:

- Robotic
- Overly clever
- Corporate for no reason
- Alarmist
- Condescending
- Vague

The product voice should help users feel prepared, not overwhelmed.

---

# Closing Standard

Language is product architecture.

Every term should make Groundwork easier to understand, easier to build, and easier to use.

When in doubt, choose the word that helps someone know what something is, why it matters, and what they should do next.
