# Community and Campfire Specification

## Purpose

Define the social and activity systems for the Melanated Adventurers app while protecting the product's real-world focus, Black-centered community mission, and launch decision to exclude direct messaging.

Community supports member-created discussion and discovery across the broader organization. Campfire is the contextual activity center for adventures, host updates, milestones, and relevant community activity.

The system should help people feel connected before, during, and after adventures without becoming a generic social network.

## Product Boundaries

### Community

Community is the member-facing space for public or scoped posts, discussion, shared outdoor knowledge, memories, questions, and organization-led conversation.

### Campfire

Campfire is an aggregated activity stream containing events that matter to the member, including:

- Host announcements
- Adventure updates
- Schedule changes
- Weather notices
- Member posts connected to an adventure
- Comments and reactions on followed activity
- Photo uploads
- Readiness milestones
- Passport achievements
- Community updates

### Notifications

Notifications are reserved for information that is urgent, directly actionable, or likely to be missed if left only in Campfire.

### Direct messaging

Direct messaging is excluded from launch.

The system must not expose hidden one-to-one messaging through comments, private mentions, ad hoc private threads, or other loopholes.

## Core Principles

1. Real-world connection first
2. Adventure context over endless scrolling
3. Host authority must be clear
4. Safety and moderation must be visible
5. Privacy must be understandable
6. Community interaction must be lightweight and purposeful
7. Social metrics must not dominate the experience

## Community Information Architecture

Primary Community sections:

- Community Home
- Following
- Adventures
- Questions
- Stories and Memories
- Tips and Resources
- MANA Education and Service
- Saved Posts
- Member Profile Entry Points

The first release may reduce this to a simpler tabbed or filtered feed.

## Community Home

The Community Home should contain:

1. A compact composer entry
2. Pinned organization or host content
3. Recommended discussion or recent useful posts
4. Recent posts from followed adventures or topics
5. Community prompts tied to outdoor participation
6. Clear filters for feed scope

The feed should not default to pure engagement ranking.

Ranking should prioritize:

- Relevance to the member's upcoming or recent adventures
- Followed topics and categories
- Host or moderator importance
- Recency
- Helpful activity
- Local relevance
- Safety or operational importance

## Post Types

Supported launch post types:

### Standard post

- Text
- Optional photos
- Optional adventure association
- Optional category or topic

### Question

- Clear question title
- Details
- Optional category
- Optional adventure association
- Answer or helpful-response marking may be added later

### Story or memory

- Text narrative
- Photos
- Completed adventure association
- Optional Passport or Journey connection

### Tip or resource

- Practical outdoor advice
- Optional external link
- Category and skill-level context

### Host announcement

- Created only by authorized host roles
- Visually distinct
- May target the entire community or a specific adventure
- May escalate to notification depending on priority

### Poll

Deferred unless operationally required for adventure planning.

### Sale or marketplace post

Excluded from launch unless explicitly approved through a future marketplace policy.

## Post Composer

Composer fields:

- Post type
- Text or question title
- Body
- Photo attachments
- Adventure association
- Topic or category
- Visibility
- Alt text for meaningful images

The composer should present only the fields needed for the selected post type.

## Visibility Scopes

Supported scopes:

- Public community
- Members only
- Registered adventure participants
- Hosts and volunteers for an adventure
- Organization team only

A member must see the selected scope before publishing.

Changing visibility after publication should be restricted when it could expose previously private content.

## Adventure-Scoped Community

Every adventure may have a social activity area containing:

- Host announcements
- Participant posts
- Questions
- Photos
- Schedule-related discussion
- Arrival or preparation updates where permitted

Access rules depend on adventure settings.

Possible access modes:

- Registered participants only
- Registered participants and approved guests
- Public preview with participant-only posting
- Hosts only
- Disabled

Adventure discussion must not replace readiness tasks or urgent notifications.

## Campfire Activity Model

Campfire items are normalized activity records rather than copies of full objects.

Each activity record should contain:

- Activity type
- Source actor or system
- Related adventure or community context
- Timestamp
- Priority
- Read state
- Relevant destination
- Summary text
- Optional media preview
- Optional action

## Campfire Activity Types

Launch activity types:

- Host announcement published
- Adventure schedule updated
- Adventure location updated
- Weather alert posted
- Member post published in a followed context
- Comment on followed post
- Reaction on member content
- Photo added to attended adventure
- Registration confirmed
- Readiness milestone reached
- Check-in completed
- Adventure completed
- Passport stamp awarded
- Community resource published

