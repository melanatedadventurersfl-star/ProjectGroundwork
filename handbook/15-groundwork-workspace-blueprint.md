# Groundwork Workspace Blueprint

**Version:** 1.0  
**Status:** Proposed  
**Linear:** PRO-5

## Purpose

The Groundwork workspace is a connected operating system for turning ideas into decisions, designs, execution, launches, and reusable learning.

Each tool has one primary responsibility. Information is created once, owned in one place, and referenced everywhere else.

## Operating principle

> One piece of information, one source of truth.

Duplication creates drift. Links create traceability.

## Tool ownership

| Tool | Primary responsibility | Owns | Does not own |
|---|---|---|---|
| GitHub | Approved knowledge and engineering | Founder Handbook, Company Genome, architecture, product blueprints, ADRs, specifications, code, version history | Brainstorms, meeting notes, task tracking, media archives |
| Notion | Exploration and institutional memory | Research, Founder Council notes, interviews, observations, open questions, decision drafts, lessons | Approved architecture, engineering tasks, final asset storage |
| Figma | Visual understanding and product design | Ecosystem maps, journeys, service maps, wireframes, interfaces, design systems, prototypes | Product decisions, execution tracking, final media storage |
| Linear | Execution | Projects, issues, priorities, dependencies, assignments, blockers, status | Product truth, brainstorming, long-form documentation, design source files |
| Google Drive | Files and operational assets | Contracts, media, vendor documents, forms, exports, training files, operational records | Architecture, tasks, visual design source of truth |
| Canva | Public-facing communication | Campaign graphics, flyers, social assets, event materials, certificates, presentations | Product UI, architecture diagrams, company knowledge |
| Google Calendar | Scheduled reality | Events, launches, meetings, volunteer shifts, travel, deadlines with a real date and time | Backlog ideas, strategic plans, unscheduled work |

## Information lifecycle

```text
Spark
  ↓
Explore
  ↓
Decide
  ↓
Blueprint
  ↓
Design
  ↓
Plan
  ↓
Build
  ↓
Launch
  ↓
Learn
  ↓
Improve
```

### 1. Spark

**Owner:** Notion

Capture the idea quickly. A Spark is not a promise and does not create engineering work.

Minimum information:

- The idea
- The person or community it may serve
- The possible barrier or opportunity
- The related brand, if known

### 2. Explore

**Owner:** Notion

Research the problem before defining a solution.

Exploration may include:

- Community interviews
- Existing workarounds
- Competitor research
- Evidence and assumptions
- Open questions
- Rough diagrams or references

### 3. Decide

**Draft owner:** Notion  
**Approved owner:** GitHub

Founder Council decisions begin as discussion and graduate to GitHub once approved.

Every significant decision should capture:

- Decision ID
- Context
- Decision
- Alternatives considered
- Rationale
- Consequences
- Related brands and Building Blocks

### 4. Blueprint

**Owner:** GitHub

A blueprint defines the approved product or system direction without turning it into a feature pile.

Blueprints begin with:

- Audience
- Purpose
- Barriers
- Desired experiences
- Journeys
- Outcomes
- Boundaries
- Required capabilities
- Explicit exclusions

### 5. Design

**Owner:** Figma

Design translates the approved blueprint into visual understanding.

Every major Figma artifact should link to:

- The related GitHub blueprint or decision
- The related Linear project or issue
- Supporting Notion research when useful

Design may expose missing decisions. When it does, work returns to Notion and GitHub before implementation continues.

### 6. Plan

**Owner:** Linear

Linear breaks approved work into executable outcomes.

Every substantial issue should include:

- The human outcome or barrier being addressed
- Acceptance criteria
- Related GitHub artifact
- Related Figma artifact when applicable
- Related Notion research when useful
- Dependencies and blockers

Linear issues should describe why the work matters before describing the implementation.

### 7. Build

**Owner:** GitHub

Code, schema, configuration, and technical implementation live in GitHub.

Pull requests should reference:

- The Linear issue
- The relevant blueprint or ADR
- The Figma design when applicable
- Any significant deviation discovered during implementation

### 8. Launch

**Owners:** Canva, Google Calendar, Google Drive

- Canva creates the external communication.
- Calendar records the actual launch, event, training, or rollout date.
- Drive stores final exports, media, forms, contracts, and operational assets.

