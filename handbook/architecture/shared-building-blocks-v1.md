# Shared Building Blocks v1

Status: Proposed for approval
Linear: PRO-7

## Purpose

Building Blocks are the reusable nouns of the Groundwork ecosystem. They describe the durable things the platform may represent across brands without importing brand-specific identity, culture, or terminology.

A concept earns Building Block status only when it:

1. Represents a durable entity or stateful object.
2. Can be used by more than one brand.
3. Has meaningful relationships with other shared concepts.
4. Requires independent rules, data, or lifecycle behavior.
5. Cannot be expressed more cleanly as a property, dynamic, outcome, or brand-specific specialization.

## Approved Building Blocks

### 1. Person

**Definition:** A human being who participates in, supports, leads, organizes, or is affected by an ecosystem experience.

**Purpose:** Keeps the ecosystem centered on people rather than accounts, transactions, or content.

**Primary relationships:**
- holds one or more Identities
- joins Communities and Organizations
- participates in Gatherings and Experiences
- forms Relationships
- moves through Journeys
- holds Roles
- creates or appears in Stories
- may receive Achievements and Invitations

**What it is not:** A login credential, customer record, attendee count, follower, or generic user object.

**Placement:** Shared Groundwork.

### 2. Identity

**Definition:** A context-specific representation of a Person, including how that person is known, described, and presented within a brand, community, or organization.

**Purpose:** Allows one Person to participate across distinct brands without forcing one public persona or erasing contextual differences.

**Primary relationships:**
- belongs to one Person
- may be scoped to a Brand, Community, or Organization
- may carry profile details, preferences, visibility rules, and credentials

**What it is not:** The Person themselves, a role, a membership, or a brand identity system.

**Placement:** Shared Groundwork.

### 3. Community

**Definition:** A continuing group of people connected by a shared purpose, identity, interest, place, or experience.

**Purpose:** Represents belonging and continuity beyond a single event or transaction.

**Primary relationships:**
- includes People through memberships and Roles
- may be supported by an Organization
- creates Gatherings, Experiences, Stories, traditions, and Relationships
- may exist within a Brand or chapter structure

**What it is not:** An audience segment, mailing list, temporary attendee list, social feed, or organization.

**Placement:** Shared Groundwork.

### 4. Organization

**Definition:** A structured entity that coordinates people, resources, responsibilities, and authority toward a purpose.

**Purpose:** Represents formal ownership, governance, operations, and accountability.

**Primary relationships:**
- may operate one or more Brands or Communities
- assigns Roles to People
- produces Gatherings and Experiences
- owns or manages resources, Places, policies, and records

**What it is not:** A Community, informal group, brand name, or event host label.

**Placement:** Shared Groundwork.

### 5. Gathering

**Definition:** A bounded occurrence in which people come together at a particular time, whether physically, digitally, or in a hybrid setting.

**Purpose:** Provides the scheduling and attendance container for shared participation.

**Primary relationships:**
- occurs at a time and may occur at a Place
- is hosted by a Community, Organization, or Person
- includes participants and Roles
- may contain one or more Experiences
- may generate Stories and Achievements

**What it is not:** The meaning or emotional design of an Experience, a recurring Community, or merely a calendar entry.

**Placement:** Shared Groundwork.

### 6. Experience

**Definition:** An intentionally designed sequence of interactions, moments, and meaning encountered by a Person or group.

**Purpose:** Represents what people actually live through, not merely what was scheduled.

**Primary relationships:**
- may occur within a Gathering or across multiple Gatherings
- includes People, Places, Roles, Stories, and touchpoints
- may advance a Journey
- may create Relationships, Achievements, and Outcomes

**What it is not:** A feature, event listing, itinerary item, transaction, or generic activity.

**Placement:** Shared Groundwork.

### 7. Place

**Definition:** A physical, digital, or conceptual location where participation, belonging, or activity occurs.

**Purpose:** Gives experiences and communities spatial context without assuming all places are physical venues.

**Primary relationships:**
- hosts Gatherings and Experiences
- may be owned, managed, or associated with an Organization or Community
- may carry access, capacity, safety, and availability rules

**What it is not:** Only a postal address, map pin, venue contract, or geographic region.

**Placement:** Shared Groundwork.

### 8. Relationship

**Definition:** A meaningful connection between two or more People, Communities, or Organizations that persists beyond a single interaction.

**Purpose:** Makes connection, trust, mentorship, collaboration, and belonging representable rather than incidental.

**Primary relationships:**
- connects People, Communities, or Organizations
- may begin or strengthen through Gatherings and Experiences
- may have type, direction, strength, consent, privacy, and history

**What it is not:** A follow, contact import, message thread, or one-time interaction.

**Placement:** Shared Groundwork.

### 9. Journey

**Definition:** A person-centered progression through meaningful stages over time.

**Purpose:** Represents movement such as discovery, preparation, participation, contribution, leadership, or transformation.

