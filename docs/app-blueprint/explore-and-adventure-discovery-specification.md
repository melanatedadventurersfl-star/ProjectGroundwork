# Explore and Adventure Discovery Specification

## Purpose

Explore is the discovery layer of the Melanated Adventurers app. It helps members find relevant adventures, understand whether an experience fits them, save opportunities for later, and move confidently into registration.

The experience should feel curated rather than infinite. It should reduce uncertainty, foreground accessibility and readiness, and help members discover real-world experiences without trapping them in endless browsing.

## Product Principles

1. Discovery should lead toward participation.
2. Relevance matters more than volume.
3. Accessibility, cost, location, and difficulty must be visible early.
4. Recommendations should be explainable.
5. Availability and registration status must be trustworthy.
6. Search and filters should remain usable with limited connectivity.
7. The app should encourage exploration without creating artificial urgency.

## Primary User Goals

Members use Explore to:

- Find upcoming adventures
- Browse by date, location, category, difficulty, or cost
- See what is available near them
- Understand what is included
- Compare possible adventures
- Save experiences for later
- Share an adventure
- Join a waitlist
- Begin registration
- Revisit recently viewed adventures
- Discover experiences based on past participation and interests

## Explore Entry Points

Explore may be opened from:

- Primary bottom navigation
- Trailhead discovery tiles
- Search
- Passport recommendations
- Community posts
- Campfire activity
- Notifications
- Shared adventure links
- Host or partner pages

Each entry point should preserve context when possible. For example, opening Explore from a hiking Passport badge may preselect hiking-related recommendations.

## Explore Home Architecture

Recommended sections:

1. Search and filters
2. Featured adventure
3. Recommended for you
4. Happening soon
5. Near you
6. Beginner-friendly
7. Family-friendly
8. Low-cost or free
9. Build-A-Camp supported
10. MANA learning and service opportunities
11. Recently viewed
12. Saved adventures

Sections should only appear when they have meaningful content. Empty sections should not create dead space.

## Search

### Searchable fields

- Adventure title
- Location
- Venue
- Region
- Adventure type
- Category
- Host organization
- Accessibility feature
- Included amenity
- Skill or activity
- Keyword

### Search behavior

- Show suggestions while typing
- Prioritize exact and near-exact matches
- Include recent searches
- Allow clearing individual recent searches
- Preserve active filters
- Tolerate minor misspellings
- Display a clear empty state with recovery suggestions

### Search result ranking

Search ranking should consider:

1. Query relevance
2. Registration availability
3. Date proximity
4. Geographic relevance
5. Member interests
6. Prior engagement
7. Accessibility fit when preferences are known
8. Host priority or featured status

Paid promotion, if ever introduced, must be labeled and must not silently override relevance.

## Filters

### Core filters

- Date or date range
- Distance or region
- Adventure category
- Difficulty
- Price range
- Registration status
- Duration
- Overnight or day experience
- Transportation included
- Meals included
- Equipment included
- Beginner-friendly
- Family-friendly
- Accessibility features
- Age requirements
- Build-A-Camp setup available
- MANA education or service

### Filter behavior

- Show the active-filter count
- Allow filters to be removed individually
- Include Clear all
- Preserve filter state during a session
- Display result count before applying on larger filter panels
- Avoid hiding important filters behind ambiguous labels
- Explain any filter that may be unfamiliar

### Date presets

Useful presets:

- This weekend
- Next weekend
- Next 30 days
- This season
- Custom range

Relative dates should always resolve to exact dates in results.

## Browse Categories

Initial categories may include:

- Camping
- Hiking
- Water adventures
- Road trips
- Wellness
- Food and social
- Festivals and cultural experiences
- Family adventures
- Skills and education
- Service and stewardship
- Travel
- Beginner experiences

Categories are discovery aids, not rigid domain entities. One adventure may belong to multiple categories.

## Adventure Result Card