## Campfire Prioritization

Order activity using a blended model:

1. Critical and time-sensitive operational updates
2. Activity tied to the member's active or next adventure
3. Direct responses to the member's content
4. Host announcements
5. Followed adventure or topic activity
6. General community activity

Chronology remains visible and understandable. Ranking must not conceal urgent updates.

## Campfire Grouping

Related activity may be grouped to reduce noise.

Examples:

- Five photos added to the same adventure
- Multiple reactions on the same post
- Several readiness tasks completed
- A burst of comments on one discussion

Grouped activity must retain a clear path to the full context.

## Read and Unread Behavior

An item becomes read when:

- Opened directly
- Its destination is opened from Campfire
- The user explicitly marks it read
- The application confirms meaningful visibility according to future analytics rules

Unread counts should not become a constant pressure mechanic.

## Reactions

Launch reactions should be limited to a small, culturally appropriate set.

Reactions should communicate acknowledgement and support rather than create a competitive score system.

Public reaction counts may be shown, but should not dominate post presentation.

## Comments

Comments support threaded discussion beneath posts and announcements.

Launch rules:

- One level of replies is sufficient
- Authors may edit within a limited period
- Edited comments display an edited label
- Authors may delete their own comments unless preservation is required for moderation
- Hosts may lock comments on operational announcements
- Members may report comments

Comments do not create private conversations.

## Mentions

Launch mentions may include:

- Member mentions in public or scoped discussions
- Host-role mentions where appropriate

Restrictions:

- Mentions do not bypass visibility permissions
- Members may control mention notifications
- Mass mentions are restricted to authorized roles
- Mentions must not enable hidden direct-message behavior

## Following

Members may follow:

- Adventures
- Topics
- Categories
- Organization programs
- Possibly members in a later phase

Member-to-member following is deferred for launch unless the benefit and privacy model are explicitly approved.

Following an adventure should happen automatically after registration, with an option to reduce nonessential activity.

## Saving

Members may save:

- Posts
- Questions
- Tips
- Resources
- Host announcements where allowed

Saved content is private to the member.

## Photos and Media

Launch media support:

- Photos
- Multiple-image posts within an established limit
- Alt text
- Basic crop and reorder controls

Deferred:

- Native video uploads
- Live streaming
- Audio posts
- Short-form video feeds

Media rules:

- Preserve original quality within reasonable limits
- Strip unnecessary sensitive metadata where possible
- Do not expose precise location metadata by default
- Require consent-aware posting guidance for group photos

## Member Profiles in Community

Community profile surfaces may show:

- Display name
- Profile photo
- Short bio
- Outdoor interests
- General region, not precise home location
- Passport achievements selected for display
- Public posts
- Mutual adventures where appropriate

Do not expose:

- Readiness data
- Emergency contacts
- Payment details
- Private registrations
- Exact location history
- Minor information beyond approved guardian-controlled settings

## Host and Moderator Identity

Authorized roles must be visually clear:

- Organization administrator
- Host
- Co-host
- Moderator
- Volunteer lead

Role labels must not be based only on color.

## Moderation Model

Moderation must support:

- Report post
- Report comment
- Hide content pending review
- Remove content
- Lock comments
- Warn member
- Temporarily restrict posting
- Suspend account
- Ban account
- Preserve moderation evidence
- Record moderator actions
- Appeal workflow in a later phase

## Report Categories

Initial categories:

- Harassment or bullying
- Hate or discriminatory conduct
- Threats or violence
- Unsafe outdoor advice
- Sexual content
- Spam or scams
- Impersonation
- Privacy violation
- Unauthorized commercial promotion
- Other

## Safety Escalation

Reports involving immediate danger, credible threats, missing persons, or active adventure emergencies should not remain only in a routine moderation queue.

The product should provide a clearly documented escalation path for authorized staff.

The app must not imply that reporting content replaces contacting emergency services.

## Community Guidelines Integration

Members must accept community guidelines during onboarding or before first posting.

The composer may show contextual reminders for:

- Respectful participation
- Consent before posting identifiable people
- Avoiding dangerous advice presented as fact
- Protecting private location information
- Keeping adventure-specific disputes out of public escalation when appropriate

## Host Announcements

Announcement fields:

- Title
- Message
- Audience
- Related adventure
- Priority
- Publish time
- Optional expiration
- Optional action
- Notification escalation setting

Priority levels:

