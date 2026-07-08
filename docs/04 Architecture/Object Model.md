# Object Model

## Project Groundwork

This document defines the core objects Groundwork understands.

The Object Model is not a database schema yet.

It is the conceptual map of the platform: what exists, why it exists, and how major objects relate to each other.

---

# Purpose

The Object Model helps translate product architecture into software structure.

It should guide future work on:

- Database design
- API design
- Flutter models
- Permissions
- Search
- Templates
- Analytics
- AI assistance

The goal is to define the world of Groundwork before writing implementation details.

---

# Foundational Relationship

Groundwork is organized around this core structure:

```text
Organization
    ↓
System
    ↓
Workspace
    ↓
Capability
    ↓
Object
```

Objects are the structured records that make work understandable, reusable, and connected.

---

# Core Objects

## Organization

The top-level owner of work inside Groundwork.

Purpose:

- Owns people, workspaces, settings, branding, and permissions
- Represents a business, nonprofit, chapter, group, or team

Key relationships:

- Has many People
- Has many Systems
- Has many Workspaces
- Has many Templates
- Has many Documents

---

## System

A permanent operational area inside an Organization.

Purpose:

- Groups related operational activity
- Provides internal structure without dominating the user interface

Examples:

- Experience System
- Inventory System
- Volunteer System
- Marketing System
- Finance System
- Knowledge System

Key relationships:

- Belongs to one Organization
- Has many Workspaces
- May own shared Objects

---

## Workspace

The primary user-facing home for meaningful work.

Purpose:

- Organizes people, resources, tasks, communication, and knowledge around a purpose

Key relationships:

- Belongs to one Organization
- May belong to one or more Systems
- Has many Capabilities
- Has many People
- Has many Tasks
- Has many Documents
- Has many Communications
- Has many Lessons Learned
- Can become a Template

---

## Workspace Type

A reusable pattern for creating Workspaces.

Purpose:

- Provides defaults for similar kinds of work
- Suggests enabled Capabilities, statuses, and templates

Examples:

- Experience Workspace
- Inventory Workspace
- Marketing Workspace
- Client Booking Workspace
- Training Workspace

Key relationships:

- Defines default Capabilities
- May define default statuses
- May define default Templates

---

## Capability

A reusable tool enabled inside a Workspace.

Purpose:

- Provides functional building blocks
- Prevents the platform from becoming rigid one-off modules

Examples:

- Tasks
- Timeline
- Documents
- Budget
- Inventory
- Communications
- Knowledge Base
- Templates

Key relationships:

- Can be enabled on many Workspace Types
- Uses one or more Objects
- May define permissions and views

---

## Person

Any human represented in Groundwork.

Purpose:

- Represents members, guests, volunteers, workers, leads, clients, vendors, partners, and administrators

Key relationships:

- May belong to one or more Organizations
- May participate in many Workspaces
- May have many Roles
- May own Tasks
- May belong to Teams

Note:

A Person is not always a User. A User is a Person with login access.

---

## Role

A named responsibility or permission grouping.

Purpose:

- Defines what a Person can see or do in a context

Examples:

- Organization Owner
- Workspace Lead
- Team Lead
- Volunteer
- Worker
- Member
- Guest

Key relationships:

- Assigned to a Person
- Scoped to an Organization, Workspace, Team, or Object
- Maps to Permissions

---

## Team

A defined group of People working together.

Purpose:

- Organizes responsibility inside a Workspace or Organization

Examples:

- Setup Team
- Kitchen Team
- Check-In Team
- Marketing Team
- Transportation Team

Key relationships:

- Has many People
- May belong to one Workspace
- May own Tasks
- May have a Team Lead

---

## Task

A unit of work that needs to be completed.

Purpose:

- Tracks responsibility, status, and progress

Key relationships:

- Belongs to a Workspace
- May be assigned to a Person or Team
- May relate to a Milestone
- May relate to a Document, Resource, or Capability

Common statuses:

- Not Started
- In Progress
- Blocked
- Complete
- Cancelled

---

## Timeline

A structured sequence of phases, dates, and milestones.

Purpose:

- Shows how work moves over time

Key relationships:

- Belongs to a Workspace
- Has many Milestones
- May connect to Tasks

---

## Milestone

A meaningful point in a Timeline.

Purpose:

- Marks progress, deadlines, or decision points

Examples:

- Planning Started
- Budget Approved
- Registration Opens
- Crew Confirmed
- Workspace Archived

Key relationships:

- Belongs to a Timeline
- May have related Tasks
- May affect Workspace Health

---

## Document

A file, link, or structured record stored in context.

Purpose:

- Preserves important supporting material

Examples:

- Contract
- Map
- Flyer
- Checklist
- Permit
- Quote
- Guide

Key relationships:

- May belong to an Organization, Workspace, or Object
- May have a type, owner, status, and expiration date

---

## Resource

A broad object representing something useful for work.

Purpose:

- Provides a general category for reusable assets

Examples:

- Inventory item
- Venue
- Vehicle
- Vendor
- Template
- Document

Note:

Use more specific objects when possible.

---

## Inventory Item

A physical item tracked by Groundwork.

Purpose:

- Tracks equipment, supplies, and physical assets

Key relationships:

- Belongs to an Organization
- May belong to an Inventory Module
- May be assigned or reserved by a Workspace
- Has usage history

---

## Inventory Module

A reusable grouping of Inventory Items.

Purpose:

- Supports repeatable packing, setup, storage, and expansion

Examples:

- Kitchen Module
- Power Module
- Check-In Module
- Bedding Module
- Decor Module

Key relationships:

- Has many Inventory Items
- May be assigned to a Workspace
- May become a Template

---

## Venue

A location where work or an Experience happens.

Purpose:

- Stores reusable location knowledge

Key relationships:

- May belong to an Organization
- May be used by many Workspaces
- May have Documents, Contacts, Notes, and Lessons Learned

---

## Vendor

An external provider connected to work.

Purpose:

- Tracks outside services and relationships

Key relationships:

- May belong to an Organization
- May support many Workspaces
- May connect to Documents, Expenses, and Communications

---

## Budget

A financial plan for a Workspace.

Purpose:

- Tracks expected and actual financial activity

Key relationships:

- Belongs to a Workspace
- Has Expenses
- Has Revenue Records
- May contribute to Insights

---

## Expense

A cost connected to work.

Purpose:

- Tracks money spent or expected to be spent

Key relationships:

- May belong to a Budget
- May connect to a Vendor, Document, Workspace, or Person

---

## Revenue

Money received or expected.

Purpose:

- Tracks income related to a Workspace or Organization

Key relationships:

- May belong to a Budget
- May connect to Registration, Booking, Sponsor, or Client records

---

## Communication

A message, update, announcement, or note sent or preserved in context.

Purpose:

- Keeps important communication connected to work

Key relationships:

- May belong to a Workspace
- May target People, Teams, Guests, or Roles
- May relate to Tasks, Documents, or Milestones

---

## Note

A lightweight record of context, thinking, or observation.

Purpose:

- Captures useful information that may not belong in a formal object yet

Key relationships:

- May belong to a Workspace, Person, Object, or Timeline
- May later become a Task, Lesson Learned, or Document

---

## Lesson Learned

Reusable knowledge captured from completed work.

Purpose:

- Helps future Workspaces improve

Key relationships:

- Belongs to a Workspace
- May connect to a Venue, Vendor, Inventory Item, Task, or Template
- May be included in future Templates

---

## Template

A reusable structure based on proven work.

Purpose:

- Reduces repeated setup
- Preserves institutional memory

Key relationships:

- May be created from a Workspace
- May include default Capabilities, Tasks, Timeline, Roles, Documents, and Lessons Learned

---

## Insight

A meaningful observation generated from data, history, or activity.

Purpose:

- Helps users understand patterns, progress, and attention areas

Key relationships:

- May relate to an Organization, Workspace, Capability, or Object
- Should lead to action or understanding

---

## Activity

A record of something that happened in Groundwork.

Purpose:

- Preserves history and supports transparency

Examples:

- Task created
- Document added
- Person assigned
- Workspace archived
- Template created

Key relationships:

- Belongs to an Organization
- May relate to a Workspace, Person, or Object

---

## Notification

A prompt or update delivered to a user.

Purpose:

- Brings attention to something relevant

Key relationships:

- Belongs to a Person or Role
- May relate to a Workspace, Task, Milestone, Communication, or Insight

---

## Attachment

A file attached to another Object.

Purpose:

- Stores supporting material without requiring every file to become a full Document

Key relationships:

- Belongs to another Object
- May later be promoted into a Document

---

# High-Level Relationship Map

```text
Organization
    ├── People
    ├── Systems
    ├── Templates
    └── Workspaces
            ├── Capabilities
            ├── People
            ├── Teams
            ├── Tasks
            ├── Timeline
            │       └── Milestones
            ├── Documents
            ├── Communications
            ├── Resources
            ├── Budget
            ├── Notes
            ├── Lessons Learned
            └── Insights
```

---

# Object Model Principles

## 1. Everything belongs somewhere

No object should exist without context.

## 2. Objects should preserve history

Important changes should be traceable.

## 3. Objects should be reusable when appropriate

A Venue, Vendor, Person, Inventory Item, or Template should not need to be recreated for every Workspace.

## 4. Objects should support role-aware access

People should only see and modify what matches their responsibility.

## 5. Objects should support future intelligence

The model should preserve enough structure for future insights, automation, and AI assistance.

---

# Future Work

This Object Model should later be translated into:

- Domain model diagrams
- Database schema
- API resources
- Flutter data models
- Permission matrix
- Search model
- Template model

The Object Model is the bridge between product architecture and implementation.
