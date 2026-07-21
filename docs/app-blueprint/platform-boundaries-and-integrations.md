# Platform Boundaries and Integrations

## Purpose

This document protects the Melanated Adventurers app from absorbing adjacent products that serve different audiences, workflows, and business models.

The Melanated Adventurers app may integrate with related platforms, but it must not become their operating system.

## Product Boundary

### Melanated Adventurers

Melanated Adventurers is a Black-centered outdoor and adventure community platform.

Its core responsibilities are:

- adventure discovery
- registration and attendance
- participant readiness
- event-day guidance
- community participation
- memories, accomplishments, and reflection
- host operations for Melanated Adventurers experiences

### Build-A-Camp

Build-A-Camp is a separate service platform for clients who need camping setups, rentals, packages, staffing, delivery, setup, breakdown, and fulfillment.

It serves a broader customer base and has its own operational model.

Build-A-Camp must not be implemented as a module inside the Melanated Adventurers member app.

Its separate product should eventually own:

- client inquiries and quotes
- package selection
- rental inventory
- labor scheduling
- delivery routes
- setup and breakdown workflows
- fulfillment status
- deposits and balances
- damage, loss, and return handling
- worker availability and assignments

### Beerded Empire

Beerded Empire is a separate community product with a different audience and identity.

It must not share the Melanated Adventurers community feed, member graph, Passport, or adventure lifecycle by default.

### Future Adjacent Products

Any future product must be evaluated as either:

1. a feature inside Melanated Adventurers
2. a separate product with an integration
3. a completely independent business

The default should be separation when the audience, mission, workflow, or revenue model materially differs.

## Allowed Integrations

Melanated Adventurers may integrate with Build-A-Camp when Build-A-Camp fulfills services for a Melanated Adventurers event.

Examples include:

- attaching a Build-A-Camp fulfillment reference to an adventure
- showing host-only fulfillment status
- importing setup completion status
- referencing rented equipment assigned to an event
- passing approved participant counts or package quantities
- linking to the separate Build-A-Camp admin experience

These integrations must remain narrow and contract-based.

## Prohibited Coupling

The Melanated Adventurers app must not directly own:

- Build-A-Camp client accounts
- Build-A-Camp worker profiles
- external client quotes
- general rental inventory
- delivery operations
- fulfillment payroll
- non-Melanated-Adventurers service orders

Build-A-Camp must not directly own:

- Melanated Adventurers community posts
- Passport accomplishments
- Journey history
- member social relationships
- adventure recommendations
- MA-specific readiness logic beyond fulfillment inputs

## Shared Services

The products may later share infrastructure without sharing product identity.

Potential shared services include:

- authentication
- payment processing
- notifications
- media storage
- analytics infrastructure
- organization administration
- audit logging

Shared infrastructure must use product-specific permissions, data boundaries, and branding.

## Account Strategy

A future shared account system may allow one person to access multiple products with one login.

That does not mean the products share profiles, feeds, permissions, or operational records.

Each product should maintain its own product membership and role assignments.

## Data Ownership

Each domain owns its authoritative records.

- Melanated Adventurers owns adventures, registrations, readiness, community activity, Passport, Journey, and MA host operations.
- Build-A-Camp owns service orders, fulfillment jobs, rental inventory, workers, delivery, setup, and returns.
- Beerded Empire owns its own community membership, content, events, and identity.

Cross-product data should be exchanged through explicit identifiers and limited payloads.

## Integration Failure Rule

A failure in an adjacent platform must not make the Melanated Adventurers member app unusable.

For example:

- members must still access tickets if Build-A-Camp is unavailable
- hosts must still view the adventure roster
- readiness must still function
- community and emergency communications must remain available

External fulfillment status may display as temporarily unavailable without blocking unrelated features.

## Repository Rule

The current ProjectGroundwork repository is the product source of truth for Melanated Adventurers only.

Build-A-Camp specifications should be placed in a separate repository or clearly separate product workspace when that product is formally developed.

No Build-A-Camp operational specification should be added to the Melanated Adventurers app blueprint except for integration contracts and boundary documentation.

## Decision

Build-A-Camp and Beerded Empire remain separate products.

Melanated Adventurers may integrate with them later, but will not absorb their workflows, audiences, or identities.