The launch package should reference the Linear project and approved source material rather than reproducing it.

### 9. Learn

**Draft owner:** Notion  
**Approved owner:** GitHub when the lesson becomes reusable

Capture:

- What happened
- What worked
- What failed
- Evidence
- Unexpected behavior
- Community feedback
- Recommended changes

A lesson graduates to GitHub when it becomes a reusable pattern, principle, blueprint change, or architecture decision.

## Traceability standard

A meaningful initiative should be traceable across the system:

```text
Notion research
    ↓
GitHub decision or blueprint
    ↓
Figma design
    ↓
Linear project and issues
    ↓
GitHub implementation
    ↓
Canva + Calendar + Drive launch assets
    ↓
Notion learning
```

Not every small task requires every tool. The chain should be proportional to the decision's significance.

## Decision identifiers

Use the following prefixes:

- `FC-####` — Founder Council decision
- `ADR-####` — Architecture decision
- `PAT-####` — Approved reusable pattern
- `EXP-####` — Experiment or validation effort

Identifiers are created only when an item needs durable cross-tool traceability.

## Cross-tool linking rules

### Linear

Every project links to at least one approved GitHub artifact.

Every design-dependent issue links to Figma.

Research links are included only when they help execution or explain a decision.

### GitHub

Blueprints and ADRs link to the Linear work that implements them.

Pull requests reference the relevant Linear issue using its identifier.

### Notion

Decision drafts link to the approved GitHub record after graduation.

Completed research links forward to the decision, blueprint, or experiment it informed.

### Figma

File descriptions or cover pages reference the owning blueprint and Linear project.

### Google Drive

Operational folders may contain a shortcut, index file, or naming reference to the associated brand, event, or Linear project.

### Canva

Design names should include the brand, campaign or event, asset type, and year when relevant.

### Google Calendar

Event descriptions should link to the operational Drive folder and the appropriate Linear project for internal work.

## Naming standards

### Linear projects

Use outcome or system names:

- `Groundwork Architecture`
- `Melanated Adventurers Product Blueprint`
- `Remove First-Time Camper Anxiety`

Avoid vague containers such as `Miscellaneous`, `General Work`, or `App Stuff`.

### Linear issues

Use an action plus outcome:

- `Define the shared Building Blocks v1`
- `Identify and rank MA member barriers`
- `Create the Groundwork ecosystem map`

### Drive folders

Use numbered top-level folders for stable ordering and plain-language subfolders by brand, function, event, or year.

### Notion pages

Name pages for the question, decision, research topic, or learning they contain.

## Workspace boundaries

### Do not use Notion as a second Linear

Action items may be captured in meeting notes, but active work must be moved to Linear.

### Do not use Linear as a product specification repository

Issues may summarize context and acceptance criteria. They must link to the approved blueprint rather than replacing it.

### Do not use Drive as version control

Drive stores files and exports. Approved text and architecture remain in GitHub.

### Do not use Canva for product interface design

Product UI and system diagrams belong in Figma.

### Do not use Calendar as a planning backlog

Calendar contains commitments with real dates and times.

## Governance

The workspace blueprint is reviewed whenever:

- A new core tool is added
- Two tools begin owning the same information
- A repeated handoff failure appears
- Teams cannot locate the current source of truth
- A workflow creates more administration than value

Changes to ownership rules require a Founder Council decision and a GitHub update.

## Adoption sequence

1. Use the new Notion Groundwork workspace for exploration.
2. Use Linear for all new Groundwork execution.
3. Keep approved company knowledge in the ProjectGroundwork GitHub repository.
4. Use the new Project Groundwork Drive library for new assets before migrating older files.
5. Add Figma links as diagrams and product designs are created.
6. Add Canva and Calendar links when a project reaches launch planning.
7. Migrate legacy material only when it is touched, needed, or clearly valuable.

## Success criteria

This blueprint is working when:

- Team members can identify the correct home for information without asking.
- Approved decisions can be traced to their research and implementation.
- Linear work links back to human outcomes and approved blueprints.
- Duplicate documents and conflicting versions decline.
- Lessons from one brand can be reused by another without merging their identities.
- The operating system creates clarity faster than it creates administration.
