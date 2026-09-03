# Host AI Event Lifecycle V1

Status: implementation specification

This document defines the Host Center AI event lifecycle. It does not change member onboarding. AI privacy consent will be incorporated into onboarding in a separate pass.

## EVT-01 Build an Event entry

Build an Event presents distinct starting paths:

- Plan with AI
- Build Manually
- Choose an Event Starter
- Import Files
- Import from Event Site

AI planning and manual setup are separate experiences.

## AI-01 Guided AI Event Planner

Plan with AI is a dedicated conversational planning route. The planner:

- starts from a rough idea
- maintains structured event state behind the conversation
- asks one useful question at a time
- recommends answers when evidence supports a recommendation
- allows responses such as Recommend for me, I do not know, and Skip for now
- updates readiness after each turn
- targets 95 to 100 percent readiness before event creation

## AI-02 Adaptive event playbooks

Planning questions and required components change with the event.

Examples:

- paddling: launch, route, duration, skill level, equipment, rentals, PFDs, lead and sweep roles, safety, weather or condition backup
- camping: campground, sites, lodging types, meals, equipment, activities, check-in, safety and cleanup
- vendor event: venue, booths, vendor categories, fees, power, water, documents, insurance, setup, teardown, security and promotion

New needs can be added mid-conversation without restarting the plan.

## AI-03 Recommendation model

Each recommendation must distinguish confirmed facts from suggestions. Recommendations can include:

- label
- reason
- verification requirement
- affected event components

The system must not invent venue rules, business ownership, prices, availability, permits, weather, safety requirements or changing external facts.

## AI-04 Recommendation disclaimer

AI planning displays a persistent recommendation notice. Changing details such as access, operating rules, prices, permits, weather, water conditions and availability must be verified before publication when the system cannot establish them from an approved source.

## AI-05 Emotional progression

The planning experience combines operational readiness with human progress language:

- Start with an idea
- The idea is taking shape
- The essentials are coming together
- Almost ready to host
- Ready to host

The event preview should visibly become more complete as decisions are made. Progress language should be restrained and should never hide unresolved operational risk.

## AI-06 Readiness

Readiness reflects actual event completeness. A high score cannot compensate for required publishing blockers.

Core planning considers:

- event identity
- event type
- schedule
- location
- attendance
- admission model
- arrival instructions
- event-specific safety or backup needs
- communications
- operational components
- work plan

AI-created events should reach at least 95 percent readiness before the primary Create Event action becomes available.

## PRIV-01 AI privacy defaults

All optional AI personalization and product-improvement features start OFF:

- Personal Memory
- Learn From Event History
- Shared Organization Memory
- Save AI Planning Conversations
- Recommendation History
- Product Improvement Analytics

The user can enable settings independently.

Turning off a setting stops future collection or learning for that capability. Saved AI memory can be cleared separately.

## PRIV-02 Data boundaries

The AI does not gain access to data the current user could not otherwise access.

Operational event data needed to run an event is separate from optional AI product-improvement analytics.

Raw AI conversation text is not required for structured product analytics.

## AI-07 Memory architecture

The architecture supports separate scopes:

- current event state
- optional personal memory
- optional event-history learning
- optional approved organization memory
- optional saved planning sessions

Personal memory records identify whether they were explicit or learned and can be disabled or cleared.

## EVT-02 Event creation

Creating an AI-planned event writes the approved structured plan into the normal Host Center event model. It creates the event workspace and selected event components rather than creating a separate AI-only event system.

## WORK-01 Work plan generation

After AI event creation, the user reviews recommended task packs before tasks are added.

Initial V1 packs include:

- Food
- Waivers
- Safety
- Vendors
- Equipment
- Communications
- Marketing
- Event Day

Every task can be individually included or excluded. The user can select or remove an entire pack.

Tasks include category, suggested due date, priority and event relationship.

## AI-08 Event Assistant

After creation, AI changes from Planner to Event Assistant.

The Event Assistant reads the actual event snapshot, including:

- event details
- readiness
- event components
- open and blocked tasks
- operations metrics
- connected event analytics

It can identify:

- what needs attention
- what the host may be forgetting
- dependencies and blockers
- likely downstream impact of a proposed change
- useful next actions

The V1 assistant is advisory. It must not claim it changed records, sent messages or contacted an external party unless a separate authorized action actually executes.

## EVT-03 Editing and change impact

Existing events remain editable through normal event and component screens. Event Assistant supports reasoning about changes such as:

- event date
- time
- location
- attendance
- food
- tickets
- vendors
- equipment
- communications

When a change affects multiple areas, the assistant should identify those areas before any automated write flow is offered.

## DATA-01 Unified event connections

External channels attach to the internal Host campaign through event connections.

Initial normalized providers include:

- Eventbrite
- Facebook
- Instagram
- email
- Go Melanated
- SMS
- other supported providers

Provider capabilities and sync state are stored per event connection.

## DATA-02 Unified event analytics

Host Center uses one internal analytics model rather than displaying unrelated provider schemas.

Normalized events include:

- promotion impression
- promotion reach
- promotion view
- promotion click
- event page view
- checkout started
- ticket ordered
- ticket refunded
- attendee checked in
- message delivered
- message opened
- message clicked

This allows Facebook, Eventbrite, Go Melanated, email and future providers to contribute to one event dashboard while retaining source attribution.

## DATA-03 Ticket sources

Ticket inventory and revenue can be recorded by source. Event-level reporting can combine multiple ticket channels without treating each channel as a separate event.

Possible sources include Eventbrite, Go Melanated, manual and complimentary inventory as integrations are implemented.

## MKT-01 Promotion attribution

Promotions are event records with channel, destination, tracking code, schedule and status. When a provider supplies metrics or a tracked link records activity, those records feed the unified analytics model.

## DATA-04 Event analytics dashboard

The event analytics view supports:

- ticket sales
- capacity and remaining inventory
- gross revenue
- tracked orders and refunds
- check-ins
- promotion funnel
- connected service sync state
- source performance
- promotion records

Metrics are shown only when recorded by Go Melanated or a connected provider.

## LIFE-01 Lifecycle

The intended AI lifecycle is:

Idea -> AI Planner -> Event Creation -> Work Plan -> Event Assistant -> Readiness Management -> Event Day -> Post-Event Review

The AI role changes with the event lifecycle while the event itself remains the shared source of truth.

## Future work explicitly outside this V1

- onboarding consent UI for AI settings
- live Meta OAuth and publishing integration
- live Eventbrite OAuth, webhook and order ingestion
- weather, tides, maps and live venue research connectors
- transactional Event Assistant writes and external communications
- full post-event review and learning UI
- permanent organization knowledge administration
- native mobile date and time pickers for manual event setup
