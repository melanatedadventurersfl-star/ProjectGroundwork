# Trail Guide Data Ingestion V1

## Goal

Trail Guide destination pages should answer practical trip questions from source-backed data instead of generic category copy.

V1 adds a structured ingestion layer for facts such as:

- electric service and amperage
- water and sewer hookups
- dump stations
- tent and RV camping
- campsite capacity
- check-in, check-out, and quiet hours
- showers, restrooms, and other amenities
- pets, fires, generators, and campground rules
- base and tax-inclusive rates
- activities and launch access
- accessibility details when an official source states them

Unknown information stays unknown. A missing statement is never converted into `false`.

## Source hierarchy

The system stores every source and every extracted fact separately. Source priority is used only when two active sources provide values for the same field.

| Source | Default priority |
| --- | ---: |
| Official campground rules | 95 |
| Official park or operator website | 90 |
| Official reservation system | 85 |
| Structured government/API source | 80 |
| Admin-entered source | 70 |
| Community observation | 40 |

Within the same priority, the newer source date or check date wins.

If active sources disagree, the winning fact can still display, but the disagreement is stored in `trail_guide_conflicts` for admin review.

## Data model

### `trail_guide_place_profiles`

One enrichment record per Trail Guide catalog destination. `place_id` matches the static Trail Guide catalog ID.

Stores operator, location, publication state, completeness, and last verification time.

### `trail_guide_sources`

Stores source provenance:

- source type
- source name
- public source URL
- source date when known
- priority
- fetch status
- last checked time
- next scheduled check time
- last fetch error

### `trail_guide_facts`

Stores one fact per source and field. Each row includes:

- field key
- typed JSON value
- short evidence paraphrase
- confidence
- source ID
- verification time
- `is_current` winner flag

The member experience reads only current facts.

### `trail_guide_conflicts`

Stores fields where active sources disagree. It records all candidate fact IDs and the current recommended fact.

### `trail_guide_reports`

Stores structured member observations separately from official facts. Community reports never silently replace official information.

## Extraction rules

The `trail-guide-ingest` Supabase Edge Function is restricted to platform admins.

For each registered source it:

1. Fetches an official public webpage or supplies an official PDF to the extraction model.
2. Requests only fields from the Trail Guide fact schema.
3. Rejects unsupported value types.
4. Stores a short evidence paraphrase with every fact.
5. Marks the source checked or records the fetch error.
6. Reconciles active facts by priority and source date.
7. Opens or resolves conflicts.
8. Recalculates destination completeness.

The extraction prompt explicitly prohibits inferring missing amenities, hookups, prices, rules, cell service, Wi-Fi, dimensions, or accessibility features.

## Admin workflow

Admin Profile now includes **Trail Guide Data**.

The workspace lets an admin:

- select destinations already in the ingestion pipeline
- see completeness, source count, conflict count, and verification date
- add an official webpage, rules PDF, or reservation source
- refresh all registered official sources
- see failed source checks
- see unresolved field conflicts
- search the existing Trail Guide catalog and initialize another destination

This makes the existing catalog expandable without manually entering dozens of fields for every place.

## Member experience

Destination detail pages try structured data first.

For a camping destination with structured data, the page can show:

- nightly tent and RV rates
- electric availability, voltage, and amperage
- water hookup status and central potable water
- sewer hookup and dump station status
- showers and restrooms
- campsite capacity
- check-in and check-out
- quiet hours
- pet limits and fees
- relevant destination warnings
- amenity and activity chips
- data completeness
- a link to the official source

If the ingestion tables are unavailable or a destination has not been enriched yet, the existing Trail Guide `details` content remains the fallback. This keeps older destinations functional during rollout.

## Huguenot V1 seed

`huguenot-memorial-park` is the first complete test destination.

The migration registers:

- City of Jacksonville Huguenot Memorial Park page
- City of Jacksonville campground rules PDF dated April 21, 2026
- City reservation system

It seeds supported facts for electric service, 110V/30A/50A, water, sewer, dump station, tent and RV camping, occupancy, parking, check-in/out, quiet hours, generators, fire rings, pets, showers, restrooms, picnic tables, ADA sites, stay limits, rates, reservations, activities, launches, and the 4WD beach-access warning.

The seed gives members useful data immediately after migration deployment. Future admin refreshes can update those source-backed facts through the same pipeline.

## Acceptance criteria

- Existing Trail Guide pages still render before the new migration reaches an environment.
- Huguenot displays structured campsite essentials after migration deployment.
- Every structured member-facing fact comes from a current `trail_guide_facts` row.
- Facts retain their source record and evidence.
- Unknown source content is omitted rather than inferred.
- An unavailable feature is stored as `false` only when a source explicitly establishes that fact.
- Admin ingestion requires `is_platform_admin()`.
- Private-network and non-HTTPS source URLs are rejected by the ingestion function.
- Conflicting active sources create an admin-visible conflict record.
- Member observations remain separate from official facts.
- Source fetch failures do not erase previously verified facts.
