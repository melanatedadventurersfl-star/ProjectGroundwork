# Community Video Attachments V1

## Goal
Allow members to attach a short video to Community posts from both the full Create Post screen and the inline Outpost composer, while preserving existing Community audiences, moderation, and private media access rules.

## Product behavior

### Video selection
- Add a **Video** action beside the existing Photo action.
- V1 selects an existing video from the device media library.
- A post may contain one media attachment: either one image or one video.
- Selecting a video replaces a selected photo, and selecting a photo replaces a selected video.
- Video-only posts are allowed. Caption/body text remains optional when a video is attached.

### Limits
- Maximum duration: **60 seconds**.
- Maximum file size: **100 MB**.
- Reject an over-limit selection before upload when the picker provides duration or file-size metadata.
- Recheck file size after reading the local file before uploading.
- Show a clear validation message when a video exceeds either limit.

### Composer preview
- Show the selected video filename when available.
- Show duration and file size when available.
- Provide a clear remove action.
- The composer does not autoplay video.

## Storage and data contract

### Storage
- Continue using the existing private Supabase Storage bucket: `community-media`.
- Continue storing the media object path in `community_posts.image_url` for V1 compatibility with the existing storage RLS policy.
- Do not introduce a second public video bucket.
- Uploaded objects remain scoped to the authenticated member's existing storage prefix.

### Metadata
Video posts store the following values in `community_posts.metadata`:

```json
{
  "media_type": "video",
  "media_mime_type": "video/mp4",
  "media_file_name": "clip.mp4",
  "media_file_size": 12345678,
  "media_duration_ms": 42000
}
```

Image attachments may store:

```json
{
  "media_type": "image"
}
```

Older image posts without `media_type` remain valid and are treated as images.

### Feed media resolution
- The Community feed continues creating a short-lived signed URL for the stored media path.
- The client resolves attachment type from `metadata.media_type`.
- For a video post, the signed URL is exposed as `media_url` and is not passed to React Native's Image component.
- Existing image posts continue using `image_url` with no migration required.

## Upload flow
1. Member selects Video.
2. App requests media-library permission if needed.
3. App validates known duration and file size.
4. App displays selected-video metadata in the composer.
5. On Post, app reads the local video and performs the final 100 MB size validation.
6. App uploads the video to the member's existing `community-media` path.
7. App creates the Community post with video metadata.
8. If post creation fails after upload, the uploaded object is removed to prevent orphaned media.

## Playback
- V1 displays a dedicated video play card in the Outpost feed and Community conversation screen.
- Video never autoplays in the feed.
- Tapping Play opens the signed media URL in the device's native player.
- Duration is displayed when available.
- Feed navigation and post engagement remain separate from the video Play action.

## Audiences and Community behavior
Video attachments work with all existing post audiences:
- Everyone
- My Connections
- Circle
- Group

Video is an attachment type, not a new Community post type. Existing Update, Ask, Adventure Buddy, Place/Recommendation, and other applicable Community post types may carry a video attachment.

## Moderation and privacy
- Existing post reporting applies to video posts without a separate moderation workflow.
- Existing Hide Post and Block Member behavior applies to video posts.
- Video access inherits the same Community visibility rules as the post because media stays in the existing private bucket and uses signed URLs.
- Failed uploads or failed post creation surface a user-readable error and do not silently publish a broken post.

## Acceptance criteria
- [ ] A member can select a video from the full Create Post screen.
- [ ] A member can select a video from the inline Outpost composer.
- [ ] Selecting a video removes any selected photo and vice versa.
- [ ] A video up to 60 seconds and 100 MB can be uploaded and published.
- [ ] A video longer than 60 seconds is rejected with a clear message.
- [ ] A video larger than 100 MB is rejected with a clear message.
- [ ] A video-only post can be published.
- [ ] Video metadata is stored with the post.
- [ ] Existing image posts continue rendering normally.
- [ ] Video posts render as video cards rather than broken images.
- [ ] Tapping Play opens the signed video in the device player.
- [ ] The video remains playable from the Community conversation screen.
- [ ] Reporting, hiding, blocking, reactions, and comments continue working for video posts.
- [ ] A failed post creation removes a video that was already uploaded.
- [ ] No database migration is required for V1.

## Out of scope for V1
- Recording video directly inside the app.
- Inline `expo-video` playback inside the feed.
- Autoplay while scrolling.
- Video posters/thumbnails generated from frames.
- Server-side transcoding or compression.
- Adaptive bitrate streaming.
- Resumable/background uploads.
- Multiple images/videos in one post.

## V1.1 candidates
- Inline playback with native controls using Expo Video.
- Poster-frame generation for richer feed cards.
- Full-screen in-app video viewer.
- Upload progress and cancellation.
- Resumable uploads for unreliable connections.
- Server-side transcoding to standardized mobile-friendly formats.
- Direct camera recording with the same duration and size rules.