Every result card should include enough information to support a first-pass decision.

Required content:

- Adventure image or visual placeholder
- Title
- Date and time
- City, region, or distance
- Price starting point or Free
- Registration state
- Category
- Difficulty or experience level when relevant
- One key inclusion or differentiator

Optional content:

- Remaining capacity
- Transportation included
- Meals included
- Build-A-Camp badge
- MANA badge
- Accessibility indicator
- Recommendation reason
- Host name
- Saved state

Cards should not display a readiness score before the member has registered.

## Registration States in Explore

Supported public states:

- Coming soon
- Registration open
- Limited availability
- Waitlist available
- Sold out
- Registration closed
- Cancelled
- Postponed
- Completed

Rules:

- Do not show exact remaining capacity unless the organization chooses to expose it.
- Limited availability should be based on a documented threshold.
- Sold-out experiences may remain discoverable if a waitlist, future recurrence, or related recommendation exists.
- Cancelled adventures should not appear in normal discovery feeds unless the member previously saved or registered for them.

## Recommendation System

### Recommendation inputs

Recommendations may consider:

- Saved interests
- Preferred activity types
- Home region
- Distance preferences
- Previous registrations
- Completed experiences
- Passport activity
- Saved adventures
- Recently viewed adventures
- Accessibility preferences
- Family or group context
- Price preferences
- Preferred difficulty
- Transportation needs

### Explainability

Recommendations should include a concise reason such as:

- Because you enjoyed your last camping trip
- Near Jacksonville
- Beginner-friendly
- Similar to an adventure you saved
- Transportation included
- Fits your accessibility preferences

The app must not infer sensitive traits for recommendation purposes without explicit consent.

### Diversity and discovery balance

Recommendations should balance familiarity with exploration.

Suggested mix:

- Strong-fit recommendations
- Adjacent-interest recommendations
- New or seasonal opportunities
- Community-popular adventures
- Beginner entry points

The system should avoid repeatedly showing the same small set of adventures.

## Near You and Map Discovery

### Location use

Location may come from:

- Member profile region
- Device location permission
- Manually selected city or region

Device location should never be required to browse.

### Map mode

Map mode may show:

- Adventure markers
- Date or status indicators
- Selected adventure preview
- Distance from selected origin
- Clustered markers at broader zoom levels

### Map safety and privacy

- Public discovery should use event or venue locations only.
- Private meeting points should not appear before registration when disclosure would create safety or privacy concerns.
- Emergency and arrival instructions must not depend only on the map.

### Offline behavior

When offline:

- Show cached recent results
- Preserve saved adventures
- Allow opening cached adventure summaries
- Clearly label stale availability information
- Prevent registration submission until connectivity returns

## Saved Adventures

Members may save an adventure from:

- Result cards
- Adventure Detail
- Community posts
- Shared links

Saved adventure behavior:

- Save instantly when authenticated
- Prompt sign-in when necessary
- Preserve the originating context
- Display registration status changes
- Allow optional reminder settings
- Remove cleanly without confirmation unless associated data would be lost

Saved does not equal registered.

## Recently Viewed

Recently viewed adventures help members recover prior exploration.

Rules:

- Store a limited recent history
- Allow clearing history
- Do not include cancelled or private adventures unless the member has a relationship to them
- Sync across devices when authenticated

## Compare Adventures

Comparison is optional for MVP but should be supported in the information model.

Useful comparison fields:

- Date
- Location
- Price
- Duration
- Transportation
- Meals
- Lodging
- Equipment
- Difficulty
- Accessibility
- Cancellation policy
- Registration deadline

Comparison should be limited to a manageable number, such as two or three adventures.

## Adventure Detail Entry

Selecting a result opens Adventure Detail in the appropriate role state:

- Prospect
- Waitlisted member
- Registered attendee
- Guest
- Volunteer
- Host or admin

The selected result should preserve:

- Search query
- Active filters
- Scroll position
- Section source

Returning to Explore should restore the prior discovery context.

## Registration Entry Points

Possible primary actions:

- View details
- Register
- Join waitlist
- Notify me
- Save
- View recurrence

Registration should begin from Adventure Detail unless the adventure is intentionally designed for one-step registration.

The app must display before registration:

- Price
- Included items
- Important exclusions
- Refund or cancellation summary
- Age requirements
- Accessibility summary
- Required waivers or critical prerequisites

## Sharing

Members may share an adventure through a public link.

Shared links should include:

- Title
- Date
- General location
- Public image
- Registration state
- Public summary

They must not expose:

- Attendee identities
- Private meeting points
- Internal host notes
- Member-specific pricing or readiness data

## Empty States

### No results

Show:

- Clear explanation
- Active-filter summary
- Remove filters action
- Nearby or broader alternatives
- Saved-search option in a later phase

### No nearby adventures

Offer:

- Expanded distance
- Region change
- Virtual or educational opportunities
- Popular adventures elsewhere
- Notify me when something is added

### No recommendations yet

Use curated content and invite the member to choose interests without blocking browsing.

## Host and Admin Controls

Hosts should be able to manage discovery metadata including:

- Featured image
- Public title and summary
- Categories
- Difficulty
- Accessibility features
- Included amenities
- Region and public location
- Registration state
- Capacity visibility
- Featured status
- Search keywords
- Recommendation eligibility

Changes to critical availability data should propagate quickly across Explore and Adventure Detail.

## Moderation and Quality

Adventure listings should be checked for:

- Accurate dates
- Accurate pricing
- Correct location
- Accessibility clarity
- Image rights
- Duplicate listings
- Misleading availability
- Missing cancellation information
- Unsafe public disclosure

Archived or duplicated adventures should not remain in active discovery feeds.

## Notifications and Reminders

Explore-related notifications may include:

- Saved adventure registration opens
- Saved adventure availability becomes limited
- Waitlist opens
- Similar new adventure added
- Date or location changes for a saved adventure

Notification rules:

- Respect member preferences
- Avoid repeated scarcity messaging
- Do not notify about every recommendation
- Critical updates apply only when the member has saved, waitlisted, or registered

## Analytics Events

Suggested events:

- explore_opened
- explore_section_viewed
- search_started
- search_submitted
- search_result_opened
- filter_opened
- filter_applied
- filter_removed
- map_opened
- adventure_saved
- adventure_unsaved
- adventure_shared
- waitlist_started
- registration_started_from_explore
- no_results_seen
- recommendation_opened

Analytics should measure whether discovery leads to informed participation, not merely screen time.

## MVP Scope

MVP should include:

- Explore home
- Search
- Core filters
- Category browsing
- Adventure result cards
- Saved adventures
- Recently viewed
- Recommendation reasons
- Near-you section using profile region or manual location
- Public registration states
- Entry into Adventure Detail
- Basic offline caching

## Later Phases

- Full map mode
- Adventure comparison
- Saved searches
- Availability alerts
- Collaborative trip planning
- Friend or group recommendations
- Advanced personalization controls
- Seasonal discovery campaigns
- Partner-host discovery feeds

## Acceptance Criteria

Explore is ready for implementation when:

1. Members can browse without granting location permission.
2. Search supports titles, locations, categories, and keywords.
3. Filters can be applied, removed, and cleared predictably.
4. Every result communicates date, location, price, and registration state.
5. Accessibility and difficulty information appears early when relevant.
6. Saved and registered states are visually distinct.
7. Returning from Adventure Detail restores discovery context.
8. Sold-out and waitlisted states are accurate.
9. Offline content is clearly labeled when availability may be stale.
10. Recommendations include an understandable reason.
11. Private locations and attendee data never appear in public discovery.
12. Analytics track meaningful discovery and registration behavior.