- Critical
- Action required
- Important update
- Informational

Critical and action-required announcements should generate notifications for the relevant audience.

## Notification Rules

Potential notifications:

- Host announcement requiring action
- Critical schedule or location change
- Weather or safety warning
- Direct comment response
- Approved mention
- Moderation decision affecting the member

Campfire-only activity:

- General reactions
- Nonurgent photo activity
- Broad community conversation
- Routine milestones

Members should have controls for noncritical categories.

## Quiet Hours

Noncritical social notifications should respect quiet hours.

Critical safety or same-day operational notices may bypass quiet hours with careful governance.

## Anti-Spam and Rate Limits

The system should limit:

- Rapid repeated posting
- Repetitive comments
- Mass mentions
- Duplicate links
- Suspicious account creation or promotion patterns

Rate-limit messages should explain the restriction without revealing abuse-detection details.

## Blocking and Muting

Launch should support at least:

- Mute member content
- Mute post notifications
- Mute adventure social activity while preserving operational announcements

Blocking may be included if member profiles and member mentions create sufficient need.

Blocking must not prevent hosts from delivering required operational information to registered participants.

## Minor Accounts and Guardians

Minor participation requires a guardian-aware policy.

Possible launch approach:

- No independent minor accounts
- Minor guests managed through guardian registration
- Minor images and names subject to stricter visibility and consent rules

The product must avoid exposing minor participation history publicly by default.

## Accessibility

Community content must support:

- Screen-reader labels
- Dynamic text
- Alt text for images
- Logical reading order
- Keyboard navigation where applicable
- Visible focus states
- Captions for any future video
- Non-color moderation and role indicators

## Offline Behavior

When offline:

- Previously loaded activity may remain visible
- Draft posts may be saved locally
- Publishing should clearly show pending status
- Duplicate submission must be prevented during reconnection
- Critical cached announcements should remain accessible

Offline drafts containing sensitive media should be handled securely.

## Search and Discovery

Community search may cover:

- Posts
- Questions
- Topics
- Adventures
- Resources

Search must respect visibility rules.

## Analytics

Useful launch events:

- Community opened
- Campfire opened
- Post created
- Post viewed
- Comment created
- Reaction added
- Content saved
- Content reported
- Announcement opened
- Announcement action completed
- Activity item opened
- Notification converted to action

Analytics should measure usefulness and participation, not maximize compulsive scrolling.

## Admin and Host Tools

Authorized tools:

- Create announcement
- Pin content
- Lock comments
- Remove content
- Review reports
- Apply member restrictions
- View moderation history
- Configure adventure discussion access
- Configure announcement escalation
- Export moderation records where policy allows

## Data Model

Key entities:

- CommunityPost
- Comment
- Reaction
- MediaAsset
- Topic
- Follow
- SavedContent
- ActivityRecord
- Announcement
- Report
- ModerationAction
- MemberRestriction

## MVP Scope

Include:

- Community feed
- Text and photo posts
- Adventure association
- Comments
- Limited reactions
- Reporting
- Host announcements
- Campfire activity stream
- Read and unread state
- Essential notification escalation
- Adventure-scoped discussion
- Saved posts
- Moderator removal and locking tools

Defer:

- Direct messaging
- Member-to-member private chat
- Native video
- Live streaming
- Complex reputation scores
- Marketplace features
- Public follower counts
- Algorithmic short-video feed
- Deep nested replies

## Acceptance Criteria

The system is ready for implementation when:

1. Members can create posts with an understandable visibility scope.
2. Registered participants can access permitted adventure discussion.
3. Hosts can publish visually distinct announcements.
4. Critical announcements can escalate to notifications.
5. Campfire can aggregate activity from multiple product areas.
6. Members can comment, react, save, mute, and report content.
7. Direct messaging is absent from all launch flows.
8. Moderators can review and act on reported content.
9. Visibility permissions are enforced in feeds, search, profiles, and activity records.
10. Offline drafts and reconnection states do not create duplicate posts.
11. Community participation does not expose readiness, payment, emergency, or precise-location data.
12. Social ranking does not conceal urgent operational information.

## Future Expansion

Potential later additions:

- Member following
- Expert or guide profiles
- MANA learning circles
- Structured trip reports
- Collaborative photo albums
- Volunteer project groups
- Polls and planning tools
- Community challenges
- Carefully governed group messaging

Any future messaging system requires a separate safety, privacy, moderation, and abuse-prevention specification before implementation.
