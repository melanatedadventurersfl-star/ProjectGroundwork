export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-17-pathfinder-dynamic-v2',
  title: "What's New",
  intro: 'The Trailhead just got a more responsive sky.',
  items: [
    'Pathfinder scenery now stays rank-specific while adapting to live weather and time of day.',
    'Morning, afternoon, evening, and night now apply distinct atmosphere treatments to the Trailhead banner.',
    'Rain, fog, storms, clouds, and clear conditions now shift the Pathfinder scene instead of falling back to generic art.',
    'Update delivery and release notes have been refreshed for preview testing.',
  ],
};
