export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-17-outpost-personalized-feed-v1',
  title: "What's New",
  intro: 'Outpost is getting smarter about what belongs in your feed.',
  items: [
    'For You now prioritizes posts from your Trailmates, groups you belong to, and relevant community activity instead of acting like a raw everyone feed.',
    'Connection-only, Crew, and group posts now respect their intended audience before they can appear in the feed.',
    'Outpost reactions, comments, sharing, and reporting now use the same compact interaction system across feed and conversation views.',
    'Post reporting lives in the post options menu so the engagement row stays focused on social actions.',
  ],
};
