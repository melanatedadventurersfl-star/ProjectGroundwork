# Figma Handoff and Deferred Build Plan

## Decision

Figma implementation work is paused until the connected Figma account has sufficient MCP tool-call capacity. Product design, interaction rules, component definitions, and implementation guidance will continue to be documented in GitHub so the project does not stall.

The pause applies to all new Figma creation, editing, component-library work, token setup, prototyping, and visual QA.

## Existing Figma File

File: `MA2`

URL: https://www.figma.com/design/4da9MN6CyeKLCSsyPDWUlG/MA2?node-id=0-1

## Work Already Completed in Figma

### Trailhead wireframes

The file contains three editable low-fidelity mobile frames:

- Trailhead · Explorer
- Trailhead · Planner
- Trailhead · Live Adventure

These frames establish the first-pass hierarchy, tile arrangement, lifecycle behavior, and bottom-navigation placement.

### Variable foundations

Two local variable collections were created.

#### MA Primitives

Includes 36 variables covering:

- Brand and neutral colors
- Status colors
- Spacing values
- Corner radii
- Minimum touch target
- Icon sizes
- Bottom-navigation height

#### MA Semantic

Includes 33 aliased variables covering:

- Page, tile, brand, accent, and subtle surfaces
- Primary, secondary, inverse, and brand text
- Subtle borders
- Primary action colors
- Success, warning, danger, and information states
- Semantic spacing
- Semantic radii
- Component sizing

Web-oriented CSS syntax names were added to support future implementation handoff.

## Work Not Yet Completed in Figma

### Phase 1 foundations

- Typography styles
- Numeric display style
- Elevation and shadow styles
- Foundation documentation frames
- Contrast and accessibility validation
- Final token inventory validation

### File organization

The current file still needs the planned page structure:

- 00 · Cover
- 01 · Getting Started
- 02 · Foundations
- 03 · Components
- 04 · Trailhead
- 05 · Explore
- 06 · Adventure Detail
- 07 · Community
- 08 · Passport
- 09 · Profile
- 10 · Prototype

The three Trailhead frames currently remain together on the original page.

### Component library

The following v1 components remain to be built as reusable Figma components:

1. Tile Base
2. Primary Adventure Tile
3. Upcoming Adventure Tile
4. Discovery Tile
5. Reflection Tile
6. Utility Tile
7. Status Chip
8. Readiness Indicator
9. Bottom Navigation
10. Navigation Item
11. App Bar
12. Alert Card
13. Standard Card
14. Primary Button
15. Secondary Button

Each component must include applicable default, pressed, focused, selected, disabled, loading, empty, error, offline, and completed states.

### Screen design and prototyping

The following work remains:

- Apply the visual system to the Trailhead wireframes
- Build overdue-task and pre-check-in Trailhead variants
- Create Adventure Detail screens across lifecycle phases
- Create Explore, Community, Passport, Campfire, Profile, and Menu screens
- Add adaptive transitions between Explorer, Planner, Live, Reflection, and Legacy states
- Connect key prototype flows
- Complete responsive and accessibility review

## Documentation-First Workflow During the Pause

Until Figma work resumes, all design decisions should be captured in GitHub before implementation.

Each screen specification should define:

- Purpose
- Member state and lifecycle context
- Information hierarchy
- Exact section and tile order
- Component usage
- Content requirements
- Primary and secondary actions
- Empty, loading, error, offline, and permission states
- Accessibility requirements
- Analytics events
- MVP and later-phase boundaries
- Acceptance criteria

Each component specification should define:

- Purpose
- Anatomy
- Sizes
- Variants
- States
- Token mappings
- Behavior
- Content rules
- Accessibility behavior
- Usage examples
- Prohibited usage

## Figma Resume Sequence

When Figma access is restored, resume in this order:

1. Verify the existing `MA Primitives` and `MA Semantic` collections.
2. Complete typography and elevation styles.
3. Create the page structure and foundations documentation.
4. Build components one at a time in dependency order.
5. Replace loose wireframe layers with component instances.
6. Build the remaining Trailhead states.
7. Build Adventure Detail.
8. Continue through Explore, Community, Passport, Profile, and supporting flows.
9. Connect prototype interactions.
10. Run accessibility, naming, binding, and visual QA audits.

Do not recreate the existing variables unless validation shows that a variable is missing, duplicated, or incorrect.

## Source of Truth

During the Figma pause, the GitHub documents under `docs/app-blueprint/` are the primary source of truth.

Figma is the visual implementation layer. It should reflect the approved product and design specifications rather than become a separate source of product decisions.

## Completion Rule

A feature may proceed to development before its final Figma screen exists only when its GitHub specification includes sufficient layout, state, behavior, component, and acceptance-criteria detail for a developer to implement it without inventing product behavior.