**Primary relationships:**
- belongs to a Person or defined participant group
- contains stages, transitions, barriers, opportunities, and Experiences
- may produce Achievements and Outcomes

**What it is not:** A static funnel, project plan, itinerary, or technical workflow.

**Placement:** Shared Groundwork.

### 10. Story

**Definition:** A preserved account of people, experiences, places, milestones, or meaning.

**Purpose:** Carries memory, identity, evidence, and culture across time.

**Primary relationships:**
- may feature People, Communities, Organizations, Gatherings, Experiences, Places, and Achievements
- may be private, shared, curated, or public
- may contribute to a Community's living history

**What it is not:** Any media file, social post, caption, activity log, or raw archive record.

**Placement:** Shared Groundwork.

### 11. Role

**Definition:** A named set of responsibilities, permissions, expectations, or forms of participation held by a Person within a context.

**Purpose:** Separates what a Person is responsible for from who that Person is.

**Primary relationships:**
- held by a Person
- scoped to a Community, Organization, Gathering, or Experience
- may change over time
- may govern permissions, responsibilities, and progression

**What it is not:** Identity, job title alone, achievement, system permission alone, or permanent personal classification.

**Placement:** Shared Groundwork.

### 12. Achievement

**Definition:** A recognized accomplishment, contribution, milestone, or demonstrated progression.

**Purpose:** Makes growth and contribution visible without reducing recognition to popularity.

**Primary relationships:**
- awarded to a Person, group, Community, or Organization
- may arise from a Journey, Role, Experience, contribution, or milestone
- may be evidenced by Stories or records

**What it is not:** A leaderboard position, engagement count, decorative badge without meaning, or permanent status of worth.

**Placement:** Shared Groundwork.

### 13. Invitation

**Definition:** A contextual offer or request for a Person, Community, or Organization to participate, connect, contribute, or take a next step.

**Purpose:** Represents intentional pathways into participation rather than assuming discovery automatically becomes belonging.

**Primary relationships:**
- sent by a Person, Community, or Organization
- offered to a Person, Community, or Organization
- may reference a Gathering, Experience, Relationship, Role, or Journey step
- has state such as offered, viewed, accepted, declined, expired, or withdrawn

**What it is not:** A generic notification, advertisement, recommendation, or access permission.

**Placement:** Shared Groundwork.

## Concepts Not Approved as Independent Building Blocks

### Barrier

A Barrier is a condition that obstructs movement through a Journey or access to an Experience. It belongs in journey and product analysis, but does not yet require an independent universal entity.

**Current classification:** Journey condition and product-analysis concept.

### Opportunity

An Opportunity is a possible next step available to a Person, Community, or Organization. In v1 it is represented through Invitations, Roles, Experiences, and Journey transitions.

**Current classification:** Contextual possibility, not an independent Building Block.

### Ritual

A Ritual is a repeatable meaningful action within an Experience or Gathering.

**Current classification:** Experience design pattern.

### Tradition

A Tradition is a cultural practice carried forward across time by a Community.

**Current classification:** Community cultural asset, commonly preserved through Stories and repeated Experiences.

### Legend

A Legend is a form of enduring recognition given to a Person or Story whose contribution becomes part of Community identity.

**Current classification:** Recognition state built from Person, Achievement, Story, and Community.

### Transformation

Transformation describes meaningful change resulting from a Journey or Experience.

**Current classification:** Outcome, not a Building Block.

### Belonging, Friendship, Confidence, Leadership

These describe desired human and community results.

**Current classification:** Outcomes. Leadership may also be expressed through Roles and Journeys, but is not itself a shared entity.

## Relationship Summary

The minimum coherent shared model is:

- A **Person** participates through one or more contextual **Identities**.
- People join or form **Communities** and **Organizations**.
- Communities and Organizations create **Gatherings** and **Experiences**.
- Experiences occur in **Places**, involve **Roles**, and shape **Journeys**.
- People form **Relationships**, create **Stories**, earn **Achievements**, and receive **Invitations**.
- These interactions produce Outcomes such as belonging, friendship, confidence, leadership, and transformation.

## Governance Rules

1. Shared Building Blocks must remain neutral across brands.
2. Brand language may specialize a Building Block but may not redefine its shared meaning.
3. Dynamics describe actions between Building Blocks and must not be modeled as nouns merely for convenience.
4. Outcomes describe results and must not be treated as stored entities unless a later evidence model justifies it.
5. New Building Blocks require a documented use case across at least two brands or a compelling platform-level requirement.
6. A concept should begin as a property, pattern, or specialization and graduate only when independent lifecycle rules become necessary.

## v1 Decision

Approved shared Building Blocks:

1. Person
2. Identity
3. Community
4. Organization
5. Gathering
6. Experience
7. Place
8. Relationship
9. Journey
10. Story
11. Role
12. Achievement
13. Invitation

This vocabulary is intentionally small. Groundwork should gain new nouns slowly and only when the existing model can no longer express a real, validated need cleanly.
