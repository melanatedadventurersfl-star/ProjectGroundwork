export type ReleaseNotes = {
  id: string;
  title: string;
  intro: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-08-17-pathfinder-evening-animated-v1',
  title: "What's New",
  intro: 'Pathfinder has a new trail to follow.',
  items: [
    'Pathfinder evening scenery now uses the new wooded trail artwork instead of the mountain-heavy scene.',
    'Trailhead backgrounds now use a subtle living-photo animation with a gentle drift and zoom.',
    'Scene changes now crossfade smoothly while your crest, weather, badges, and text stay fixed in place.',
    'Update delivery and release-note behavior were tightened so new app updates can surface their changes again.',
  ],
};
